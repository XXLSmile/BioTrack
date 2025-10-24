import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';

import logger from '../logger.util';
import {
  CatalogEntryLinkResponse,
  CatalogListResponse,
  CatalogResponse,
  CreateCatalogRequest,
  UpdateCatalogRequest,
} from './catalog.types';
import { catalogModel } from './catalog.model';
import { catalogShareModel } from './catalogShare.model';
import { catalogEntryLinkModel, ICatalogEntryLink } from './catalogEntryLink.model';
import { catalogRepository, ICatalogEntry } from '../recognition/catalog.model';
import { ISpecies } from '../recognition/species.model';

const serializeCatalogLinks = (
  links: ICatalogEntryLink[],
  fallbackUserId: mongoose.Types.ObjectId
): CatalogEntryLinkResponse[] => {
  const seen = new Set<string>();

  return links.reduce<CatalogEntryLinkResponse[]>((acc, link) => {
    const entryDoc = link.entry as unknown as (ICatalogEntry & {
      toObject?: () => Record<string, unknown>;
    }) | undefined;

    if (!entryDoc) {
      return acc;
    }

    const rawEntry =
      typeof entryDoc.toObject === 'function'
        ? (entryDoc.toObject() as unknown as ICatalogEntry & { speciesId?: ISpecies | mongoose.Types.ObjectId })
        : (entryDoc as unknown as ICatalogEntry & { speciesId?: ISpecies | mongoose.Types.ObjectId });

    const speciesDoc = rawEntry.speciesId as (ISpecies & { toObject?: () => Record<string, unknown> }) | undefined;
    let speciesName: string | undefined;
    let speciesImageUrl: string | undefined;
    let normalizedSpeciesId: mongoose.Types.ObjectId | undefined;

    if (speciesDoc && typeof speciesDoc === 'object' && 'commonName' in speciesDoc) {
      const speciesObj = typeof speciesDoc.toObject === 'function' ? speciesDoc.toObject() : speciesDoc;
      speciesName = speciesObj.commonName || speciesObj.scientificName;
      speciesImageUrl = speciesObj.imageUrl;
      normalizedSpeciesId = speciesObj._id;
    } else if (speciesDoc instanceof mongoose.Types.ObjectId) {
      normalizedSpeciesId = speciesDoc;
    }

    const normalizedEntry: Record<string, unknown> = {
      ...rawEntry,
      speciesId: normalizedSpeciesId ?? rawEntry.speciesId,
      species: speciesName ?? (rawEntry as unknown as { species?: string }).species,
      // imageUrl: speciesImageUrl ?? rawEntry.imageUrl,
      imageUrl: rawEntry.imageUrl ?? speciesImageUrl,

    };

    const addedAtIso = link.addedAt instanceof Date ? link.addedAt.toISOString() : new Date(link.addedAt).toISOString();
    const dedupeKey = `${(normalizedEntry as { _id?: mongoose.Types.ObjectId })._id?.toString() ?? ''}::${addedAtIso}`;
    if (seen.has(dedupeKey)) {
      return acc;
    }
    seen.add(dedupeKey);

    const addedByDoc = link.addedBy as { _id?: mongoose.Types.ObjectId } | mongoose.Types.ObjectId;
    const addedBy =
      addedByDoc instanceof mongoose.Types.ObjectId
        ? addedByDoc
        : addedByDoc?._id ?? fallbackUserId;

    acc.push({
      entry: normalizedEntry as unknown as ICatalogEntry,
      linkedAt: link.addedAt,
      addedBy,
    });

    return acc;
  }, []);
};

const resolveImageUrl = (url: unknown, req: Request): string | undefined => {
  if (!url) return undefined;
  const urlString = String(url);
  if (!urlString) return undefined;

  if (/^https?:\/\//i.test(urlString)) {
    return urlString;
  }

  const baseUrl = process.env.MEDIA_BASE_URL?.trim()
    || `${req.protocol}://${req.get('host')}`;

  try {
    return new URL(urlString, baseUrl).toString();
  } catch (error) {
    logger.warn('Failed to resolve image URL, returning original value', {
      url: urlString,
      baseUrl,
      error,
    });
    return urlString;
  }
};

