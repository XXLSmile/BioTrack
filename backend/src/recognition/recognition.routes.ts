import { Router } from 'express';
import type { NextFunction } from 'express';
import { recognitionController } from './recognition.controller';
import { uploadMemory } from '../storage';
import { authenticateToken } from '../auth/auth.middleware';

const router = Router();

type ReqOf<T> = T extends (req: infer Req, res: any, next: any) => any ? Req : never;
type ResOf<T> = T extends (req: any, res: infer Res, next: any) => any ? Res : never;

const wrapController = <T extends (req: any, res: any, next: NextFunction) => any>(fn: T) => {
  return (req: ReqOf<T>, res: ResOf<T>, next: NextFunction): void => {
    const maybePromise = fn(req, res, next);
    if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === 'function') {
      void (maybePromise as Promise<unknown>).catch(next);
    }
  };
};

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
  uploadMemory.single('image'),
  recognizeImage
);

/**
 * POST /api/recognition/save
 * Recognize species and save as observation (requires auth)
 */
router.post(
  '/save',
  authenticateToken,
  uploadMemory.single('image'),
  recognizeAndSave
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
