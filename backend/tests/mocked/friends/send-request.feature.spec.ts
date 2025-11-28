// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import mongoose from 'mongoose';

import {
  api,
  friendshipModelMock,
  logger,
  messagingMock,
  mockAuthMiddleware,
  resetAllMocks,
  userModelMock,
} from './test.utils';

describe('Mocked: API: send friend request flow', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Input: targetUserId identical to authenticated user, Expected status: 400', async () => {
    // Input: targetUserId identical to authenticated user's _id
    // Expected status code: 400
    // Expected behavior: controller blocks self-requests before calling persistence layer
    // Expected output: JSON message indicating self-request not allowed
    const userId = new mongoose.Types.ObjectId();
    mockAuthMiddleware(userId);

    const response = await api
      .post('/api/friends/requests')
      .set('Authorization', 'Bearer test-token')
      .send({ targetUserId: userId.toString() });

    expect(response.status).toBe(400);
    expect(response.body?.message).toMatch(/cannot send a friend request to yourself/i);
    expect(userModelMock.findById).not.toHaveBeenCalled();
  });

  test('Input: request lacks authenticated user, Expected status: 401', async () => {
    // Input: no authenticated user
    // Expected status code: 401
    mockAuthMiddleware(undefined);

    const response = await api
      .post('/api/friends/requests')
      .send({ targetUserId: new mongoose.Types.ObjectId().toString() });

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
  });

  test('Input: targetUserId belongs to non-existent user, Expected status: 404', async () => {
    // Input: targetUserId belongs to non-existent user
    // Expected status code: 404
    // Expected behavior: controller looks up addressee and exits when missing
    // Expected output: JSON envelope with "Target user not found"
    const userId = new mongoose.Types.ObjectId();
    const targetId = new mongoose.Types.ObjectId();
    userModelMock.findById.mockResolvedValueOnce(null);
    mockAuthMiddleware(userId);

    const response = await api
      .post('/api/friends/requests')
      .set('Authorization', 'Bearer test-token')
      .send({ targetUserId: targetId.toString() });

    expect(userModelMock.findById).toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.body?.message).toMatch(/target user not found/i);
  });

  test('Input: valid requester/target but existing pending friendship, Expected status: 409', async () => {
    // Input: valid requester/target but existing pending friendship already recorded
    // Expected status code: 409
    // Expected behavior: controller detects pending request and rejects duplicate
    // Expected output: JSON message "Friend request already pending"
    const userId = new mongoose.Types.ObjectId();
    const targetId = new mongoose.Types.ObjectId();
    userModelMock.findById.mockResolvedValue({ _id: targetId });
    friendshipModelMock.findRequestBetween.mockResolvedValue({ status: 'pending' });
    mockAuthMiddleware(userId);

    const response = await api
      .post('/api/friends/requests')
      .set('Authorization', 'Bearer test-token')
      .send({ targetUserId: targetId.toString() });

    expect(response.status).toBe(409);
    expect(response.body?.message).toMatch(/already pending/i);
  });

  test('Input: existing friendship already accepted, Expected status: 409', async () => {
    // Input: existing friendship already accepted
    // Expected status code: 409
    // Expected behavior: controller rejects duplicate friendship creation
    // Expected output: JSON body with "already friends" message
    const userId = new mongoose.Types.ObjectId();
    const targetId = new mongoose.Types.ObjectId();
    userModelMock.findById.mockResolvedValue({ _id: targetId });
    friendshipModelMock.findRequestBetween.mockResolvedValue({ status: 'accepted' });
    mockAuthMiddleware(userId);

    const response = await api
      .post('/api/friends/requests')
      .set('Authorization', 'Bearer test-token')
      .send({ targetUserId: targetId.toString() });

    expect(response.status).toBe(409);
    expect(response.body?.message).toMatch(/already friends/i);
  });

  test('Input: new requester/target pair, target has fcmToken, Expected status: 201', async () => {
    // Input: new requester/target pair, target has fcmToken
    // Expected status code: 201
    // Expected behavior: controller creates request and attempts to send FCM notification
    // Expected output: JSON payload containing created request document
    const requesterId = new mongoose.Types.ObjectId();
    const targetId = new mongoose.Types.ObjectId();
    userModelMock.findById.mockResolvedValue({
      _id: targetId,
      username: 'bob',
      fcmToken: 'token123',
    });
    friendshipModelMock.findRequestBetween.mockResolvedValue(null);
    const requestDoc = { _id: new mongoose.Types.ObjectId(), status: 'pending' };
    friendshipModelMock.createRequest.mockResolvedValue(requestDoc);
    messagingMock.send.mockResolvedValueOnce(undefined);
    mockAuthMiddleware(requesterId);

    const response = await api
      .post('/api/friends/requests')
      .set('Authorization', 'Bearer test-token')
      .send({ targetUserId: targetId.toString() });

    expect(friendshipModelMock.createRequest).toHaveBeenCalledWith(
      requesterId,
      expect.any(mongoose.Types.ObjectId)
    );
    expect(response.status).toBe(201);
    expect(messagingMock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'token123',
      })
    );
  });

  test('Input: target user has FCM token but messaging service rejects, Expected status: 201', async () => {
    // Input: target user has FCM token but messaging service rejects
    // Expected status code: 201
    // Expected behavior: controller logs warning and still returns success response
    // Expected output: JSON payload with created request; logger.warn called
    const requesterId = new mongoose.Types.ObjectId();
    const targetId = new mongoose.Types.ObjectId();
    userModelMock.findById.mockResolvedValue({
      _id: targetId,
      username: 'bob',
      fcmToken: 'token456',
    });
    friendshipModelMock.findRequestBetween.mockResolvedValue(null);
    friendshipModelMock.createRequest.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      status: 'pending',
    });
    messagingMock.send.mockRejectedValueOnce(new Error('push failure'));
    mockAuthMiddleware(requesterId);

    const response = await api
      .post('/api/friends/requests')
      .set('Authorization', 'Bearer test-token')
      .send({ targetUserId: targetId.toString() });

    expect(response.status).toBe(201);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send FCM notification to bob:'),
      expect.any(Error)
    );
  });

  test('Input: repository throws unexpected error, Expected status: 500', async () => {
    // Input: repository throws unexpected error
    // Expected behavior: controller logs error and forwards to next
    // Expected output: 500 internal server error
    const userId = new mongoose.Types.ObjectId();
    const targetId = new mongoose.Types.ObjectId();
    const error = new Error('create failed');
    userModelMock.findById.mockResolvedValue({ _id: targetId });
    friendshipModelMock.findRequestBetween.mockResolvedValue(null);
    friendshipModelMock.createRequest.mockRejectedValueOnce(error);
    mockAuthMiddleware(userId);

    const response = await api
      .post('/api/friends/requests')
      .set('Authorization', 'Bearer test-token')
      .send({ targetUserId: targetId.toString() });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
    expect(logger.error).toHaveBeenCalledWith('Failed to send friend request:', error);
  });
});

