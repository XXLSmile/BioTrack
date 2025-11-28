// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import mongoose from 'mongoose';

import {
  api,
  friendshipModelMock,
  logger,
  mockAuthMiddleware,
  resetAllMocks,
  userModelMock,
} from './test.utils';

describe('Mocked: API: remove friend flow', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Input: friendship not found, Expected status: 404', async () => {
    // Input: friendship not found
    // Expected status code: 404
    const userId = new mongoose.Types.ObjectId();
    const friendshipId = new mongoose.Types.ObjectId();
    friendshipModelMock.findById.mockResolvedValueOnce(null);
    mockAuthMiddleware(userId);

    const response = await api
      .delete(`/api/friends/${friendshipId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(404);
    expect(response.body?.message).toMatch(/friendship not found/i);
  });

  test('Input: request lacks authenticated user, Expected status: 401', async () => {
    // Input: no authenticated user
    // Expected status code: 401
    const friendshipId = new mongoose.Types.ObjectId();
    mockAuthMiddleware(undefined);

    const response = await api.delete(`/api/friends/${friendshipId}`);

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
  });

  test('Input: user is not participant, Expected status: 403', async () => {
    // Input: user is not participant
    // Expected status code: 403
    const userId = new mongoose.Types.ObjectId();
    const friendshipId = new mongoose.Types.ObjectId();
    friendshipModelMock.findById.mockResolvedValueOnce({
      _id: friendshipId,
      requester: new mongoose.Types.ObjectId(), // Different user
      addressee: new mongoose.Types.ObjectId(), // Different user
      status: 'accepted',
    });
    mockAuthMiddleware(userId);

    const response = await api
      .delete(`/api/friends/${friendshipId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
    expect(response.body?.message).toBe('You are not allowed to remove this friendship');
  });

  test('Input: friendship status is not accepted, Expected status: 403', async () => {
    // Input: friendship status is not accepted
    // Expected status code: 403
    const userId = new mongoose.Types.ObjectId();
    const otherUser = new mongoose.Types.ObjectId();
    const friendshipId = new mongoose.Types.ObjectId();
    friendshipModelMock.findById.mockResolvedValueOnce({
      _id: friendshipId,
      requester: userId,
      addressee: otherUser,
      status: 'pending', // Not accepted
    });
    mockAuthMiddleware(userId);

    const response = await api
      .delete(`/api/friends/${friendshipId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
    expect(response.body?.message).toBe('You are not allowed to remove this friendship');
  });

  test('Input: valid user removing accepted friendship, Expected status: 200', async () => {
    // Input: valid user removing accepted friendship
    // Expected status code: 200
    // Expected behavior: deletes friendship and decrements friend count for both users
    const userId = new mongoose.Types.ObjectId();
    const otherUser = new mongoose.Types.ObjectId();
    const friendshipId = new mongoose.Types.ObjectId();
    friendshipModelMock.findById.mockResolvedValueOnce({
      _id: friendshipId,
      requester: userId,
      addressee: otherUser,
      status: 'accepted',
    });
    friendshipModelMock.deleteFriendship.mockResolvedValueOnce(true);
    userModelMock.decrementFriendCount.mockResolvedValueOnce(undefined);
    mockAuthMiddleware(userId);

    const response = await api
      .delete(`/api/friends/${friendshipId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.message).toMatch(/friend removed successfully/i);
    expect(friendshipModelMock.deleteFriendship).toHaveBeenCalledWith(friendshipId);
    expect(userModelMock.decrementFriendCount).toHaveBeenCalledWith(userId);
    expect(userModelMock.decrementFriendCount).toHaveBeenCalledWith(otherUser);
  });

  test('Input: repository throws while fetching friendship, Expected status: 500', async () => {
    // Input: repository throws while fetching friendship
    // Expected behavior: controller logs error and forwards to next
    // Expected output: 500 internal server error
    const userId = new mongoose.Types.ObjectId();
    const friendshipId = new mongoose.Types.ObjectId();
    const error = new Error('remove fail');
    friendshipModelMock.findById.mockRejectedValueOnce(error);
    mockAuthMiddleware(userId);

    const response = await api
      .delete(`/api/friends/${friendshipId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
    expect(logger.error).toHaveBeenCalledWith('Failed to remove friend:', error);
  });
});

