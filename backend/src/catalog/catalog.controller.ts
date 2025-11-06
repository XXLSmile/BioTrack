import { NextFunction, Request, Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import mongoose from 'mongoose';

import logger from '../logger.util';
import {
  CatalogEntryLinkResponse,
  CatalogListResponse,
  CatalogResponse,
  CreateCatalogRequest,
  createCatalogSchema,
  UpdateCatalogRequest,
} from './catalog.types';
import { catalogModel } from './catalog.model';
import { catalogShareModel } from './catalogShare.model';
import { catalogEntryLinkModel } from './catalogEntryLink.model';
import { catalogRepository } from '../recognition/catalog.model';
import { buildCatalogEntriesResponse } from './catalog.helpers';
import {
  emitCatalogDeleted,
  emitCatalogEntriesUpdated,
  emitCatalogMetadataUpdated,
} from '../socket/socket.manager';

export class CatalogController {
  async createCatalog(
    req: Request<ParamsDictionary, CatalogResponse, CreateCatalogRequest>,
    res: Response<CatalogResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const createPayload: CreateCatalogRequest = createCatalogSchema.parse(req.body);
      const catalog = await catalogModel.createCatalog(user._id, createPayload);

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
    req: Request<ParamsDictionary, CatalogListResponse>,
    res: Response<CatalogListResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

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
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
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
        entries = buildCatalogEntriesResponse(links, user._id, req);
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
    req: Request<{ catalogId: string }, CatalogResponse, UpdateCatalogRequest>,
    res: Response<CatalogResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
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

      emitCatalogMetadataUpdated(updatedCatalog, user._id);
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
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
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

      emitCatalogDeleted(catalogId, user._id);
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
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
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
      const entries = buildCatalogEntriesResponse(links, user._id, req);

      res.status(200).json({
        message: 'Entry linked to catalog successfully',
        data: {
          catalog,
          entries,
        },
      });

      emitCatalogEntriesUpdated(catalog._id, entries, user._id);
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
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
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
      const entries = buildCatalogEntriesResponse(links, user._id, req);

      res.status(200).json({
        message: 'Entry unlinked from catalog successfully',
        data: {
          catalog,
          entries,
        },
      });

      emitCatalogEntriesUpdated(catalog._id, entries, user._id);
    } catch (error) {
      logger.error('Failed to unlink catalog entry:', error);
      next(error);
    }
  }
}
