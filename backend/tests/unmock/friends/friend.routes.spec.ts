import { afterEach, describe, expect, jest, test } from '@jest/globals';
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../..', '.env') });

jest.mock('../../../src/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

jest.mock('../../../src/location/geocoding.service', () => ({
  geocodingService: {
    forwardGeocode: jest.fn(),
  },
}));

jest.mock('../../../src/user/user.model', () => {
  const mongoose = require('mongoose');

  type StoredUser = {
    _id: mongoose.Types.ObjectId;
    googleId: string;
    email: string;
    name: string;
    username: string;
    profilePicture?: string;
    favoriteSpecies: string[];
    location?: string | null;
    region?: string | null;
    friendCount: number;
    observationCount: number;
    speciesDiscovered: number;
    badges: string[];
    isPublicProfile: boolean;
  };

  const users = new Map<string, StoredUser>();
  const googleIndex = new Map<string, StoredUser>();

  const createUser = (info: { googleId: string; email: string; name: string; profilePicture?: string }) => {
    if (googleIndex.has(info.googleId)) {
      throw new Error('User already exists');
    }
    const _id = new mongoose.Types.ObjectId();
    const usernameBase = info.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const user: StoredUser = {
      _id,
      googleId: info.googleId,
      email: info.email,
      name: info.name,
      username: usernameBase,
      profilePicture: info.profilePicture,
      favoriteSpecies: [],
      location: null,
      region: null,
      friendCount: 0,
      observationCount: 0,
      speciesDiscovered: 0,
      badges: [],
      isPublicProfile: true,
    };
    users.set(_id.toString(), user);
    googleIndex.set(info.googleId, user);
    return { ...user };
  };

  const clone = (user: StoredUser | null | undefined) =>
    user ? { ...user, _id: user._id } : null;

  const api = {
    create: jest.fn(async (info: { googleId: string; email: string; name: string; profilePicture?: string }) =>
      createUser(info)
    ),
    findByGoogleId: jest.fn(async (googleId: string) => clone(googleIndex.get(googleId))),
    findById: jest.fn(async (id: mongoose.Types.ObjectId) => clone(users.get(id.toString()))),
    findMany: jest.fn(async () => []),
    incrementFriendCount: jest.fn(async (id: mongoose.Types.ObjectId) => {
      const user = users.get(id.toString());
      if (user) {
        user.friendCount += 1;
      }
    }),
    decrementFriendCount: jest.fn(async (id: mongoose.Types.ObjectId) => {
      const user = users.get(id.toString());
      if (user && user.friendCount > 0) {
        user.friendCount -= 1;
      }
    }),
  };

  (api as any).__getRaw = (id: mongoose.Types.ObjectId | string) =>
    users.get(id.toString()) ?? null;

  (api as any).__reset = () => {
    users.clear();
    googleIndex.clear();
    api.create.mockClear();
    api.findByGoogleId.mockClear();
    api.findById.mockClear();
    api.findMany.mockClear();
    api.incrementFriendCount.mockClear();
    api.decrementFriendCount.mockClear();
  };

  return { userModel: api };
});

jest.mock('../../../src/friends/friend.model', () => {
  const mongoose = require('mongoose');

  type StoredFriendship = {
    _id: mongoose.Types.ObjectId;
    requester: mongoose.Types.ObjectId;
    addressee: mongoose.Types.ObjectId;
    status: string;
    respondedAt?: Date;
    createdAt: Date;
  };

  const friendships = new Map<string, StoredFriendship>();

  const getUserClone = (user: any) => {
    if (!user) {
      return null;
    }
    const objectId =
      user._id instanceof mongoose.Types.ObjectId ? user._id : new mongoose.Types.ObjectId(user._id.toString());
    return {
      _id: objectId,
      name: user.name ?? null,
      username: user.username ?? null,
      profilePicture: user.profilePicture ?? null,
      location: user.location ?? null,
      region: user.region ?? null,
      favoriteSpecies: Array.isArray(user.favoriteSpecies) ? [...user.favoriteSpecies] : [],
      equals(other: mongoose.Types.ObjectId) {
        return objectId.equals(other);
      },
    };
  };

  const createRequest = (requesterId: mongoose.Types.ObjectId, addresseeId: mongoose.Types.ObjectId) => {
    const friendship: StoredFriendship = {
      _id: new mongoose.Types.ObjectId(),
      requester: requesterId,
      addressee: addresseeId,
      status: 'pending',
      createdAt: new Date(),
    };

    friendships.set(friendship._id.toString(), friendship);
    return { ...friendship };
  };

  const findById = async (id: mongoose.Types.ObjectId) => {
    const doc = friendships.get(id.toString());
    return doc ? { ...doc } : null;
  };

  const findBetween = (userA: mongoose.Types.ObjectId, userB: mongoose.Types.ObjectId) => {
    for (const friendship of friendships.values()) {
      const requesterId = friendship.requester.toString();
      const addresseeId = friendship.addressee.toString();
      if (
        (requesterId === userA.toString() && addresseeId === userB.toString()) ||
        (requesterId === userB.toString() && addresseeId === userA.toString())
      ) {
        return { ...friendship };
      }
    }
    return null;
  };

  const updateStatus = (requestId: mongoose.Types.ObjectId, status: string) => {
    const friendship = friendships.get(requestId.toString());
    if (!friendship) {
      return null;
    }
    friendship.status = status;
    friendship.respondedAt = new Date();
    return { ...friendship };
  };

  const deleteFriendship = (friendshipId: mongoose.Types.ObjectId) => {
    friendships.delete(friendshipId.toString());
  };

  const listByPredicate = (predicate: (friendship: StoredFriendship) => boolean) => {
    const { userModel } = require('../../../src/user/user.model');
    return Array.from(friendships.values())
      .filter(predicate)
      .map(friendship => ({
        ...friendship,
        requester: getUserClone(userModel.__getRaw(friendship.requester)),
        addressee: getUserClone(userModel.__getRaw(friendship.addressee)),
      }));
  };

  const api = {
    createRequest: jest.fn(async (requesterId: mongoose.Types.ObjectId, addresseeId: mongoose.Types.ObjectId) =>
      createRequest(requesterId, addresseeId)
    ),
    findRequestBetween: jest.fn(async (userA: mongoose.Types.ObjectId, userB: mongoose.Types.ObjectId) =>
      findBetween(userA, userB)
    ),
    getPendingForUser: jest.fn(async (userId: mongoose.Types.ObjectId) =>
      listByPredicate(friendship => friendship.addressee.equals(userId) && friendship.status === 'pending')
    ),
    getOutgoingForUser: jest.fn(async (userId: mongoose.Types.ObjectId) =>
      listByPredicate(friendship => friendship.requester.equals(userId) && friendship.status === 'pending')
    ),
    getFriendsForUser: jest.fn(async (userId: mongoose.Types.ObjectId) =>
      listByPredicate(
        friendship =>
          friendship.status === 'accepted' &&
          (friendship.requester.equals(userId) || friendship.addressee.equals(userId))
      )
    ),
    getAcceptedFriendshipsForUsers: jest.fn(async (userIds: mongoose.Types.ObjectId[]) => {
      const idSet = new Set(userIds.map(id => id.toString()));
      return Array.from(friendships.values())
        .filter(
          friendship =>
            friendship.status === 'accepted' &&
            (idSet.has(friendship.requester.toString()) || idSet.has(friendship.addressee.toString()))
        )
        .map(friendship => ({ ...friendship }));
    }),
    getRelationshipsForUser: jest.fn(async () => []),
    findById: jest.fn(findById),
    updateRequestStatus: jest.fn(async (requestId: mongoose.Types.ObjectId, status: string) =>
      updateStatus(requestId, status)
    ),
    deleteFriendship: jest.fn(async (friendshipId: mongoose.Types.ObjectId) => deleteFriendship(friendshipId)),
    deleteAllForUser: jest.fn(async () => []),
  };

  (api as any).__reset = () => {
    friendships.clear();
    Object.values(api).forEach(value => {
      if (typeof value === 'function' && (value as any)?.mockClear) {
        (value as any).mockClear();
      }
    });
  };

  return { friendshipModel: api };
});

jest.mock('google-auth-library', () => {
  class MockTicket {
    constructor(private payload: Record<string, unknown>) {}
    getPayload() {
      return this.payload;
    }
  }

  const decodeToken = (idToken: string) => {
    const [, payload] = idToken.split('.');
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  };

  const verifyIdToken = jest.fn(async ({ idToken }: { idToken: string }) => {
    const payload = decodeToken(idToken);
    return new MockTicket({
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    });
  });

  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken,
    })),
  };
});

