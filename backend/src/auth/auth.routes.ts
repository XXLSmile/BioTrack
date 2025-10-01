import { Router } from 'express';

import { AuthController } from './auth.controller';
import { AuthenticateUserRequest, authenticateUserSchema } from '../auth/auth.types';
import { validateBody } from '../validation.middleware';

const router = Router();
const authController = new AuthController();

router.post(
  '/signup',
  validateBody<AuthenticateUserRequest>(authenticateUserSchema),
  authController.signUp
);

router.post(
  '/signin',
  validateBody(authenticateUserSchema),
  authController.signIn
);

router.post('/logout', authController.logout);

export default router;
