import { Router } from 'express';
import { recognitionController } from './recognition.controller';
import { uploadMemory } from '../storage';
import { authenticateToken } from '../auth/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * POST /api/recognition
 * Recognize species from uploaded image (no auth required for quick recognition)
 */
router.post(
  '/',
  uploadMemory.single('image'),
  asyncHandler(recognitionController.recognizeImage.bind(recognitionController))
);

/**
 * POST /api/recognition/save
 * Recognize species and save as observation (requires auth)
 */
router.post(
  '/save',
  authenticateToken,
  asyncHandler(recognitionController.recognizeAndSave.bind(recognitionController))
);

/**
 * GET /api/catalog
 * Get user's saved catalog entries (requires auth)
 */
router.get(
  '/catalog',
  authenticateToken,
  asyncHandler(recognitionController.getUserCatalog.bind(recognitionController))
);

router.get(
  '/recent',
  authenticateToken,
  asyncHandler(recognitionController.getRecentEntries.bind(recognitionController))
);

/**
 * GET /api/recognition/image/:entryId
 * Get image from database by catalog entry ID
 */
router.get(
  '/image/:entryId',
  asyncHandler(recognitionController.getImageFromDatabase.bind(recognitionController))
);

router.delete(
  '/entry/:entryId',
  authenticateToken,
  asyncHandler(recognitionController.deleteEntry.bind(recognitionController))
);

export default router;