import { friendController } from '../../../src/friends/friend.controller';
import { authService } from '../../../src/auth/auth.service';
import { userModel } from '../../../src/user/user.model';
import { friendshipModel } from '../../../src/friends/friend.model';
import { geocodingService } from '../../../src/location/geocoding.service';

const FRIEND_TOKEN_1 = process.env.FRIEND_TEST_USER1_ID_TOKEN;
const FRIEND_TOKEN_2 = process.env.FRIEND_TEST_USER2_ID_TOKEN;

const decodeTokenPayload = (token: string) => {
  const [, payload] = token.split('.');
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
};

const ensureUserExists = async (idToken: string) => {
  const payload = decodeTokenPayload(idToken);
  const googleId = payload.sub as string;
  let user = await userModel.findByGoogleId(googleId);

  if (!user) {
    user = await userModel.create({
      googleId,
      email: payload.email as string,
      name: payload.name as string,
      profilePicture: (payload.picture as string) ?? undefined,
    });
  }

  return user;
};

const signInAndGetAuth = async (idToken: string) => {
  await ensureUserExists(idToken);
  const result = await authService.signInWithGoogle(idToken);
  expect(result.token).toBeDefined();
  expect(result.user?._id).toBeDefined();
  return result;
};

const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const getPayload = (res: any) => ((res.json as jest.Mock).mock.calls[0]?.[0] ?? {}) as any;

