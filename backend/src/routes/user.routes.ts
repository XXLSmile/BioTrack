import { Router } from 'express';

import { UserController } from '../controllers/user.controller';
import { UpdateProfileRequest, updateProfileSchema } from '../types/user.types';
import { validateBody } from '../middlewares/validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const userController = new UserController();

router.get('/profile', asyncHandler(userController.getProfile.bind(userController)));

router.post(
  '/profile',
  validateBody<UpdateProfileRequest>(updateProfileSchema),
  asyncHandler(userController.updateProfile.bind(userController))
);

router.delete('/profile', asyncHandler(userController.deleteProfile.bind(userController)));

// BioTrack specific routes
router.get('/stats', asyncHandler(userController.getUserStats.bind(userController)));

router.get('/check-username', asyncHandler(userController.checkUsernameAvailability.bind(userController)));

router.get('/search', asyncHandler(userController.searchUsers.bind(userController)));

router.get('/username/:username', asyncHandler(userController.getUserByUsername.bind(userController)));

router.get('/profile/:username', asyncHandler(userController.getUserByUsername.bind(userController)));

router.get('/name/:username', asyncHandler(userController.getUserByName.bind(userController)));

router.get('/:userId', asyncHandler(userController.getUserById.bind(userController)));

router.post('/favorite-species', asyncHandler(userController.addFavoriteSpecies.bind(userController)));

router.post('/update-fcm-token', asyncHandler(userController.updateFcmToken.bind(userController)));
router.delete('/fcm-token', asyncHandler(userController.clearFcmToken.bind(userController)));

router.delete('/favorite-species', asyncHandler(userController.removeFavoriteSpecies.bind(userController)));

export default router;
