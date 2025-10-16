import { Router } from 'express';
import { identifyController } from './identify.controller';
import { upload } from '../storage';
import { authenticateToken } from '../auth/auth.middleware';

const router = Router();

/**
 * POST /api/identify
 * Identify species from uploaded image (no auth required for quick identification)
 */
router.post(
  '/',
  upload.single('image'),
  identifyController.identifyImage
);

/**
 * POST /api/identify/save
 * Identify species and save as observation (requires auth)
 */
router.post(
  '/save',
  authenticateToken,
  upload.single('image'),
  identifyController.identifyAndSave
);

/**
 * GET /api/catalog
 * Get user's saved catalog entries (requires auth)
 */
router.get(
  '/catalog',
  authenticateToken,
  identifyController.getUserCatalog
);

export default router;