describe('Unmocked: Friends controller (in-memory store)', () => {
  afterEach(() => {
    jest.clearAllMocks();
    const userModelMock = (jest.requireMock('../../../src/user/user.model') as any).userModel;
    const friendshipModelMock = (jest.requireMock('../../../src/friends/friend.model') as any).friendshipModel;
    if (typeof userModelMock.__reset === 'function') {
      userModelMock.__reset();
    }
    if (typeof friendshipModelMock.__reset === 'function') {
      friendshipModelMock.__reset();
    }
  });

  const missingTokens = !FRIEND_TOKEN_1 || !FRIEND_TOKEN_2;
  const describeMaybe = missingTokens ? describe.skip : describe;

  describeMaybe('friend lifecycle', () => {
    test('user can send, accept, and remove a friend request', async () => {
      const { user: userOne } = await signInAndGetAuth(FRIEND_TOKEN_1!);
      const { user: userTwo } = await signInAndGetAuth(FRIEND_TOKEN_2!);

      const sendReq: any = {
        user: userOne,
        body: { targetUserId: userTwo._id.toString() },
      };
      const sendRes = createMockResponse();
      const next = jest.fn();
      await friendController.sendRequest(sendReq, sendRes, next);
      expect(sendRes.status).toHaveBeenCalledWith(201);
      const requestPayload = getPayload(sendRes);
      const requestId =
        requestPayload?.data?.request?._id?.toString?.() ?? requestPayload?.data?.request?._id;
      expect(requestId).toBeDefined();

      const outgoingReq: any = {
        user: userOne,
        query: { type: 'outgoing' },
      };
      const outgoingRes = createMockResponse();
      await friendController.listRequests(outgoingReq, outgoingRes, next);
      expect(outgoingRes.status).toHaveBeenCalledWith(200);
      expect(getPayload(outgoingRes)?.data?.count).toBe(1);

      const incomingReq: any = {
        user: userTwo,
        query: {},
      };
      const incomingRes = createMockResponse();
      await friendController.listRequests(incomingReq, incomingRes, next);
      expect(incomingRes.status).toHaveBeenCalledWith(200);
      expect(getPayload(incomingRes)?.data?.count).toBe(1);

      const acceptReq: any = {
        user: userTwo,
        params: { requestId: requestId.toString() },
        body: { action: 'accept' },
      };
      const acceptRes = createMockResponse();
      await friendController.respondToRequest(acceptReq, acceptRes, next);
      expect(acceptRes.status).toHaveBeenCalledWith(200);
      const acceptedPayload = getPayload(acceptRes);
      const friendshipId =
        acceptedPayload?.data?.request?._id?.toString?.() ?? acceptedPayload?.data?.request?._id;
      expect(friendshipId).toBeDefined();

      const listFriendsReq: any = {
        user: userOne,
      };
      const listFriendsRes = createMockResponse();
      await friendController.listFriends(listFriendsReq, listFriendsRes, next);
      expect(listFriendsRes.status).toHaveBeenCalledWith(200);
      expect(getPayload(listFriendsRes)?.data?.count).toBe(1);

      const removeReq: any = {
        user: userOne,
        params: { friendshipId: friendshipId.toString() },
      };
      const removeRes = createMockResponse();
      await friendController.removeFriend(removeReq, removeRes, next);
      expect(removeRes.status).toHaveBeenCalledWith(200);

      const postRemovalRes = createMockResponse();
      await friendController.listFriends(listFriendsReq, postRemovalRes, next);
      expect(getPayload(postRemovalRes)?.data?.count).toBe(0);
    });
  });

  // API: GET /api/friends/recommendations
  // Input: in-memory users with mutual friends, shared species, and matching region
  // Expected status code: 200
  // Expected behavior: controller composes recommendation entry with score and metadata
  // Expected output: response data.recommendations contains candidate user
  test('getRecommendations surfaces mutual friend candidate without auth tokens', async () => {
    const makeEmail = () => `${new mongoose.Types.ObjectId().toString()}@example.com`;
    const alice = await userModel.create({
      googleId: `alice-${Date.now()}`,
      email: makeEmail(),
      name: 'Alice',
    });
    const bob = await userModel.create({
      googleId: `bob-${Date.now()}`,
      email: makeEmail(),
      name: 'Bob',
    });
    const carol = await userModel.create({
      googleId: `carol-${Date.now()}`,
      email: makeEmail(),
      name: 'Carol',
    });

    const userModelAny = userModel as any;
    const aliceRaw = userModelAny.__getRaw(alice._id);
    aliceRaw.favoriteSpecies = ['owl'];
    aliceRaw.location = 'Vancouver';
    aliceRaw.region = 'British Columbia';

    const bobRaw = userModelAny.__getRaw(bob._id);
    bobRaw.favoriteSpecies = ['sparrow'];
    bobRaw.location = 'Burnaby';
    bobRaw.region = 'British Columbia';

    const carolRaw = userModelAny.__getRaw(carol._id);
    carolRaw.favoriteSpecies = ['owl', 'falcon'];
    carolRaw.location = 'Burnaby';
    carolRaw.region = 'British Columbia';

    const requestAB = await friendshipModel.createRequest(alice._id, bob._id);
    await friendshipModel.updateRequestStatus(requestAB._id as mongoose.Types.ObjectId, 'accepted');

    const requestBC = await friendshipModel.createRequest(bob._id, carol._id);
    await friendshipModel.updateRequestStatus(requestBC._id as mongoose.Types.ObjectId, 'accepted');

    const findManyMock = userModel.findMany as unknown as jest.Mock;
    findManyMock.mockImplementation(async (...args: any[]) => {
      const [filter = {}, _projection = {}, options = {}] = (args as [
        Record<string, any> | undefined,
        Record<string, unknown> | undefined,
        { limit?: number } | undefined
      ]);
      const allRaw = [aliceRaw, bobRaw, carolRaw];
      const matches = allRaw.filter(raw => {
        if (!raw) {
          return false;
        }
          if (filter.isPublicProfile === true && raw.isPublicProfile === false) {
            return false;
          }
          if (filter._id?.$nin && filter._id.$nin.some((id: mongoose.Types.ObjectId) => id.equals(raw._id))) {
            return false;
          }
          if (filter._id?.$in && !filter._id.$in.some((id: mongoose.Types.ObjectId) => id.equals(raw._id))) {
            return false;
          }
          if (filter.favoriteSpecies?.$in) {
            const desired: string[] = filter.favoriteSpecies.$in;
            if (!raw.favoriteSpecies?.some((species: string) => desired.includes(species))) {
              return false;
            }
          }
          if (filter.region instanceof RegExp) {
            if (!filter.region.test(raw.region ?? '')) {
              return false;
            }
          }
          return true;
        });

      const limited = options.limit ? matches.slice(0, options.limit) : matches;
      return limited.map(raw => ({
        _id: raw._id,
        name: raw.name,
        username: raw.username,
        profilePicture: raw.profilePicture ?? null,
        favoriteSpecies: raw.favoriteSpecies ?? [],
        location: raw.location ?? null,
        region: raw.region ?? null,
      }));
    });

    const forwardGeocodeMock = geocodingService.forwardGeocode as unknown as jest.Mock;
    forwardGeocodeMock.mockImplementation(async (query: unknown) => {
      const normalized = String(query ?? '').toLowerCase();
      if (normalized.includes('vancouver')) {
        return { latitude: 49.2827, longitude: -123.1207 };
      }
      if (normalized.includes('burnaby')) {
        return { latitude: 49.2488, longitude: -122.9805 };
      }
      return undefined;
    });

    const req: any = {
      user: { _id: alice._id },
      query: { limit: '5' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await friendController.getRecommendations(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = getPayload(res);
    expect(payload?.data?.count).toBe(1);
    const recommendation = payload?.data?.recommendations?.[0];
    expect(recommendation?.user?.username).toBe(carol.username);
    expect(recommendation?.mutualFriends?.length).toBe(1);
    expect(recommendation?.sharedSpecies).toContain('owl');
    expect(recommendation?.score).toBeGreaterThan(0);
  });

  if (missingTokens) {
    test.skip('friend lifecycle (requires FRIEND_TEST_USER*_ID_TOKEN env vars)', () => undefined);
  }
});
