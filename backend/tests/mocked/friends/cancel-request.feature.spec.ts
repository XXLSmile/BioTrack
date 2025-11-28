// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import mongoose from 'mongoose';

import {
  api,
  friendshipModelMock,
  logger,
  mockAuthMiddleware,
  resetAllMocks,
} from './test.utils';

describe('Mocked: API: cancel friend request flow', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Input: request not found, Expected status: 404', async () => {
    // Input: request not found
    // Expected status code: 404
    const userId = new mongoose.Types.ObjectId();
    const requestId = new mongoose.Types.ObjectId();
    friendshipModelMock.findById.mockResolvedValueOnce(null);
    mockAuthMiddleware(userId);

    const response = await api
      .delete(`/api/friends/requests/${requestId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(404);
    expect(response.body?.message).toMatch(/friend request not found/i);
  });

  test('Input: request lacks authenticated user, Expected status: 401', async () => {
    // Input: no authenticated user
    // Expected status code: 401
    const requestId = new mongoose.Types.ObjectId();
    mockAuthMiddleware(undefined);

    const response = await api.delete(`/api/friends/requests/${requestId}`);

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
  });

  test('Input: user is not requester, Expected status: 403', async () => {
    // Input: user is not requester
    // Expected status code: 403
    const userId = new mongoose.Types.ObjectId();
    const requestId = new mongoose.Types.ObjectId();
    friendshipModelMock.findById.mockResolvedValueOnce({
      _id: requestId,
      requester: new mongoose.Types.ObjectId(), // Different user
      status: 'pending',
    });
    mockAuthMiddleware(userId);

    const response = await api
      .delete(`/api/friends/requests/${requestId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
    expect(response.body?.message).toBe('You can only cancel requests you sent');
  });

  test('Input: request status is not pending, Expected status: 400', async () => {
    // Input: request status is not pending
    // Expected status code: 400
    const userId = new mongoose.Types.ObjectId();
    const requestId = new mongoose.Types.ObjectId();
    friendshipModelMock.findById.mockResolvedValueOnce({
      _id: requestId,
      requester: userId,
      status: 'accepted', // Not pending
    });
    mockAuthMiddleware(userId);

    const response = await api
      .delete(`/api/friends/requests/${requestId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(400);
    expect(response.body?.message).toBe('Only pending requests can be cancelled');
  });

  test('Input: valid requester canceling pending request, Expected status: 200', async () => {
    // Input: valid requester canceling pending request
    // Expected status code: 200
    // Expected behavior: deletes friendship
    const userId = new mongoose.Types.ObjectId();
    const requestId = new mongoose.Types.ObjectId();
    friendshipModelMock.findById.mockResolvedValueOnce({
      _id: requestId,
      requester: userId,
      status: 'pending',
    });
    friendshipModelMock.deleteFriendship.mockResolvedValueOnce(true);
    mockAuthMiddleware(userId);

    const response = await api
      .delete(`/api/friends/requests/${requestId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('Friend request cancelled successfully');
    expect(friendshipModelMock.deleteFriendship).toHaveBeenCalledWith(requestId);
  });

  test('Input: persistence throws error, Expected status: 500', async () => {
    // Input: persistence throws error
    // Expected behavior: controller logs error and forwards to next
    // Expected output: 500 internal server error
    const userId = new mongoose.Types.ObjectId();
    const requestId = new mongoose.Types.ObjectId();
    const error = new Error('cancel fail');
    friendshipModelMock.findById.mockRejectedValueOnce(error);
    mockAuthMiddleware(userId);

    const response = await api
      .delete(`/api/friends/requests/${requestId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
    expect(logger.error).toHaveBeenCalledWith('Failed to cancel friend request:', error);
  });
});

