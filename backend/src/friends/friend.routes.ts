import { Router } from 'express';
import { authenticateToken } from '../auth/auth.middleware';
import { friendController } from './friend.controller';
import {
  createFriendRequestSchema,
  respondFriendRequestSchema,
} from './friend.types';
import { validateBody } from '../validation.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', friendController.listFriends.bind(friendController));

router.get('/requests', friendController.listRequests.bind(friendController));

router.post(
  '/requests',
  validateBody(createFriendRequestSchema),
  friendController.sendRequest.bind(friendController)
);

router.patch(
  '/requests/:requestId',
  validateBody(respondFriendRequestSchema),
  friendController.respondToRequest.bind(friendController)
);

router.delete('/:friendshipId', friendController.removeFriend.bind(friendController));

export default router;

