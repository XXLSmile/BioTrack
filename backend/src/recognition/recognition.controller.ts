import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';

import { recognitionService } from './recognition.service';
import { catalogRepository } from './catalog.model';
import { speciesRepository } from './species.model';
import { userModel } from '../user/user.model';
import logger from '../logger.util';
import { RecognitionImageResponse } from './recognition.types';
import { catalogModel } from '../catalog/catalog.model';
import { catalogEntryLinkModel } from '../catalog/catalogEntryLink.model';
import { catalogShareModel } from '../catalog/catalogShare.model';
import { buildCatalogEntriesResponse } from '../catalog/catalog.helpers';
import { emitCatalogEntriesUpdated } from '../socket/socket.manager';

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
    try {
      const body = req.body as Record<string, string | undefined>;
      const latitude = body.latitude;
      const longitude = body.longitude;
      const imageUrl = body.imageUrl ?? body.image_url;

      if (!req.file && !imageUrl) {
        return res.status(400).json({
          message: 'Provide an image file or an imageUrl to perform recognition.',
        });
      }

      logger.info('Processing image recognition request');

      const recognitionResult = imageUrl
        ? await recognitionService.recognizeFromUrl(imageUrl)
        : await recognitionService.recognizeFromImage(
            req.file!.buffer,
            latitude ? parseFloat(latitude) : undefined,
            longitude ? parseFloat(longitude) : undefined
          );

      return res.status(200).json({
        message: 'Species recognized successfully',
        data: recognitionResult,
      });
    } catch (error) {
      logger.error('Error in recognizeImage controller:', error);

      if (error instanceof Error) {
        if (error.message.includes('No species recognized')) {
          return res.status(404).json({
            message: 'Could not recognize any species from the image. Try a clearer photo.',
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
      if (!req.file) {
        return res.status(400).json({
          message: 'No image file provided.',
        });
      }

      const user = req.user!;
      const { latitude, longitude, notes, catalogId } = req.body;

      // Recognize species
      const recognitionResult = await recognitionService.recognizeFromImage(
        req.file.buffer,
        latitude ? parseFloat(latitude) : undefined,
        longitude ? parseFloat(longitude) : undefined
      );

      // Get species from database
      const species = await speciesRepository.findOrCreate({
        inaturalistId: recognitionResult.species.id,
        scientificName: recognitionResult.species.scientificName,
        commonName: recognitionResult.species.commonName,
        rank: recognitionResult.species.rank,
        taxonomy: recognitionResult.species.taxonomy,
        wikipediaUrl: recognitionResult.species.wikipediaUrl,
        imageUrl: recognitionResult.species.imageUrl,
      });

      const imageHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

      // Create observation entry with image data stored in database
      let catalogToLink: { _id: mongoose.Types.ObjectId } | null = null;
      if (catalogId) {
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
        const hasEditPermission = isOwner || (share?.role === 'editor');

        if (!hasEditPermission) {
          return res.status(403).json({
            message: 'You do not have permission to modify this catalog',
          });
        }

        catalogToLink = { _id: catalog._id };
      }

      let catalogEntry = await catalogRepository.findByHash(
        user._id.toString(),
        imageHash
      );

      let isNewEntry = false;

      if (!catalogEntry) {
        // Save image to disk (for backwards compatibility and quick access)
        const IMAGES_DIR = path.join(__dirname, '../../uploads/images');
        if (!fs.existsSync(IMAGES_DIR)) {
          fs.mkdirSync(IMAGES_DIR, { recursive: true });
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const extension = path.extname(req.file.originalname) || '.jpg';
        const filename = `${uniqueSuffix}${extension}`;
        const filepath = path.join(IMAGES_DIR, filename);

        try {
          fs.writeFileSync(filepath, req.file.buffer);

          const imageUrl = `/uploads/images/${filename}`;

          catalogEntry = await catalogRepository.create({
            userId: user._id.toString(),
            speciesId: species._id.toString(),
            imageUrl,
            imageData: req.file.buffer, // Save the actual image data to DB
            imageMimeType: req.file.mimetype, // Save the image MIME type
            latitude: latitude ? parseFloat(latitude) : undefined,
            longitude: longitude ? parseFloat(longitude) : undefined,
            confidence: recognitionResult.confidence,
            notes,
            imageHash,
          });

          isNewEntry = true;
        } catch (error) {
          if ((error as { code?: number }).code === 11000) {
            catalogEntry = await catalogRepository.findByHash(
              user._id.toString(),
              imageHash
            );

            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
          } else {
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
            throw error;
          }
        }
      }

      if (!catalogEntry) {
        logger.error('Catalog entry could not be created or retrieved for hash', {
          userId: user._id.toString(),
          imageHash,
        });

        return res.status(500).json({
          message: 'Failed to save catalog entry',
        });
      }

      let linkedCatalogId: mongoose.Types.ObjectId | undefined;
      if (catalogToLink) {
        const alreadyLinked = await catalogEntryLinkModel.isEntryLinked(
          catalogToLink._id,
          catalogEntry._id
        );

        if (!alreadyLinked) {
          await catalogEntryLinkModel.linkEntry(
            catalogToLink._id,
            catalogEntry._id,
            user._id
          );

          try {
            const links = await catalogEntryLinkModel.listEntriesWithDetails(catalogToLink._id);
            const entries = buildCatalogEntriesResponse(links, user._id);
            emitCatalogEntriesUpdated(catalogToLink._id, entries, user._id);
          } catch (broadcastError) {
            logger.warn('Failed to broadcast catalog update after recognition save', {
              catalogId: catalogToLink._id.toString(),
              entryId: catalogEntry._id.toString(),
              error: broadcastError,
            });
          }
        }

        linkedCatalogId = catalogToLink._id;
      }

      if (isNewEntry) {
        // Update user stats only when a brand new entry is created
        await userModel.incrementObservationCount(user._id);

        // Check if this is a new species for this user
        const userCatalog = await catalogRepository.findByUserId(user._id.toString());
        const uniqueSpeciesIds = new Set(userCatalog.map(entry => entry.speciesId.toString()));
        const newSpeciesCount = uniqueSpeciesIds.size;

        // Award badges
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

      logger.info(`Observation entry created: ${catalogEntry._id}`);

      return res.status(201).json({
        message: 'Species recognized and saved successfully',
        data: {
          entry: catalogEntry,
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
      const user = req.user!;
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
      const user = req.user!;
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

  /**
   * GET /api/recognition/image/:entryId
   * Get image from database by catalog entry ID
   */
  async getImageFromDatabase(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { entryId } = req.params;
      
      if (!entryId) {
        return res.status(400).json({
          message: 'Entry ID is required',
        });
      }

      const entry = await catalogRepository.findById(entryId);

      if (!entry) {
        return res.status(404).json({
          message: 'Catalog entry not found',
        });
      }

      if (!entry.imageData) {
        return res.status(404).json({
          message: 'Image data not found in database. Image may only exist on disk.',
        });
      }

      // Set appropriate content type
      const contentType = entry.imageMimeType || 'image/jpeg';
      res.set('Content-Type', contentType);
      res.set('Content-Length', entry.imageData.length.toString());

      return res.send(entry.imageData);
    } catch (error) {
      logger.error('Error fetching image from database:', error);
      next(error);
    }
  }

  async deleteEntry(
    req: Request<{ entryId: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
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

      if (result === 'deleted' && affectedCatalogIds.length > 0) {
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
