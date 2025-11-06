import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { friendshipModel } from './friend.model';
import {
  CreateFriendRequest,
  createFriendRequestSchema,
  FriendRecommendation,
  RespondFriendRequest,
  respondFriendRequestSchema,
} from './friend.types';
import { userModel } from '../user/user.model';
import logger from '../logger.util';
import { messaging } from "../firebase";
import { IUser } from '../user/user.types';
import { geocodingService } from '../location/geocoding.service';

interface Coordinates {
  latitude: number;
  longitude: number;
}

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistanceKm = (a: Coordinates, b: Coordinates): number => {
  const R = 6371; // Earth radius in km
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
};

const LOCATION_DISTANCE_THRESHOLD_KM = 30;

const isPopulatedUser = (value: unknown): value is IUser & { _id: mongoose.Types.ObjectId } =>
  typeof value === 'object' &&
  value !== null &&
  '_id' in value &&
  (value as { _id: unknown })._id instanceof mongoose.Types.ObjectId;

export class FriendController {
  async listFriends(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }
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

  async getRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }
      const limit = req.query.limit ? Math.min(Math.max(parseInt(req.query.limit as string, 10) || 10, 1), 50) : 10;

      const currentUser = await userModel.findById(user._id);
      if (!currentUser) {
        return res.status(404).json({
          message: 'User profile not found',
        });
      }

      const userIdStr = user._id.toString();
      const friends = await friendshipModel.getFriendsForUser(user._id);

      const friendIds = new Set<string>();
      const friendDetails = new Map<string, { _id: mongoose.Types.ObjectId; name?: string | null; username?: string | null }>();

      for (const friendship of friends) {
        const isRequester = friendship.requester.equals(user._id);
        const friendCandidate = isRequester ? friendship.addressee : friendship.requester;
        const friendshipId =
          friendship._id instanceof mongoose.Types.ObjectId
            ? friendship._id
            : new mongoose.Types.ObjectId(String(friendship._id));

        if (!isPopulatedUser(friendCandidate)) {
          logger.warn('Friendship missing populated user data', {
            friendshipId: friendshipId.toString(),
          });
          continue;
        }

        const friendDoc = friendCandidate;
        const friendIdStr = friendDoc._id.toString();
        friendIds.add(friendIdStr);
        friendDetails.set(friendIdStr, {
          _id: friendDoc._id,
          name: typeof friendDoc.name === 'string' ? friendDoc.name : null,
          username: typeof friendDoc.username === 'string' ? friendDoc.username : null,
        });
      }

      const relationships = await friendshipModel.getRelationshipsForUser(user._id);
      const excludedIds = new Set<string>([userIdStr]);

      for (const relationship of relationships) {
        const requesterId = relationship.requester.toString();
        const addresseeId = relationship.addressee.toString();
        const otherId = requesterId === userIdStr ? addresseeId : requesterId;

        excludedIds.add(otherId);
      }

      friendIds.forEach(id => excludedIds.add(id));

      const toObjectIds = (ids: Iterable<string>) =>
        Array.from(ids).map(id => new mongoose.Types.ObjectId(id));

      interface CandidateAggregate {
        mutualFriendIds: Set<string>;
        sharedSpecies: Set<string>;
        locationMatch: boolean;
        distanceKm?: number;
        doc?: IUser;
      }

      const coordinateCache = new Map<string, Coordinates | null>();
      const buildAddressQuery = (doc: IUser): string | null => {
        const parts = [doc.location, doc.region]
          .map(value => (typeof value === 'string' ? value.trim() : ''))
          .filter(value => value.length > 0);

        if (parts.length === 0) {
          return null;
        }

        return parts.join(', ');
      };

      const resolveCoordinatesForDoc = async (doc: IUser): Promise<Coordinates | undefined> => {
        const query = buildAddressQuery(doc);
        if (!query) {
          return undefined;
        }

        const cacheKey = query.toLowerCase();
        if (coordinateCache.has(cacheKey)) {
          return coordinateCache.get(cacheKey) ?? undefined;
        }

        const result = await geocodingService.forwardGeocode(query);
        if (result) {
          const coords: Coordinates = {
            latitude: result.latitude,
            longitude: result.longitude,
          };
          coordinateCache.set(cacheKey, coords);
          return coords;
        }

        coordinateCache.set(cacheKey, null);
        return undefined;
      };

      const userCoordinates = await resolveCoordinatesForDoc(currentUser);

      const candidateData = new Map<string, CandidateAggregate>();
      const ensureCandidate = (candidateId: string): CandidateAggregate => {
        let entry = candidateData.get(candidateId);
        if (!entry) {
          entry = {
            mutualFriendIds: new Set<string>(),
            sharedSpecies: new Set<string>(),
            locationMatch: false,
            doc: undefined,
          };
          candidateData.set(candidateId, entry);
        }
        return entry;
      };

      // Friend-of-friend recommendations
      if (friendIds.size > 0) {
        const friendObjectIds = toObjectIds(friendIds);
        const networkFriendships = await friendshipModel.getAcceptedFriendshipsForUsers(friendObjectIds);

        for (const relation of networkFriendships) {
          const requesterId = relation.requester.toString();
          const addresseeId = relation.addressee.toString();

          let mutualFriendId: string | null = null;
          let candidateId: string | null = null;

          if (friendIds.has(requesterId) && requesterId !== userIdStr) {
            mutualFriendId = requesterId;
            candidateId = addresseeId;
          }

          if (friendIds.has(addresseeId) && addresseeId !== userIdStr) {
            mutualFriendId = addresseeId;
            candidateId = requesterId;
          }

          if (!candidateId || candidateId === userIdStr) {
            continue;
          }

          if (excludedIds.has(candidateId)) {
            continue;
          }

          if (mutualFriendId) {
            ensureCandidate(candidateId).mutualFriendIds.add(mutualFriendId);
          }
        }
      }

      const userFavorites = Array.isArray(currentUser.favoriteSpecies)
        ? currentUser.favoriteSpecies.filter(Boolean)
        : [];

      const excludedObjectIds = toObjectIds(excludedIds);

      if (userFavorites.length > 0) {
        const speciesMatches = await userModel.findMany(
          {
            _id: { $nin: excludedObjectIds },
            isPublicProfile: true,
            favoriteSpecies: { $in: userFavorites },
          },
          {
            name: 1,
            username: 1,
            profilePicture: 1,
            favoriteSpecies: 1,
            location: 1,
            region: 1,
          },
          { limit: limit * 5 }
        );

        for (const candidate of speciesMatches) {
          const candidateId = candidate._id.toString();
          if (excludedIds.has(candidateId)) {
            continue;
          }

          const shared = (candidate.favoriteSpecies ?? []).filter(species =>
            userFavorites.includes(species)
          );

          if (!shared.length) {
            continue;
          }

          const entry = ensureCandidate(candidateId);
          shared.forEach(species => entry.sharedSpecies.add(species));
          entry.doc = candidate;
        }
      }

      const normalizedRegion = currentUser.region?.trim();
      if (normalizedRegion) {
        const normalizedRegionLower = normalizedRegion.toLowerCase();
        const regionMatches = await userModel.findMany(
          {
            _id: { $nin: excludedObjectIds },
            isPublicProfile: true,
            $expr: {
              $eq: [
                {
                  $toLower: {
                    $ifNull: ['$region', ''],
                  },
                },
                normalizedRegionLower,
              ],
            },
          },
          {
            name: 1,
            username: 1,
            profilePicture: 1,
            favoriteSpecies: 1,
            location: 1,
            region: 1,
          },
          { limit: limit * 5 }
        );

        for (const candidate of regionMatches) {
          const candidateId = candidate._id.toString();
          if (excludedIds.has(candidateId)) {
            continue;
          }

          const entry = ensureCandidate(candidateId);
          entry.locationMatch = true;
          if (!entry.doc) {
            entry.doc = candidate;
          }
        }
      }

      // Fetch remaining candidate details
      const missingDocIds = Array.from(candidateData.entries())
        .filter(([, data]) => !data.doc)
        .map(([candidateId]) => candidateId);

      if (missingDocIds.length > 0) {
        const missingDocs = await userModel.findMany(
          {
            _id: { $in: toObjectIds(missingDocIds) },
            isPublicProfile: true,
          },
          {
            name: 1,
            username: 1,
            profilePicture: 1,
            favoriteSpecies: 1,
            location: 1,
            region: 1,
          }
        );

        for (const candidate of missingDocs) {
          const entry = candidateData.get(candidate._id.toString());
          if (entry && !entry.doc) {
            entry.doc = candidate;
          }
        }
      }

      const normalize = (value?: string | null) =>
        value ? value.trim().toLowerCase() : undefined;

      const normalizedUserRegion = normalize(currentUser.region);
      const normalizedUserLocation = normalize(currentUser.location);

      const toNullableString = (value: unknown): string | null =>
        typeof value === 'string' ? value : null;

      const isPopulatedFriend = (
        value: { _id: mongoose.Types.ObjectId; name?: string | null; username?: string | null } | undefined
      ): value is { _id: mongoose.Types.ObjectId; name?: string | null; username?: string | null } => Boolean(value);

      const recommendations: FriendRecommendation[] = [];

      for (const [candidateId, data] of candidateData) {
        const doc = data.doc;
        if (!doc) {
          continue;
        }

        if (!data.locationMatch) {
          const regionMatch =
            normalizedUserRegion &&
            normalize(doc.region) === normalizedUserRegion;
          const locationMatch =
            !regionMatch &&
            normalizedUserLocation &&
            normalize(doc.location) === normalizedUserLocation;
          data.locationMatch = Boolean(regionMatch || locationMatch);
        }

        const sharedSpecies = Array.from(data.sharedSpecies);
        const mutualFriends = Array.from(data.mutualFriendIds)
          .map(friendId => friendDetails.get(friendId))
          .filter(isPopulatedFriend)
          .slice(0, 5)
          .map(detail => ({
            _id: detail._id,
            name: typeof detail.name === 'string' ? detail.name : null,
            username: typeof detail.username === 'string' ? detail.username : null,
          }));

        let distanceKm: number | undefined;
        if (userCoordinates) {
          const candidateCoordinates = await resolveCoordinatesForDoc(doc);
          if (candidateCoordinates) {
            const distance = haversineDistanceKm(userCoordinates, candidateCoordinates);
            if (Number.isFinite(distance)) {
              const rounded = Math.round(distance * 10) / 10;
              distanceKm = rounded;
              const withinThreshold = rounded <= LOCATION_DISTANCE_THRESHOLD_KM;
              data.locationMatch = withinThreshold;
            }
          }
        }

        data.distanceKm = distanceKm;

        const score =
          data.mutualFriendIds.size * 3 +
          sharedSpecies.length * 2 +
          (data.locationMatch ? 1 : 0);

        if (score <= 0) {
          continue;
        }

        const favoriteSpeciesSample = (doc.favoriteSpecies ?? []).slice(0, 5);

        recommendations.push({
          user: {
            _id: doc._id,
            name: typeof doc.name === 'string' ? doc.name : null,
            username: typeof doc.username === 'string' ? doc.username : null,
            profilePicture: typeof doc.profilePicture === 'string' ? doc.profilePicture : null,
            location: typeof doc.location === 'string' ? doc.location : null,
            region: typeof doc.region === 'string' ? doc.region : null,
            favoriteSpecies: favoriteSpeciesSample,
          },
          mutualFriends,
          sharedSpecies: sharedSpecies.slice(0, 5),
          locationMatch: data.locationMatch,
          distanceKm: data.distanceKm,
          score,
        });
      }

      recommendations.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (b.mutualFriends.length !== a.mutualFriends.length) {
          return b.mutualFriends.length - a.mutualFriends.length;
        }
        if (b.sharedSpecies.length !== a.sharedSpecies.length) {
          return b.sharedSpecies.length - a.sharedSpecies.length;
        }
        return (a.user.username ?? '').localeCompare(b.user.username ?? '');
      });

      const limited = recommendations.slice(0, limit);

      res.status(200).json({
        message: 'Friend recommendations fetched successfully',
        data: {
          recommendations: limited.map(rec => ({
            user: {
              _id: rec.user._id.toString(),
              name: toNullableString(rec.user.name),
              username: toNullableString(rec.user.username),
              profilePicture: toNullableString(rec.user.profilePicture),
              location: toNullableString(rec.user.location),
              region: toNullableString(rec.user.region),
              favoriteSpecies: Array.isArray(rec.user.favoriteSpecies)
                ? rec.user.favoriteSpecies
                : [],
            },
            mutualFriends: rec.mutualFriends.map(mutual => ({
              _id: mutual._id.toString(),
              name: toNullableString(mutual.name),
              username: toNullableString(mutual.username),
            })),
            sharedSpecies: rec.sharedSpecies,
            locationMatch: rec.locationMatch,
            distanceKm: typeof rec.distanceKm === 'number' ? rec.distanceKm : null,
            score: rec.score,
          })),
          count: limited.length,
        },
      });
    } catch (error) {
      logger.error('Failed to compute friend recommendations:', error);
      next(error);
    }
  }

  async listRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }
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
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }
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
          const debugUsername =
            typeof targetUser.username === 'string' ? targetUser.username : 'unknown';
          const debugToken =
            typeof targetUser.fcmToken === 'string' ? targetUser.fcmToken : 'missing';
          logger.debug('Try sending FCM notification', `username=${debugUsername} token=${debugToken}`);

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
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }
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
        const requesterId = request.requester;
        const addresseeId = request.addressee;
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
                title: 'Friend Request Accepted ✅',
                body: `${addresseeUser?.name || addresseeUser?.username} accepted your friend request!`,
              },
              data: {
                type: 'FRIEND_REQUEST_ACCEPTED',
                friendId: addresseeId.toString(),
              },
            });

            logger.info(`Sent acceptance notification to ${requesterUser.username}`);
          } catch (err) {
            logger.warn('Failed to send FCM acceptance notification:', err);
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
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }
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
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }
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

      const requesterId = friendship.requester;
      const addresseeId = friendship.addressee;

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
