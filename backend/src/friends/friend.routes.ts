import { Router } from 'express';
import type { NextFunction } from 'express';
import { authenticateToken } from '../auth/auth.middleware';
import { friendController } from './friend.controller';
import {
  createFriendRequestSchema,
  respondFriendRequestSchema,
} from './friend.types';
import { validateBody } from '../validation.middleware';

const router = Router();

router.use(authenticateToken);

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

const listFriends = wrapController(friendController.listFriends.bind(friendController));
const getRecommendations = wrapController(friendController.getRecommendations.bind(friendController));
const listRequests = wrapController(friendController.listRequests.bind(friendController));
const sendRequest = wrapController(friendController.sendRequest.bind(friendController));
const respondToRequest = wrapController(friendController.respondToRequest.bind(friendController));
const removeFriend = wrapController(friendController.removeFriend.bind(friendController));
const cancelRequest = wrapController(friendController.cancelRequest.bind(friendController));

router.get('/', listFriends);

router.get(
  '/recommendations',
  getRecommendations
);

router.get('/requests', listRequests);

router.post(
  '/requests',
  validateBody(createFriendRequestSchema),
  sendRequest
);

router.patch(
  '/requests/:requestId',
  validateBody(respondFriendRequestSchema),
  respondToRequest
);

router.delete('/:friendshipId', removeFriend);
router.delete('/requests/:requestId', cancelRequest);

export default router;
