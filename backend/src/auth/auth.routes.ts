import { Router } from 'express';
import type { NextFunction } from 'express';

import { AuthController } from './auth.controller';
import { AuthenticateUserRequest, authenticateUserSchema } from '../auth/auth.types';
import { validateBody } from '../validation.middleware';

const router = Router();
const authController = new AuthController();

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

const signUpHandler = wrapController(authController.signUp.bind(authController));
const signInHandler = wrapController(authController.signIn.bind(authController));
const logoutHandler = wrapController(authController.logout.bind(authController));

router.post(
  '/signup',
  validateBody<AuthenticateUserRequest>(authenticateUserSchema),
  signUpHandler
);

router.post(
  '/signin',
  validateBody(authenticateUserSchema),
  signInHandler
);

router.post('/logout', logoutHandler);

export default router;
