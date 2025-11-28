// @ts-nocheck
import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../../../src/core/app';
import { friendshipModel } from '../../../src/models/friends/friend.model';
import { userModel } from '../../../src/models/user/user.model';
import { geocodingService } from '../../../src/services/location/geocoding.service';
import { messaging } from '../../../src/config/firebase';
import logger from '../../../src/utils/logger.util';

export const app = createApp();
export const api = request(app);

// Mock external dependencies
jest.mock('../../../src/config/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

jest.mock('../../../src/utils/logger.util', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/models/friends/friend.model', () => ({
  friendshipModel: {
    getFriendsForUser: jest.fn(),
    getPendingForUser: jest.fn(),
    getOutgoingForUser: jest.fn(),
    findRequestBetween: jest.fn(),
    createRequest: jest.fn(),
    findById: jest.fn(),
    updateRequestStatus: jest.fn(),
    deleteFriendship: jest.fn(),
    getAcceptedFriendshipsForUsers: jest.fn(),
    getRelationshipsForUser: jest.fn(),
  },
}));

jest.mock('../../../src/models/user/user.model', () => ({
  userModel: {
    findById: jest.fn(),
    findByGoogleId: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    incrementFriendCount: jest.fn(),
    decrementFriendCount: jest.fn(),
  },
}));

jest.mock('../../../src/services/location/geocoding.service', () => ({
  geocodingService: {
    forwardGeocode: jest.fn(),
  },
}));

// Mock auth middleware module
let mockUserId: mongoose.Types.ObjectId | undefined;
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  authenticateToken: jest.fn((req: any, res: any, next: any) => {
    if (!mockUserId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    req.user = { _id: mockUserId };
    next();
  }),
}));

export const mockAuthMiddleware = (userId: mongoose.Types.ObjectId | undefined) => {
  mockUserId = userId;
};

export const friendshipModelMock = friendshipModel as unknown as Record<string, jest.Mock>;
export const userModelMock = userModel as unknown as Record<string, jest.Mock>;
export const geocodingServiceMock = geocodingService as unknown as Record<string, jest.Mock>;
export const messagingMock = messaging as unknown as { send: jest.Mock };
export { logger };

export const createPopulatedUser = (
  id: mongoose.Types.ObjectId,
  overrides: Partial<{
    name: string | null;
    username: string | null;
    profilePicture: string | null;
    location?: string | null;
    region?: string | null;
    favoriteSpecies?: string[];
  }> = {}
) => ({
  _id: id,
  name: overrides.name ?? null,
  username: overrides.username ?? null,
  profilePicture: overrides.profilePicture ?? null,
  location: overrides.location ?? null,
  region: overrides.region ?? null,
  favoriteSpecies: overrides.favoriteSpecies ?? [],
  equals(value: mongoose.Types.ObjectId) {
    return id.equals(value);
  },
});

export const resetAllMocks = () => {
  jest.clearAllMocks();
  Object.values(friendshipModelMock).forEach(mock => mock.mockReset?.());
  Object.values(userModelMock).forEach(mock => mock.mockReset?.());
  Object.values(geocodingServiceMock).forEach(mock => mock.mockReset?.());
  mockUserId = undefined;
};

