import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { friendshipModel } from './friend.model';
import {
  CreateFriendRequest,
  createFriendRequestSchema,
  RespondFriendRequest,
  respondFriendRequestSchema,
} from './friend.types';
import { userModel } from '../user/user.model';
import logger from '../logger.util';
import { messaging } from "../firebase";

export class FriendController {
  async listFriends(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const friendships = await friendshipModel.getFriendsForUser(user._id);

      const friends = friendships
        .map(friendship => {
          const friendshipId = friendship._id as mongoose.Types.ObjectId;
          const requester = friendship.requester as
            | mongoose.Types.ObjectId
            | (mongoose.Document & { _id: mongoose.Types.ObjectId })
            | null;
          const addressee = friendship.addressee as
            | mongoose.Types.ObjectId
            | (mongoose.Document & { _id: mongoose.Types.ObjectId })
            | null;

          if (!requester || !addressee) {
            logger.warn('Encountered friendship with missing user reference', {
              friendshipId: friendshipId.toString(),
            });
            return null;
          }

          if (
            requester instanceof mongoose.Types.ObjectId ||
            addressee instanceof mongoose.Types.ObjectId
          ) {
            logger.warn('Friendship missing populated user data', {
              friendshipId: friendshipId.toString(),
            });
            return null;
          }

          const isRequester = requester._id.equals(user._id);
          const friendUser = isRequester ? addressee : requester;

          return {
            friendshipId,
            user: friendUser,
            since: friendship.respondedAt ?? friendship.createdAt,
          };
        })
        .filter((friend): friend is NonNullable<typeof friend> => friend !== null);

      res.status(200).json({
        message: 'Friends fetched successfully',
        data: { friends, count: friends.length },
      });
    } catch (error) {
      logger.error('Failed to list friends:', error);
      next(error);
    }
  }

  async listRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { type } = req.query;

      if (type === 'outgoing') {
        const outgoing = await friendshipModel.getOutgoingForUser(user._id);
        return res.status(200).json({
          message: 'Outgoing friend requests fetched successfully',
          data: { requests: outgoing, count: outgoing.length },
        });
      }

      const incoming = await friendshipModel.getPendingForUser(user._id);
      return res.status(200).json({
        message: 'Incoming friend requests fetched successfully',
        data: { requests: incoming, count: incoming.length },
      });
    } catch (error) {
      logger.error('Failed to list friend requests:', error);
      next(error);
    }
  }

  async sendRequest(
    req: Request<unknown, unknown, CreateFriendRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const body = createFriendRequestSchema.parse(req.body);
      const targetId = new mongoose.Types.ObjectId(body.targetUserId);

      if (targetId.equals(user._id)) {
        return res.status(400).json({
          message: 'You cannot send a friend request to yourself',
        });
      }

      const targetUser = await userModel.findById(targetId);
      if (!targetUser) {
        return res.status(404).json({
          message: 'Target user not found',
        });
      }

      const existing = await friendshipModel.findRequestBetween(user._id, targetId);
      if (existing) {
        if (existing.status === 'pending') {
          return res.status(409).json({
            message: 'Friend request already pending',
          });
        }

        if (existing.status === 'accepted') {
          return res.status(409).json({
            message: 'You are already friends with this user',
          });
        }
      }

      const request = await friendshipModel.createRequest(user._id, targetId);
      // Send FCM notification to target user if they have an FCM token
      if (targetUser.fcmToken) {
        try {
          await messaging.send({
            token: targetUser.fcmToken,
            notification: {
              title: "New Friend Request 🎉",
              body: `${user.name || user.username} sent you a friend request!`,
            },
            data: {
              type: "FRIEND_REQUEST_RECEIVED",
              requesterId: user._id.toString(),
            },
          });
          logger.info(`Sent friend request notification to ${targetUser.username}`);
        } catch (err) {
          logger.warn(`Failed to send FCM notification to ${targetUser.username}:`, err);
        }
      }

      res.status(201).json({
        message: 'Friend request sent successfully',
        data: { request },
      });
    } catch (error) {
      logger.error('Failed to send friend request:', error);
      next(error);
    }
  }



  async respondToRequest(
    req: Request<{ requestId: string }, unknown, RespondFriendRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { requestId } = req.params;
      const { action } = respondFriendRequestSchema.parse(req.body);

      const requestObjectId = new mongoose.Types.ObjectId(requestId);
      const request = await friendshipModel.findById(requestObjectId);

      if (!request) {
        return res.status(404).json({
          message: 'Friend request not found',
        });
      }

      if (!request.addressee.equals(user._id)) {
        return res.status(403).json({
          message: 'You are not allowed to respond to this request',
        });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({
          message: 'Friend request is no longer pending',
        });
      }

      const newStatus = action === 'accept' ? 'accepted' : 'declined';
      const requestObjectIdForUpdate = request._id as mongoose.Types.ObjectId;
      const updated = await friendshipModel.updateRequestStatus(
        requestObjectIdForUpdate,
        newStatus
      );

      if (!updated) {
        return res.status(500).json({
          message: 'Failed to update friend request',
        });
      }

      if (newStatus === 'accepted') {
        const requesterId = request.requester as mongoose.Types.ObjectId;
        const addresseeId = request.addressee as mongoose.Types.ObjectId;
        await userModel.incrementFriendCount(requesterId);
        await userModel.incrementFriendCount(addresseeId);

        const requesterUser = await userModel.findById(requesterId);
        const addresseeUser = await userModel.findById(addresseeId);
        // Send FCM notification to requester if they have an FCM token
        if (requesterUser?.fcmToken) {
          try {
            await messaging.send({
              token: requesterUser.fcmToken,
              notification: {
                title: "Friend Request Accepted ✅",
                body: `${addresseeUser?.name || addresseeUser?.username} accepted your friend request!`,
              },
              data: {
                type: "FRIEND_REQUEST_ACCEPTED",
                friendId: addresseeId.toString(),
              },
            });
            logger.info(`Sent acceptance notification to ${requesterUser.username}`);
          } catch (err) {
            logger.warn(`Failed to send FCM acceptance notification:`, err);
          }
        }
      }

      if (newStatus === 'declined') {
        await friendshipModel.deleteFriendship(requestObjectIdForUpdate);
      }

      res.status(200).json({
        message: `Friend request ${action}ed successfully`,
        data: {
          request: newStatus === 'declined' ? null : updated,
        },
      });
    } catch (error) {
      logger.error('Failed to respond to friend request:', error);
      next(error);
    }
  }

  async cancelRequest(
    req: Request<{ requestId: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { requestId } = req.params;
      const requestObjectId = new mongoose.Types.ObjectId(requestId);

      const request = await friendshipModel.findById(requestObjectId);

      if (!request) {
        return res.status(404).json({
          message: 'Friend request not found',
        });
      }

      if (!request.requester.equals(user._id)) {
        return res.status(403).json({
          message: 'You can only cancel requests you sent',
        });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({
          message: 'Only pending requests can be cancelled',
        });
      }

      await friendshipModel.deleteFriendship(requestObjectId);

      res.status(200).json({
        message: 'Friend request cancelled successfully',
      });
    } catch (error) {
      logger.error('Failed to cancel friend request:', error);
      next(error);
    }
  }

  async removeFriend(
    req: Request<{ friendshipId: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { friendshipId } = req.params;
      const friendshipObjectId = new mongoose.Types.ObjectId(friendshipId);

      const friendship = await friendshipModel.findById(friendshipObjectId);
      if (!friendship) {
        return res.status(404).json({
          message: 'Friendship not found',
        });
      }

      const isParticipant =
        friendship.requester.equals(user._id) ||
        friendship.addressee.equals(user._id);

      if (!isParticipant || friendship.status !== 'accepted') {
        return res.status(403).json({
          message: 'You are not allowed to remove this friendship',
        });
      }

      const requesterId = friendship.requester as mongoose.Types.ObjectId;
      const addresseeId = friendship.addressee as mongoose.Types.ObjectId;

      const otherUserId = requesterId.equals(user._id)
        ? addresseeId
        : requesterId;

      const friendshipIdForDeletion = friendship._id as mongoose.Types.ObjectId;
      await friendshipModel.deleteFriendship(friendshipIdForDeletion);
      await userModel.decrementFriendCount(user._id);
      await userModel.decrementFriendCount(otherUserId);

      res.status(200).json({
        message: 'Friend removed successfully',
      });
    } catch (error) {
      logger.error('Failed to remove friend:', error);
      next(error);
    }
  }
}

export const friendController = new FriendController();