export class CatalogController {
  async createCatalog(
    req: Request<unknown, unknown, CreateCatalogRequest>,
    res: Response<CatalogResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user!;

      const catalog = await catalogModel.createCatalog(user._id, req.body);

      res.status(201).json({
        message: 'Catalog created successfully',
        data: { catalog },
      });
    } catch (error) {
      logger.error('Failed to create catalog:', error);

      if (error instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({
          message: 'Invalid catalog data',
        });
      }

      if ((error as { code?: number }).code === 11000) {
        return res.status(409).json({
          message: 'Catalog with the same name already exists',
        });
      }

      next(error);
    }
  }

  async listCatalogs(
    req: Request,
    res: Response<CatalogListResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user!;

      const catalogs = await catalogModel.listCatalogs(user._id);

      res.status(200).json({
        message: 'Catalogs fetched successfully',
        data: { catalogs },
      });
    } catch (error) {
      logger.error('Failed to fetch catalogs:', error);
      next(error);
    }
  }

  async getCatalogById(
    req: Request<{ catalogId: string }>,
    res: Response<CatalogResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { catalogId } = req.params;

      const catalog = await catalogModel.findById(catalogId);

      if (!catalog) {
        return res.status(404).json({
          message: 'Catalog not found',
        });
      }

      const isOwner = catalog.owner.equals(user._id);
      const share = isOwner
        ? null
        : await catalogShareModel.getUserAccess(catalog._id, user._id);

      if (!isOwner && !share) {
        return res.status(403).json({
          message: 'You do not have access to this catalog',
        });
      }

      let entries: CatalogEntryLinkResponse[] = [];
      if (isOwner || share?.role) {
        const links = await catalogEntryLinkModel.listEntriesWithDetails(catalog._id);
        entries = serializeCatalogLinks(links, user._id).map(entry => ({
          ...entry,
          entry: {
            ...entry.entry,
            imageUrl: resolveImageUrl((entry.entry as unknown as { imageUrl?: unknown }).imageUrl, req),
          } as unknown as ICatalogEntry,
        }));
      }

      res.status(200).json({
        message: 'Catalog fetched successfully',
        data: {
          catalog,
          entries,
        },
      });
    } catch (error) {
      logger.error('Failed to fetch catalog:', error);
      next(error);
    }
  }

  async updateCatalog(
    req: Request<{ catalogId: string }, unknown, UpdateCatalogRequest>,
    res: Response<CatalogResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { catalogId } = req.params;

      const catalog = await catalogModel.findById(catalogId);
      if (!catalog) {
        return res.status(404).json({
          message: 'Catalog not found',
        });
      }

      if (!catalog.owner.equals(user._id)) {
        return res.status(403).json({
          message: 'Only the owner can update this catalog',
        });
      }

      const updatedCatalog = await catalogModel.updateCatalog(
        catalogId,
        user._id,
        req.body
      );

      if (!updatedCatalog) {
        return res.status(404).json({
          message: 'Catalog not found',
        });
      }

      res.status(200).json({
        message: 'Catalog updated successfully',
        data: { catalog: updatedCatalog },
      });
    } catch (error) {
      logger.error('Failed to update catalog:', error);

      if ((error as { code?: number }).code === 11000) {
        return res.status(409).json({
          message: 'Catalog with the same name already exists',
        });
      }

      next(error);
    }
  }

  async deleteCatalog(
    req: Request<{ catalogId: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { catalogId } = req.params;

      const catalog = await catalogModel.findById(catalogId);
      if (!catalog) {
        return res.status(404).json({
          message: 'Catalog not found',
        });
      }

      if (!catalog.owner.equals(user._id)) {
        return res.status(403).json({
          message: 'Only the owner can delete this catalog',
        });
      }

      const deleted = await catalogModel.deleteCatalog(catalogId, user._id);

      if (!deleted) {
        return res.status(404).json({
          message: 'Catalog not found',
        });
      }

      res.status(200).json({
        message: 'Catalog deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete catalog:', error);
      next(error);
    }
  }

  async linkCatalogEntry(
    req: Request<{ catalogId: string; entryId: string }>,
    res: Response<CatalogResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { catalogId, entryId } = req.params;

      const catalog = await catalogModel.findById(catalogId);
      if (!catalog) {
        return res.status(404).json({
          message: 'Catalog not found',
        });
      }

      const isOwner = catalog.owner.equals(user._id);
      const share = isOwner
        ? null
        : await catalogShareModel.getUserAccess(catalog._id, user._id);

      const hasEditPermission = isOwner || (share?.role === 'editor');

      if (!hasEditPermission) {
        return res.status(403).json({
          message: 'You do not have permission to update entries in this catalog',
        });
      }

      const entry = await catalogRepository.findById(entryId);
      if (!entry) {
        return res.status(404).json({
          message: 'Observation entry not found',
        });
      }

      if (!entry.userId.equals(user._id)) {
        return res.status(403).json({
          message: 'You can only link entries that you created',
        });
      }

      const alreadyLinked = await catalogEntryLinkModel.isEntryLinked(
        catalog._id,
        entry._id
      );

      if (alreadyLinked) {
        return res.status(409).json({
          message: 'Entry already linked to this catalog',
        });
      }

      await catalogEntryLinkModel.linkEntry(catalog._id, entry._id, user._id);

      const links = await catalogEntryLinkModel.listEntriesWithDetails(catalog._id);
      const entries = serializeCatalogLinks(links, user._id).map(entry => ({
        ...entry,
        entry: {
          ...entry.entry,
          imageUrl: resolveImageUrl((entry.entry as unknown as { imageUrl?: unknown }).imageUrl, req),
        } as unknown as ICatalogEntry,
      }));

      res.status(200).json({
        message: 'Entry linked to catalog successfully',
        data: {
          catalog,
          entries,
        },
      });
    } catch (error) {
      logger.error('Failed to link catalog entry:', error);
      next(error);
    }
  }

  async unlinkCatalogEntry(
    req: Request<{ catalogId: string; entryId: string }>,
    res: Response<CatalogResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { catalogId, entryId } = req.params;

      const catalog = await catalogModel.findById(catalogId);
      if (!catalog) {
        return res.status(404).json({
          message: 'Catalog not found',
        });
      }

      const isOwner = catalog.owner.equals(user._id);
      const share = isOwner
        ? null
        : await catalogShareModel.getUserAccess(catalog._id, user._id);

      const hasEditPermission = isOwner || (share?.role === 'editor');

      if (!hasEditPermission) {
        return res.status(403).json({
          message: 'You do not have permission to remove entries from this catalog',
        });
      }

      const entryObjectId = new mongoose.Types.ObjectId(entryId);
      await catalogEntryLinkModel.unlinkEntry(catalog._id, entryObjectId);

      const links = await catalogEntryLinkModel.listEntriesWithDetails(catalog._id);
      const entries = serializeCatalogLinks(links, user._id).map(entry => ({
        ...entry,
        entry: {
          ...entry.entry,
          imageUrl: resolveImageUrl((entry.entry as unknown as { imageUrl?: unknown }).imageUrl, req),
        } as unknown as ICatalogEntry,
      }));

      res.status(200).json({
        message: 'Entry unlinked from catalog successfully',
        data: {
          catalog,
          entries,
        },
      });
    } catch (error) {
      logger.error('Failed to unlink catalog entry:', error);
      next(error);
    }
  }
}
