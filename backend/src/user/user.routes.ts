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

router.get('/check-username', userController.checkUsernameAvailability);

router.get('/search', userController.searchUsers);

router.get('/username/:username', userController.getUserByUsername);

router.get('/profile/:username', userController.getUserByName);

router.get('/name/:username', userController.getUserByName);

router.get('/:userId', userController.getUserById);

router.post('/favorite-species', userController.addFavoriteSpecies);

router.post('/update-fcm-token', userController.updateFcmToken);

router.delete('/favorite-species', userController.removeFavoriteSpecies);

export default router;
