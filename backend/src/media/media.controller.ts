import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import logger from '../logger.util';
import { MediaService } from '../media/media.service';
import { UploadImageRequest, UploadImageResponse } from '../media/media.types';
import { sanitizeInput } from '../sanitizeInput.util';
import { identifyService } from '../identify/identify.service';

export class MediaController {
  async uploadImage(
    req: Request<unknown, unknown, UploadImageRequest>,
    res: Response<UploadImageResponse>,
    next: NextFunction
  ) {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: 'No file uploaded',
        });
      }

      const user = req.user!;
      const sanitizedFilePath = sanitizeInput(req.file.path);

      // Save image reference to DB
      const image = await MediaService.saveImage(
        sanitizedFilePath,
        user._id.toString()
      );

      // Identify species using the image file
      const imageBuffer = fs.readFileSync(sanitizedFilePath);
      const identification = await identifyService.identifyFromImage(imageBuffer);

      logger.info(
        `Identification result: ${identification.species.commonName || identification.species.scientificName
        } (confidence: ${identification.confidence})`
      );

      // Return both image and identification
      res.status(200).json({
        message: 'Image uploaded and identified successfully',
        data: {
          image,
          identification,
        },
      });
    } catch (error) {
      logger.error('Error uploading or identifying image:', error);

      if (error instanceof Error) {
        return res.status(500).json({
          message: error.message || 'Failed to upload or identify image',
        });
      }

      next(error);
    }
  }
}
