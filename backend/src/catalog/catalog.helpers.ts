import { Request } from 'express';
import mongoose from 'mongoose';

import logger from '../logger.util';
import { CatalogEntryLinkResponse } from './catalog.types';
import { ICatalogEntry } from '../recognition/catalog.model';
import { ISpecies } from '../recognition/species.model';
import { ICatalogEntryLink } from './catalogEntryLink.model';

interface ImageContext {
  protocol?: string | null;
  host?: string | null;
}

const isExpressRequest = (value: unknown): value is Request => {
  return Boolean(value) && typeof value === 'object' && 'get' in (value as Record<string, unknown>);
};

const buildBaseUrl = (context?: ImageContext): string | undefined => {
  if (process.env.MEDIA_BASE_URL) {
    const trimmed = process.env.MEDIA_BASE_URL.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  if (context?.protocol && context?.host) {
    return `${context.protocol}://${context.host}`;
  }

  return undefined;
};

export const resolveImageUrl = (url: unknown, context?: ImageContext): string | undefined => {
  if (!url) {
    return undefined;
  }

  const urlString = String(url).trim();
  if (!urlString) {
    return undefined;
  }

  if (/^https?:\/\//i.test(urlString)) {
    return urlString;
  }

  const baseUrl = buildBaseUrl(context);

  if (!baseUrl) {
    return urlString;
  }

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
      imageUrl: rawEntry.imageUrl ?? speciesImageUrl,
    };

    const addedAtIso = link.addedAt instanceof Date ? link.addedAt.toISOString() : new Date(link.addedAt).toISOString();
    const entryId = (normalizedEntry as { _id?: mongoose.Types.ObjectId })._id?.toString() ?? '';
    const dedupeKey = `${entryId}::${addedAtIso}`;
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

export const buildCatalogEntriesResponse = (
  links: ICatalogEntryLink[],
  fallbackUserId: mongoose.Types.ObjectId,
  reqOrContext?: Request | ImageContext
): CatalogEntryLinkResponse[] => {
  const context: ImageContext | undefined = isExpressRequest(reqOrContext)
    ? {
        protocol: reqOrContext.protocol,
        host: reqOrContext.get('host'),
      }
    : reqOrContext;

  const serialized = serializeCatalogLinks(links, fallbackUserId);

  return serialized.map(entry => ({
    ...entry,
    entry: {
      ...entry.entry,
      imageUrl: resolveImageUrl((entry.entry as unknown as { imageUrl?: unknown }).imageUrl, context),
    } as unknown as ICatalogEntry,
  }));
};
