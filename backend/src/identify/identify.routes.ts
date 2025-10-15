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
 * GET /api/identify/observations
 * Get user's saved observations (requires auth)
 */
router.get(
  '/observations',
  authenticateToken,
  identifyController.getUserObservations
);

export default router;

