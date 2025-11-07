import { Router } from 'express';

import { AuthController } from './auth.controller';
import { AuthenticateUserRequest, authenticateUserSchema } from '../auth/auth.types';
import { validateBody } from '../validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const authController = new AuthController();

router.post(
  '/signup',
  validateBody<AuthenticateUserRequest>(authenticateUserSchema),
  asyncHandler(authController.signUp.bind(authController))
);

router.post(
  '/signin',
  validateBody(authenticateUserSchema),
  asyncHandler(authController.signIn.bind(authController))
);

router.post('/logout', asyncHandler(authController.logout.bind(authController)));

export default router;
