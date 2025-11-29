import { Request, Response, NextFunction } from 'express';
import type { Express } from 'express-serve-static-core';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Buffer } from 'node:buffer';
import axios from 'axios';

import { recognitionService } from '../services/recognition.service';
import { catalogRepository, ICatalogEntry } from '../models/recognition/catalog.model';
import { speciesRepository } from '../models/recognition/species.model';
import { userModel } from '../models/user/user.model';
import logger from '../utils/logger.util';
import { RecognitionImageResponse, RecognitionResult } from '../types/recognition.types';
import { catalogModel } from '../models/catalog/catalog.model';
import { catalogEntryLinkModel } from '../models/catalog/catalogEntryLink.model';
import { catalogShareModel } from '../models/catalog/catalogShare.model';
import { buildCatalogEntriesResponse, resolveImageUrl } from '../helpers/catalog.helpers';
import { emitCatalogEntriesUpdated } from '../infrastructure/socket.manager';
import { geocodingService } from '../services/location/geocoding.service';
import { ensurePathWithinRoot, resolveWithinRoot } from '../utils/pathSafe';
import {
  ensureDirSync,
  existsSync as safeExistsSync,
  readFileBufferSync,
  writeFileSync as safeWriteFileSync,
  renameSync as safeRenameSync,
  unlinkSync as safeUnlinkSync,
} from '../utils/safeFs';

interface RerunRecognitionResponse {
  message: string;
  data?: {
    entry: ICatalogEntry;
    recognition: RecognitionResult;
  };
}

const parseCoordinate = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }

    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const UPLOADS_ROOT = path.resolve(path.join(__dirname, '../../uploads'));

const ensureDirectoryExists = (directory: string): string => {
  const safeDirectory = ensurePathWithinRoot(UPLOADS_ROOT, directory);
  ensureDirSync(safeDirectory);
  return safeDirectory;
};

const saveUploadedFile = (
  file: Express.Multer.File,
  subDirectory: string
): { fullPath: string; relativePath: string; filename: string } => {
  const sanitizedSubDir = subDirectory.replace(/^\//, '');
  const directory = resolveWithinRoot(UPLOADS_ROOT, sanitizedSubDir);
  const safeDirectory = ensureDirectoryExists(directory);

  const originalName: string =
    typeof file.originalname === 'string' ? file.originalname : '';
  const rawExtension = path.extname(originalName).toLowerCase();
  const extension = rawExtension || '.jpg';
  const randomSuffix = crypto.randomBytes(16).toString('hex');
  const filename = `${randomSuffix}${extension}`;
  const fullPath = ensurePathWithinRoot(UPLOADS_ROOT, path.join(safeDirectory, filename));
  if (!Buffer.isBuffer(file.buffer)) {
    throw new Error('Uploaded file buffer is not available.');
  }
  const fileBuffer: Buffer = file.buffer;
  safeWriteFileSync(fullPath, fileBuffer);

  const relativePath = `/uploads/${sanitizedSubDir}/${filename}`;
  return { fullPath, relativePath, filename };
};

const buildAccessibleImageUrl = (relativePath: string, req: Request): string => {
  const normalized = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  const absoluteUrl = resolveImageUrl(normalized, {
    protocol: req.protocol,
    host: req.get('host') ?? undefined,
  });

  if (!absoluteUrl || !/^https?:\/\//i.test(absoluteUrl)) {
    throw new Error(
      'Unable to resolve public image URL. Ensure MEDIA_BASE_URL or host headers are configured.'
    );
  }

  return absoluteUrl;
};

const normalizeUploadsPath = (
  providedPath: string
): { relativePath: string; filename: string } => {
  const withoutOrigin = providedPath.replace(/^https?:\/\/[^/]+/i, '');
  const trimmed = withoutOrigin.trim();
  if (!trimmed) {
    throw new Error('Invalid image path provided.');
  }

  const prefixed = trimmed.startsWith('/uploads/')
    ? trimmed
    : trimmed.startsWith('uploads/')
      ? `/${trimmed}`
      : null;

  if (!prefixed) {
    throw new Error('Image path must reference the /uploads directory.');
  }

  const withinUploads = prefixed.replace(/^\/uploads\//, '');
  const normalized = path.posix.normalize(withinUploads);

  if (normalized.startsWith('..')) {
    throw new Error('Image path cannot traverse outside of uploads directory.');
  }

  const filename = path.posix.basename(normalized);
  if (!filename || filename === '.' || filename === '..') {
    throw new Error('Image path does not contain a valid filename.');
  }

  return {
    relativePath: normalized,
    filename,
  };
};

const generateUniqueFilename = (directory: string, filename: string): string => {
  const safeDirectory = ensurePathWithinRoot(UPLOADS_ROOT, directory);
  let candidate = path.basename(filename);
  const extension = path.extname(candidate);
  const baseName = path.basename(candidate, extension);
  let counter = 1;

  while (
    safeExistsSync(
      ensurePathWithinRoot(UPLOADS_ROOT, path.join(safeDirectory, candidate))
    )
  ) {
    candidate = `${baseName}-${counter}${extension}`;
    counter += 1;
  }

  return candidate;
};

const guessMimeType = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.bmp':
      return 'image/bmp';
    case '.heic':
      return 'image/heic';
    case '.jpeg':
    case '.jpg':
    default:
      return 'image/jpeg';
  }
};

