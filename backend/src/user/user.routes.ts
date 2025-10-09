import { Router } from 'express';

import { UserController } from './user.controller';
import { UpdateProfileRequest, updateProfileSchema } from './user.types';
import { validateBody } from '../validation.middleware';

const router = Router();
const userController = new UserController();

router.get('/profile', userController.getProfile);

router.post(
  '/profile',
  validateBody<UpdateProfileRequest>(updateProfileSchema),
  userController.updateProfile
);

router.delete('/profile', userController.deleteProfile);

// BioTrack specific routes
router.get('/stats', userController.getUserStats);

router.post('/favorite-species', userController.addFavoriteSpecies);

router.delete('/favorite-species', userController.removeFavoriteSpecies);

export default router;
