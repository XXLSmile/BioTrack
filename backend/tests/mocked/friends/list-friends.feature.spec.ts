// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import mongoose from 'mongoose';

import {
  api,
  createPopulatedUser,
  friendshipModelMock,
  logger,
  mockAuthMiddleware,
  resetAllMocks,
} from './test.utils';

describe('Mocked: API: list friends flow', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Input: authenticated user with valid friendships, Expected status: 200', async () => {
    // Input: authenticated user with valid friendships
    // Expected status code: 200
    // Expected behavior: returns list of friends
    const userId = new mongoose.Types.ObjectId();
    const friendId = new mongoose.Types.ObjectId();
    const friendships = [
      {
        _id: new mongoose.Types.ObjectId(),
        requester: createPopulatedUser(userId, { name: 'Requester', username: 'requester' }),
        addressee: createPopulatedUser(friendId, { name: 'Friend', username: 'friend' }),
        respondedAt: new Date('2024-01-01T00:00:00Z'),
        createdAt: new Date('2023-12-30T00:00:00Z'),
      },
    ];
    friendshipModelMock.getFriendsForUser.mockResolvedValueOnce(friendships);
    mockAuthMiddleware(userId);

    const response = await api.get('/api/friends').set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(1);
    expect(friendshipModelMock.getFriendsForUser).toHaveBeenCalledWith(userId);
  });

  test('Input: friendships containing valid, null, and unpopulated entries, Expected status: 200', async () => {
    // Input: friendships containing valid, null, and unpopulated entries
    // Expected status code: 200
    // Expected behavior: controller filters out invalid friendships and logs warnings
    // Expected output: JSON response with exactly one friend entry
    const userId = new mongoose.Types.ObjectId();
    const friendId = new mongoose.Types.ObjectId();

    friendshipModelMock.getFriendsForUser.mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId(),
        requester: createPopulatedUser(userId, { name: 'Requester', username: 'requester' }),
        addressee: createPopulatedUser(friendId, { name: 'Friend', username: 'friend' }),
        respondedAt: new Date('2024-01-01T00:00:00Z'),
        createdAt: new Date('2023-12-30T00:00:00Z'),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        requester: null,
        addressee: null,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        requester: userId,
        addressee: friendId,
      },
    ]);

    mockAuthMiddleware(userId);

    const response = await api.get('/api/friends').set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('Input: thrown error while fetching friendships, Expected status: 500', async () => {
    // Input: thrown error while fetching friendships
    // Expected status code: 500
    // Expected behavior: controller forwards the error to error middleware
    // Expected output: 500 internal server error
    const userId = new mongoose.Types.ObjectId();
    const error = new Error('db fail');
    friendshipModelMock.getFriendsForUser.mockRejectedValueOnce(error);
    mockAuthMiddleware(userId);

    const response = await api.get('/api/friends').set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });

  test('Input: request lacks authenticated user, Expected status: 401', async () => {
    // Input: no authenticated user
    // Expected status code: 401
    mockAuthMiddleware(undefined);

    const response = await api.get('/api/friends');

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
    expect(friendshipModelMock.getFriendsForUser).not.toHaveBeenCalled();
  });
});