const UNIDENTIFIED_SPECIES = {
  inaturalistId: -1,
  scientificName: 'Unidentified Species',
  commonName: 'Unidentified species',
  rank: 'species',
  taxonomy: 'Unknown',
};

const ensureUnidentifiedSpecies = () =>
  speciesRepository.findOrCreate({
    inaturalistId: UNIDENTIFIED_SPECIES.inaturalistId,
    scientificName: UNIDENTIFIED_SPECIES.scientificName,
    commonName: UNIDENTIFIED_SPECIES.commonName,
    rank: UNIDENTIFIED_SPECIES.rank,
    taxonomy: UNIDENTIFIED_SPECIES.taxonomy,
  });

export class RecognitionController {
  /**
   * POST /api/recognition
   * Recognize species from uploaded image
   */
  async recognizeImage(
    req: Request,
    res: Response<RecognitionImageResponse>,
    next: NextFunction
  ) {
    let savedImage:
      | { fullPath: string; relativePath: string; filename: string }
      | undefined;

    try {
      const body = req.body as Record<string, unknown>;
      const latitude = parseCoordinate(body.latitude);
      const longitude = parseCoordinate(body.longitude);
      const rawImageUrl = body.imageUrl ?? body.image_url;
      const imageUrl = typeof rawImageUrl === 'string' && rawImageUrl.trim().length > 0 ? rawImageUrl : undefined;

      if (!req.file && !imageUrl) {
        return res.status(400).json({
          message: 'Provide an image file or an imageUrl to perform recognition.',
        });
      }

      logger.info('Processing image recognition request');

      let recognitionResult;
      let absoluteImageUrl: string | undefined = imageUrl;

      if (imageUrl) {
        recognitionResult = await recognitionService.recognizeFromUrl(imageUrl);
      } else {
        if (!req.file) {
          return res.status(400).json({
            message: 'Provide an image file or an imageUrl to perform recognition.',
          });
        }

        savedImage = saveUploadedFile(req.file, 'tmp');
        absoluteImageUrl = buildAccessibleImageUrl(savedImage.relativePath, req);

        logger.info(`Invoking recognition service with image URL: ${absoluteImageUrl}`);
        recognitionResult = await recognitionService.recognizeFromUrl(absoluteImageUrl);
      }

      return res.status(200).json({
        message: 'Species recognized successfully',
        data: {
          recognition: recognitionResult,
          imagePath: savedImage?.relativePath,
          absoluteImageUrl,
          latitude,
          longitude,
        },
      });
    } catch (error) {
      if (savedImage?.fullPath) {
        try {
          if (safeExistsSync(savedImage.fullPath)) {
            safeUnlinkSync(savedImage.fullPath);
          }
        } catch (cleanupError) {
          logger.warn('Failed to clean up temporary upload after recognition error', {
            file: savedImage.fullPath,
            error: cleanupError instanceof Error ? cleanupError.message : cleanupError,
          });
        }
      }

      logger.error('Error in recognizeImage controller:', error);

      if (error instanceof Error) {
        if (error.message.includes('No species recognized')) {
          return res.status(404).json({
            message: 'Could not recognize any species. Try again later or save only.',
          });
        }

        if (error.message.includes('Rate limit')) {
          return res.status(429).json({
            message: error.message,
          });
        }

        if (error.message.includes('timed out')) {
          return res.status(504).json({
            message: 'Request timed out. Please try again.',
          });
        }
      }

      next(error);
    }
  }

