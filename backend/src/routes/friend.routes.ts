import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { friendController } from '../controllers/friend.controller';
import {
  createFriendRequestSchema,
  respondFriendRequestSchema,
} from '../types/friend.types';
import { validateBody } from '../middlewares/validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticateToken);

router.get('/', asyncHandler(friendController.listFriends.bind(friendController)));

router.get(
  '/recommendations',
  asyncHandler(friendController.getRecommendations.bind(friendController))
);

router.get('/requests', asyncHandler(friendController.listRequests.bind(friendController)));

router.post(
  '/requests',
  validateBody(createFriendRequestSchema),
  asyncHandler(friendController.sendRequest.bind(friendController))
);

router.patch(
  '/requests/:requestId',
  validateBody(respondFriendRequestSchema),
  asyncHandler(friendController.respondToRequest.bind(friendController))
);

router.delete('/:friendshipId', asyncHandler(friendController.removeFriend.bind(friendController)));
router.delete(
  '/requests/:requestId',
  asyncHandler(friendController.cancelRequest.bind(friendController))
);

export default router;
