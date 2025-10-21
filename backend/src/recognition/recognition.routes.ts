import { Router } from 'express';
import { recognitionController } from './recognition.controller';
import { uploadMemory } from '../storage';
import { authenticateToken } from '../auth/auth.middleware';

const router = Router();

/**
 * POST /api/recognition
 * Recognize species from uploaded image (no auth required for quick recognition)
 */
router.post(
  '/',
  uploadMemory.single('image'),
  recognitionController.recognizeImage
);

/**
 * POST /api/recognition/save
 * Recognize species and save as observation (requires auth)
 */
router.post(
  '/save',
  authenticateToken,
  uploadMemory.single('image'),
  recognitionController.recognizeAndSave
);

/**
 * GET /api/catalog
 * Get user's saved catalog entries (requires auth)
 */
router.get(
  '/catalog',
  authenticateToken,
  recognitionController.getUserCatalog
);

/**
 * GET /api/recognition/image/:entryId
 * Get image from database by catalog entry ID
 */
router.get(
  '/image/:entryId',
  recognitionController.getImageFromDatabase
);

export default router;