  /**
   * POST /api/recognition/save
   * Recognize and save to catalog
   */
  async recognizeAndSave(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const {
        imagePath,
        recognition,
        catalogId,
        notes,
        latitude: rawLatitude,
        longitude: rawLongitude,
      } = req.body as Record<string, unknown>;

      const latitude = parseCoordinate(rawLatitude);
      const longitude = parseCoordinate(rawLongitude);

      if (typeof imagePath !== 'string' || imagePath.trim().length === 0) {
        return res.status(400).json({
          message: 'imagePath is required to save the recognition result.',
        });
      }

      if (typeof recognition !== 'object' || recognition === null) {
        return res.status(400).json({
          message: 'recognition payload is required.',
        });
      }

      interface RawSpecies {
        id?: unknown;
        scientificName?: unknown;
        commonName?: unknown;
        rank?: unknown;
        taxonomy?: unknown;
        wikipediaUrl?: unknown;
        imageUrl?: unknown;
      }

      const recognitionPayload = recognition as {
        species?: RawSpecies;
        confidence?: unknown;
        alternatives?: unknown;
      };

      const speciesPayload = recognitionPayload.species;
      if (
        !speciesPayload ||
        typeof speciesPayload.id !== 'number' ||
        typeof speciesPayload.scientificName !== 'string' ||
        typeof recognitionPayload.confidence !== 'number'
      ) {
        return res.status(400).json({
          message: 'recognition payload is missing required species information.',
        });
      }

      let formattedAlternatives: { scientificName: string; commonName?: string; confidence: number }[] | undefined;
      if (Array.isArray(recognitionPayload.alternatives)) {
        const accumulator: { scientificName: string; commonName?: string; confidence: number }[] = [];
        for (const candidate of recognitionPayload.alternatives as unknown[]) {
          if (!candidate || typeof candidate !== 'object') {
            continue;
          }
          const alternative = candidate as {
            scientificName?: unknown;
            commonName?: unknown;
            confidence?: unknown;
          };
          if (typeof alternative.scientificName !== 'string') {
            continue;
          }
          const alt: { scientificName: string; commonName?: string; confidence: number } = {
            scientificName: alternative.scientificName,
            confidence:
              typeof alternative.confidence === 'number' ? alternative.confidence : 0,
          };
          if (typeof alternative.commonName === 'string') {
            alt.commonName = alternative.commonName;
          }
          accumulator.push(alt);
        }
        if (accumulator.length > 0) {
          formattedAlternatives = accumulator;
        }
      }

      const recognitionResult: RecognitionResult = {
        species: {
          id: speciesPayload.id,
          scientificName: speciesPayload.scientificName,
          commonName:
            typeof speciesPayload.commonName === 'string'
              ? speciesPayload.commonName
              : undefined,
          rank:
            typeof speciesPayload.rank === 'string'
              ? speciesPayload.rank
              : 'species',
          taxonomy:
            typeof speciesPayload.taxonomy === 'string'
              ? speciesPayload.taxonomy
              : undefined,
          wikipediaUrl:
            typeof speciesPayload.wikipediaUrl === 'string'
              ? speciesPayload.wikipediaUrl
              : undefined,
          imageUrl:
            typeof speciesPayload.imageUrl === 'string'
              ? speciesPayload.imageUrl
              : undefined,
        },
        confidence: recognitionPayload.confidence,
        alternatives: formattedAlternatives,
      };

      const uploadsInfo = normalizeUploadsPath(imagePath);
      let activeRelativePath = uploadsInfo.relativePath;
      let currentFullPath = resolveWithinRoot(UPLOADS_ROOT, activeRelativePath);

      if (!safeExistsSync(currentFullPath)) {
        const relocatedRelativePath = path.posix.join('images', uploadsInfo.filename);
        const relocatedFullPath = resolveWithinRoot(UPLOADS_ROOT, relocatedRelativePath);

        if (safeExistsSync(relocatedFullPath)) {
          activeRelativePath = relocatedRelativePath;
          currentFullPath = relocatedFullPath;
        } else {
          return res.status(404).json({
            message: 'Uploaded image could not be found. Please run recognition again.',
          });
        }
      }

      const imageBuffer = readFileBufferSync(currentFullPath);
      const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

      const species = await speciesRepository.findOrCreate({
        inaturalistId: recognitionResult.species.id,
        scientificName: recognitionResult.species.scientificName,
        commonName: recognitionResult.species.commonName,
        rank: recognitionResult.species.rank,
        taxonomy: recognitionResult.species.taxonomy,
        wikipediaUrl: recognitionResult.species.wikipediaUrl,
        imageUrl: recognitionResult.species.imageUrl,
      });

      let catalogEntry = await catalogRepository.findByHash(
        user._id.toString(),
        imageHash
      );

      const locationInfo =
        latitude !== undefined && longitude !== undefined
          ? await geocodingService.reverseGeocode(latitude, longitude)
          : undefined;

      let isNewEntry = false;
      const toUploadsPath = (relativePath: string): string =>
        `/uploads/${relativePath.replace(/^\/+/, '')}`;
      let finalRelativePath = toUploadsPath(activeRelativePath);
      let persistedCatalogEntry: ICatalogEntry;

      if (!catalogEntry) {
        const imagesDir = ensureDirectoryExists(resolveWithinRoot(UPLOADS_ROOT, 'images'));

        let targetFilename = uploadsInfo.filename;
        if (!activeRelativePath.startsWith('images/')) {
          targetFilename = generateUniqueFilename(imagesDir, uploadsInfo.filename);
          const destinationPath = ensurePathWithinRoot(
            UPLOADS_ROOT,
            path.join(imagesDir, targetFilename)
          );
          safeRenameSync(currentFullPath, destinationPath);
          currentFullPath = destinationPath;
          activeRelativePath = path.posix.join('images', targetFilename);
          finalRelativePath = toUploadsPath(activeRelativePath);
        }

        const imageMimeType = guessMimeType(targetFilename);

        persistedCatalogEntry = await catalogRepository.create({
          userId: user._id.toString(),
          speciesId: species._id.toString(),
          imageUrl: finalRelativePath,
          imageData: imageBuffer,
          imageMimeType,
          latitude,
          longitude,
          city: locationInfo?.city,
          province: locationInfo?.province,
          confidence: recognitionResult.confidence,
          notes: typeof notes === 'string' ? notes : undefined,
          imageHash,
        });

        isNewEntry = true;
      } else {
        persistedCatalogEntry = catalogEntry;

        if (!activeRelativePath.startsWith('images/')) {
          const imagesDir = ensureDirectoryExists(resolveWithinRoot(UPLOADS_ROOT, 'images'));
          const targetFilename = generateUniqueFilename(imagesDir, uploadsInfo.filename);
          const destinationPath = ensurePathWithinRoot(
            UPLOADS_ROOT,
            path.join(imagesDir, targetFilename)
          );
          safeRenameSync(currentFullPath, destinationPath);
          currentFullPath = destinationPath;
          activeRelativePath = path.posix.join('images', targetFilename);
          finalRelativePath = toUploadsPath(activeRelativePath);
        }
      }

      let catalogToLink: { _id: mongoose.Types.ObjectId } | null = null;
      if (typeof catalogId === 'string' && catalogId.trim().length > 0) {
        if (!mongoose.Types.ObjectId.isValid(catalogId)) {
          return res.status(400).json({
            message: 'Invalid catalog ID',
          });
        }

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
        const hasEditPermission = isOwner || share?.role === 'editor';

        if (!hasEditPermission) {
          return res.status(403).json({
            message: 'You do not have permission to modify this catalog',
          });
        }

        catalogToLink = { _id: catalog._id };
      }

      let linkedCatalogId: mongoose.Types.ObjectId | undefined;
      if (catalogToLink) {
        const alreadyLinked = await catalogEntryLinkModel.isEntryLinked(
          catalogToLink._id,
          persistedCatalogEntry._id
        );

        if (!alreadyLinked) {
          await catalogEntryLinkModel.linkEntry(
            catalogToLink._id,
            persistedCatalogEntry._id,
            user._id
          );

          try {
            const links = await catalogEntryLinkModel.listEntriesWithDetails(catalogToLink._id);
            const entries = buildCatalogEntriesResponse(links, user._id, req);
            emitCatalogEntriesUpdated(catalogToLink._id, entries, user._id);
          } catch (broadcastError) {
            logger.warn('Failed to broadcast catalog update after recognition save', {
              catalogId: catalogToLink._id.toString(),
              entryId: persistedCatalogEntry._id.toString(),
              error: broadcastError,
            });
          }
        }

        linkedCatalogId = catalogToLink._id;
      }

      if (locationInfo) {
        let shouldSave = false;

        if (!persistedCatalogEntry.city && locationInfo.city) {
          persistedCatalogEntry.city = locationInfo.city;
          shouldSave = true;
        }

        if (!persistedCatalogEntry.province && locationInfo.province) {
          persistedCatalogEntry.province = locationInfo.province;
          shouldSave = true;
        }

        if (shouldSave) {
          await persistedCatalogEntry.save();
        }
      }

      if (isNewEntry) {
        await userModel.incrementObservationCount(user._id);

        const userCatalog = await catalogRepository.findByUserId(user._id.toString());
        const uniqueSpeciesIds = new Set(userCatalog.map(entry => entry.speciesId.toString()));
        const newSpeciesCount = uniqueSpeciesIds.size;

        if (newSpeciesCount === 1) {
          await userModel.addBadge(user._id, 'First Sighting');
        }
        if (newSpeciesCount === 10) {
          await userModel.addBadge(user._id, 'Explorer');
        }
        if (newSpeciesCount === 50) {
          await userModel.addBadge(user._id, 'Naturalist');
        }
      }

      logger.info(`Observation entry saved: ${persistedCatalogEntry._id.toString()}`);

      return res.status(201).json({
        message: 'Species recognized and saved successfully',
        data: {
          entry: persistedCatalogEntry,
          recognition: recognitionResult,
          linkedCatalogId,
        },
      });
    } catch (error) {
      logger.error('Error in recognizeAndSave controller:', error);
      next(error);
    }
  }

  /**
   * GET /api/catalog
   * Get user's catalog entries
   */
  async getUserCatalog(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const catalogEntries = await catalogRepository.findByUserId(user._id.toString(), limit);

      return res.status(200).json({
        message: 'Catalog entries fetched successfully',
        data: {
          entries: catalogEntries,
          count: catalogEntries.length,
        },
      });
    } catch (error) {
      logger.error('Error fetching catalog entries:', error);
      next(error);
    }
  }

  async getRecentEntries(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const entries = await catalogRepository.findRecentByUserId(user._id.toString(), limit);

      return res.status(200).json({
        message: 'Recent catalog entries fetched successfully',
        data: {
          entries,
          count: entries.length,
        },
      });
    } catch (error) {
      logger.error('Error fetching recent catalog entries:', error);
      next(error);
    }
  }

  async rerunEntryRecognition(
    req: Request<{ entryId: string }>,
    res: Response<RerunRecognitionResponse>,
    next: NextFunction
  ) {
    try {
      logger.info('Rerunning recognition for catalog entry');

      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { entryId } = req.params;
      if (!entryId) {
        return res.status(400).json({
          message: 'Entry ID is required',
        });
      }

      if (!mongoose.Types.ObjectId.isValid(entryId)) {
        return res.status(400).json({
          message: 'Invalid entry ID',
        });
      }

      const entry = await catalogRepository.findById(entryId);
      if (!entry) {
        return res.status(404).json({
          message: 'Catalog entry not found',
        });
      }

      const owningUserId =
        entry.userId instanceof mongoose.Types.ObjectId
          ? entry.userId
          : new mongoose.Types.ObjectId(entry.userId);

      if (!owningUserId.equals(user._id)) {
        return res.status(403).json({
          message: 'You do not have permission to re-run recognition for this entry',
        });
      }

      if (!entry.imageUrl) {
        return res.status(400).json({
          message: 'This entry is missing an image. Capture a new photo to run recognition.',
        });
      }

      let uploadsInfo: { relativePath: string; filename: string };
      try {
        uploadsInfo = normalizeUploadsPath(entry.imageUrl);
      } catch (pathError) {
        const message =
          pathError instanceof Error
            ? pathError.message
            : 'Unable to locate the stored image for this entry.';
        return res.status(400).json({ message });
      }

      const absoluteImagePath = resolveWithinRoot(UPLOADS_ROOT, uploadsInfo.relativePath);
      if (!safeExistsSync(absoluteImagePath)) {
        return res.status(404).json({
          message: 'Observation image could not be found. Please capture a new photo.',
        });
      }

      const normalizedRelativePath = `/uploads/${uploadsInfo.relativePath.replace(/^\/+/, '')}`;
      const accessibleImageUrl = buildAccessibleImageUrl(normalizedRelativePath, req);
      logger.info('Prepared uploads image for Zyla recognition', {
        entryId,
        relativePath: uploadsInfo.relativePath,
        filesystemPath: absoluteImagePath,
        absoluteUrl: accessibleImageUrl,
      });

      const recognitionResult = await recognitionService.recognizeFromUrl(accessibleImageUrl);
      const species = await speciesRepository.findOrCreate({
        inaturalistId: recognitionResult.species.id,
        scientificName: recognitionResult.species.scientificName,
        commonName: recognitionResult.species.commonName,
        rank: recognitionResult.species.rank,
        taxonomy: recognitionResult.species.taxonomy,
        wikipediaUrl: recognitionResult.species.wikipediaUrl,
        imageUrl: recognitionResult.species.imageUrl,
      });

      entry.speciesId = species._id;
      entry.confidence = recognitionResult.confidence;
      await entry.save();

      const refreshedEntry = await catalogRepository.findById(entryId);
      const responseEntry = refreshedEntry ?? entry;

      return res.status(200).json({
        message: 'Recognition rerun successfully',
        data: {
          entry: responseEntry,
          recognition: recognitionResult,
        },
      });
    } catch (error) {
      logger.error('Error rerunning recognition for entry:', error);
      if (axios.isAxiosError?.(error)) {
        return res.status(error.response?.status ?? 502).json({
          message: 'Failed to recognize species. Please try again later.',
        });
      }
      if (error instanceof Error && error.message === 'No species recognized from image') {
        return res.status(404).json({
          message: 'Recognition service could not identify this image. Please try again later.',
        });
      }
      return res.status(500).json({
        message: 'Failed to recognize species. Please try again later.',
      });
    }
  }

  async saveImageEntry(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    let savedImage:
      | { fullPath: string; relativePath: string; filename: string }
      | undefined;

    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      if (!req.file) {
        return res.status(400).json({
          message: 'Provide an image file to save as an observation.',
        });
      }

      const body = req.body as Record<string, unknown>;
      const latitude = parseCoordinate(body.latitude);
      const longitude = parseCoordinate(body.longitude);
      const notes = typeof body.notes === 'string' ? body.notes : undefined;

      savedImage = saveUploadedFile(req.file, 'tmp');
      const imageBuffer = readFileBufferSync(savedImage.fullPath);
      const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

      const existingEntry = await catalogRepository.findByHash(
        user._id.toString(),
        imageHash
      );
      if (existingEntry) {
        safeUnlinkSync(savedImage.fullPath);
        return res.status(200).json({
          message: 'This image is already saved as an observation.',
          data: { entry: existingEntry },
        });
      }

      const imagesDir = ensureDirectoryExists(resolveWithinRoot(UPLOADS_ROOT, 'images'));
      const targetFilename = generateUniqueFilename(imagesDir, savedImage.filename);
      const destinationPath = ensurePathWithinRoot(
        UPLOADS_ROOT,
        path.join(imagesDir, targetFilename)
      );
      safeRenameSync(savedImage.fullPath, destinationPath);
      const finalRelativePath = `/uploads/images/${targetFilename}`;
      const accessibleImageUrl = buildAccessibleImageUrl(finalRelativePath, req);

      const locationInfo =
        latitude !== undefined && longitude !== undefined
          ? await geocodingService.reverseGeocode(latitude, longitude)
          : undefined;

      const placeholderSpecies = await ensureUnidentifiedSpecies();
      const imageMimeType = guessMimeType(targetFilename);

      const entry = await catalogRepository.create({
        userId: user._id.toString(),
        speciesId: placeholderSpecies._id.toString(),
        imageUrl: finalRelativePath,
        imageData: imageBuffer,
        imageMimeType,
        latitude,
        longitude,
        city: locationInfo?.city,
        province: locationInfo?.province,
        confidence: 0,
        notes,
        imageHash,
      });

      await userModel.incrementObservationCount(user._id);
      const userCatalog = await catalogRepository.findByUserId(user._id.toString());
      const uniqueSpeciesIds = new Set(userCatalog.map(item => item.speciesId.toString()));
      const newSpeciesCount = uniqueSpeciesIds.size;

      if (newSpeciesCount === 1) {
        await userModel.addBadge(user._id, 'First Sighting');
      }
      if (newSpeciesCount === 10) {
        await userModel.addBadge(user._id, 'Explorer');
      }
      if (newSpeciesCount === 50) {
        await userModel.addBadge(user._id, 'Naturalist');
      }

      return res.status(201).json({
        message: 'Image saved successfully. Re-run recognition when ready.',
        data: {
          entry,
          imageUrl: accessibleImageUrl,
        },
      });
    } catch (error) {
      logger.error('Error saving image entry without recognition:', error);
      next(error);
    } finally {
      if (savedImage) {
        try {
          safeUnlinkSync(savedImage.fullPath);
        } catch {
          // ignore missing temp file
        }
      }
    }
  }

  async deleteEntry(
    req: Request<{ entryId: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const { entryId } = req.params;

      if (!entryId) {
        return res.status(400).json({
          message: 'Entry ID is required',
        });
      }

      if (!mongoose.Types.ObjectId.isValid(entryId)) {
        return res.status(400).json({
          message: 'Invalid entry ID',
        });
      }

      const entryObjectId = new mongoose.Types.ObjectId(entryId);
      const affectedCatalogIds = await catalogEntryLinkModel.listCatalogIdsForEntry(entryObjectId);

      const result = await catalogRepository.deleteById(entryId, user._id.toString());

      if (result === 'not_found') {
        return res.status(404).json({
          message: 'Catalog entry not found',
        });
      }

      if (result === 'forbidden') {
        return res.status(403).json({
          message: 'You do not have permission to delete this entry',
        });
      }

      if (affectedCatalogIds.length > 0) {
        for (const catalogId of affectedCatalogIds) {
          try {
            const links = await catalogEntryLinkModel.listEntriesWithDetails(catalogId);
            const entries = buildCatalogEntriesResponse(links, user._id);
            emitCatalogEntriesUpdated(catalogId, entries, user._id);
          } catch (emitError) {
            logger.warn('Failed to broadcast catalog update after entry deletion', {
              entryId,
              catalogId: catalogId.toString(),
              error: emitError,
            });
          }
        }
      }

      return res.status(200).json({
        message: 'Catalog entry deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting catalog entry:', error);
      next(error);
    }
  }
}

export const recognitionController = new RecognitionController();
