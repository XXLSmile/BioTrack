import { Request, Response, NextFunction } from 'express';
import { identifyService } from './identify.service';
import { observationRepository } from './observation.model';
import { speciesRepository } from './species.model';
import { userModel } from '../user/user.model';
import logger from '../logger.util';
import { IdentifyImageResponse } from './identify.types';

export class IdentifyController {
  /**
   * POST /api/identify
   * Identify species from uploaded image
   */
  async identifyImage(
    req: Request,
    res: Response<IdentifyImageResponse>,
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

      // Identify species using iNaturalist API
      logger.info('Processing image identification request');
      const identificationResult = await identifyService.identifyFromImage(
        req.file.buffer,
        latitude ? parseFloat(latitude) : undefined,
        longitude ? parseFloat(longitude) : undefined
      );

      return res.status(200).json({
        message: 'Species identified successfully',
        data: identificationResult,
      });
    } catch (error) {
      logger.error('Error in identifyImage controller:', error);

      if (error instanceof Error) {
        if (error.message.includes('No species identified')) {
          return res.status(404).json({
            message: 'Could not identify any species from the image. Try a clearer photo.',
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
   * POST /api/identify/save
   * Identify and save observation
   */
  async identifyAndSave(
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

      // Identify species
      const identificationResult = await identifyService.identifyFromImage(
        req.file.buffer,
        latitude ? parseFloat(latitude) : undefined,
        longitude ? parseFloat(longitude) : undefined
      );

      // Get species from database
      const species = await speciesRepository.findOrCreate({
        inaturalistId: identificationResult.species.id,
        scientificName: identificationResult.species.scientificName,
        commonName: identificationResult.species.commonName,
        rank: identificationResult.species.rank,
        taxonomy: identificationResult.species.taxonomy,
        wikipediaUrl: identificationResult.species.wikipediaUrl,
        imageUrl: identificationResult.species.imageUrl,
      });

      // Save image (in uploads folder)
      const imageUrl = `/uploads/${req.file.filename}`;

      // Create observation
      const observation = await observationRepository.create({
        userId: user._id.toString(),
        speciesId: species._id.toString(),
        imageUrl,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        confidence: identificationResult.confidence,
        notes,
      });

      // Update user stats
      await userModel.incrementObservationCount(user._id);
      
      // Check if this is a new species for this user
      const userObservations = await observationRepository.findByUserId(user._id.toString());
      const uniqueSpeciesIds = new Set(userObservations.map(obs => obs.speciesId.toString()));
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

      logger.info(`Observation created: ${observation._id}`);

      return res.status(201).json({
        message: 'Species identified and observation saved successfully',
        data: {
          observation,
          identification: identificationResult,
        },
      });
    } catch (error) {
      logger.error('Error in identifyAndSave controller:', error);
      next(error);
    }
  }

  /**
   * GET /api/identify/observations
   * Get user's observations
   */
  async getUserObservations(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const observations = await observationRepository.findByUserId(user._id.toString(), limit);

      return res.status(200).json({
        message: 'Observations fetched successfully',
        data: {
          observations,
          count: observations.length,
        },
      });
    } catch (error) {
      logger.error('Error fetching observations:', error);
      next(error);
    }
  }
}

export const identifyController = new IdentifyController();

