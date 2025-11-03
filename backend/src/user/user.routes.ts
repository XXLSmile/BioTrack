import { Router } from 'express';
import type { NextFunction } from 'express';

import { UserController } from './user.controller';
import { UpdateProfileRequest, updateProfileSchema } from './user.types';
import { validateBody } from '../validation.middleware';

const router = Router();
const userController = new UserController();

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

const getProfile = wrapController(userController.getProfile.bind(userController));
const updateProfile = wrapController(userController.updateProfile.bind(userController));
const deleteProfile = wrapController(userController.deleteProfile.bind(userController));
const getUserStats = wrapController(userController.getUserStats.bind(userController));
const checkUsername = wrapController(userController.checkUsernameAvailability.bind(userController));
const searchUsers = wrapController(userController.searchUsers.bind(userController));
const getUserByUsername = wrapController(userController.getUserByUsername.bind(userController));
const getUserByName = wrapController(userController.getUserByName.bind(userController));
const getUserId = wrapController(userController.getUserById.bind(userController));
const addFavoriteSpecies = wrapController(userController.addFavoriteSpecies.bind(userController));
const updateFcmToken = wrapController(userController.updateFcmToken.bind(userController));
const clearFcmToken = wrapController(userController.clearFcmToken.bind(userController));
const removeFavoriteSpecies = wrapController(userController.removeFavoriteSpecies.bind(userController));

router.get('/profile', getProfile);

router.post('/profile', validateBody<UpdateProfileRequest>(updateProfileSchema), updateProfile);

router.delete('/profile', deleteProfile);

// BioTrack specific routes
router.get('/stats', getUserStats);

router.get('/check-username', checkUsername);

router.get('/search', searchUsers);

router.get('/username/:username', getUserByUsername);

router.get('/profile/:username', getUserByName);

router.get('/name/:username', getUserByName);

router.get('/:userId', getUserId);

router.post('/favorite-species', addFavoriteSpecies);

router.post('/update-fcm-token', updateFcmToken);
router.delete('/fcm-token', clearFcmToken);

router.delete('/favorite-species', removeFavoriteSpecies);

export default router;
