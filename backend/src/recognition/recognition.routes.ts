import { Router } from 'express';
import type { NextFunction, RequestHandler } from 'express';
import { recognitionController } from './recognition.controller';
import { uploadMemory } from '../storage';
import { authenticateToken } from '../auth/auth.middleware';

const router = Router();

const wrapController = <Req, Res>(
  fn: (req: Req, res: Res, next: NextFunction) => unknown
) => {
  return (req: Req, res: Res, next: NextFunction): void => {
    const maybePromise = fn(req, res, next);
    if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === 'function') {
      void (maybePromise as Promise<unknown>).catch(next);
    }
  };
};

const uploadSingleImage: RequestHandler = uploadMemory.single('image');

const recognizeImage = wrapController(recognitionController.recognizeImage.bind(recognitionController));
const recognizeAndSave = wrapController(recognitionController.recognizeAndSave.bind(recognitionController));
const getUserCatalog = wrapController(recognitionController.getUserCatalog.bind(recognitionController));
const getRecentEntries = wrapController(recognitionController.getRecentEntries.bind(recognitionController));
const getImageFromDatabase = wrapController(recognitionController.getImageFromDatabase.bind(recognitionController));
const deleteEntry = wrapController(recognitionController.deleteEntry.bind(recognitionController));

/**
 * POST /api/recognition
 * Recognize species from uploaded image (no auth required for quick recognition)
 */
router.post(
  '/',
  uploadSingleImage,
  recognizeImage
);

/**
 * POST /api/recognition/save
 * Recognize species and save as observation (requires auth)
 */
router.post(
  '/save',
  authenticateToken,
  recognitionController.recognizeAndSave
);

/**
 * GET /api/catalog
 * Get user's saved catalog entries (requires auth)
 */
router.get(
  '/catalog',
  authenticateToken,
  getUserCatalog
);

router.get(
  '/recent',
  authenticateToken,
  getRecentEntries
);

/**
 * GET /api/recognition/image/:entryId
 * Get image from database by catalog entry ID
 */
router.get(
  '/image/:entryId',
  getImageFromDatabase
);

router.delete(
  '/entry/:entryId',
  authenticateToken,
  deleteEntry
);

export default router;
