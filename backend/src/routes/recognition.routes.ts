import { Router, type RequestHandler } from 'express';
import { recognitionController } from '../controllers/recognition.controller';
import { uploadMemory } from '../config/storage';
import { authenticateToken } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const uploadRecognitionImage: RequestHandler = uploadMemory.single('image');

/**
 * POST /api/recognition
 * Recognize species from uploaded image (no auth required for quick recognition)
 */
router.post(
  '/',
  uploadRecognitionImage,
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

router.delete(
  '/entry/:entryId',
  authenticateToken,
  asyncHandler(recognitionController.deleteEntry.bind(recognitionController))
);

router.post(
  '/entry/:entryId/rerun',
  authenticateToken,
  asyncHandler(recognitionController.rerunEntryRecognition.bind(recognitionController))
);

export default router;
