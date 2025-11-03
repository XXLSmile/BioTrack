import { Router } from 'express';
import type { NextFunction } from 'express';

import { AuthController } from './auth.controller';
import { AuthenticateUserRequest, authenticateUserSchema } from '../auth/auth.types';
import { validateBody } from '../validation.middleware';

const router = Router();
const authController = new AuthController();

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
