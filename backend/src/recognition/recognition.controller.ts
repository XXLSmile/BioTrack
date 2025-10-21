import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { recognitionService } from './recognition.service';
import { catalogRepository } from './catalog.model';
import { speciesRepository } from './species.model';
import { userModel } from '../user/user.model';
import logger from '../logger.util';
import { RecognitionImageResponse } from './recognition.types';

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
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          message: 'No image file provided. Please upload an image.',
        });
      }

      const { latitude, longitude } = req.body;

      // Recognize species using iNaturalist API
      logger.info('Processing image recognition request');
      const recognitionResult = await recognitionService.recognizeFromImage(
        req.file.buffer,
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
      const { latitude, longitude, notes } = req.body;

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

      // Save image to disk (for backwards compatibility and quick access)
      const IMAGES_DIR = path.join(__dirname, '../../uploads/images');
      if (!fs.existsSync(IMAGES_DIR)) {
        fs.mkdirSync(IMAGES_DIR, { recursive: true });
      }
      
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(req.file.originalname) || '.jpg';
      const filename = `${uniqueSuffix}${extension}`;
      const filepath = path.join(IMAGES_DIR, filename);
      
      // Write buffer to disk
      fs.writeFileSync(filepath, req.file.buffer);
      
      const imageUrl = `/uploads/images/${filename}`;

      // Create observation entry with image data stored in database
      const catalogEntry = await catalogRepository.create({
        userId: user._id.toString(),
        speciesId: species._id.toString(),
        imageUrl,
        imageData: req.file.buffer, // Save the actual image data to DB
        imageMimeType: req.file.mimetype, // Save the image MIME type
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        confidence: recognitionResult.confidence,
        notes,
      });

      // Update user stats
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

      logger.info(`Observation entry created: ${catalogEntry._id}`);

      return res.status(201).json({
        message: 'Species recognized and saved successfully',
        data: {
          entry: catalogEntry,
          recognition: recognitionResult,
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
}

export const recognitionController = new RecognitionController();
