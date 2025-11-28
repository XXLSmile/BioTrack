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

describe('Mocked: API: receive and respond to friend requests flow', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // GET /api/friends/requests tests
  test('Input: type=outgoing query parameter, Expected status: 200', async () => {
    // Input: outgoing requests
    // Expected status code: 200
    // Expected behavior: controller returns outgoing requests
    // Expected output: JSON response with requested count
    const userId = new mongoose.Types.ObjectId();
    const outgoing = [{ _id: new mongoose.Types.ObjectId() }];
    friendshipModelMock.getOutgoingForUser.mockResolvedValueOnce(outgoing);
    mockAuthMiddleware(userId);

    const response = await api
      .get('/api/friends/requests?type=outgoing')
      .set('Authorization', 'Bearer test-token');

    expect(friendshipModelMock.getOutgoingForUser).toHaveBeenCalledWith(userId);
    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(1);
  });

  test('Input: default query (incoming requests), Expected status: 200', async () => {
    // Input: default query (incoming requests)
    // Expected status code: 200
    // Expected behavior: controller returns incoming pending requests
    // Expected output: JSON payload with incoming count
    const userId = new mongoose.Types.ObjectId();
    const incoming = [
      { _id: new mongoose.Types.ObjectId() },
      { _id: new mongoose.Types.ObjectId() },
    ];
    friendshipModelMock.getPendingForUser.mockResolvedValueOnce(incoming);
    mockAuthMiddleware(userId);

    const response = await api.get('/api/friends/requests').set('Authorization', 'Bearer test-token');

    expect(friendshipModelMock.getPendingForUser).toHaveBeenCalledWith(userId);
    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(2);
  });

  test('Input: repository throws error, Expected status: 500', async () => {
    // Input: repository throws error
    // Expected status code: 500
    // Expected behavior: controller forwards error to next handler
    // Expected output: 500 internal server error
    const userId = new mongoose.Types.ObjectId();
    const error = new Error('fetch failure');
    friendshipModelMock.getPendingForUser.mockRejectedValueOnce(error);
    mockAuthMiddleware(userId);

    const response = await api.get('/api/friends/requests').set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });

  test('Input: request lacks authenticated user for listRequests, Expected status: 401', async () => {
    // Input: no authenticated user
    // Expected status code: 401
    mockAuthMiddleware(undefined);

    const response = await api.get('/api/friends/requests');

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
  });

  // PATCH /api/friends/requests/:requestId tests
  test('Input: requestId referencing non-existent request, Expected status: 404', async () => {
    // Input: requestId referencing non-existent request
    // Expected status code: 404
    // Expected behavior: controller returns not found before updating
    // Expected output: JSON message "Friend request not found"
    const userId = new mongoose.Types.ObjectId();
    const requestId = new mongoose.Types.ObjectId();
    friendshipModelMock.findById.mockResolvedValueOnce(null);
    mockAuthMiddleware(userId);

    const response = await api
      .patch(`/api/friends/requests/${requestId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ action: 'accept' });

    expect(response.status).toBe(404);
    expect(response.body?.message).toMatch(/friend request not found/i);
  });

  test('Input: request lacks authenticated user for respondToRequest, Expected status: 401', async () => {
    // Input: no authenticated user
    // Expected status code: 401
    const requestId = new mongoose.Types.ObjectId();
    mockAuthMiddleware(undefined);

    const response = await api
      .patch(`/api/friends/requests/${requestId}`)
      .send({ action: 'accept' });

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
  });

  test('Input: updateRequestStatus returns null, Expected status: 500', async () => {
    // Input: updateRequestStatus returns null
    // Expected status code: 500
    // Expected behavior: controller returns internal server error
    const userId = new mongoose.Types.ObjectId();
    const addresseeId = new mongoose.Types.ObjectId();
    const requestId = new mongoose.Types.ObjectId();
    friendshipModelMock.findById.mockResolvedValueOnce({
      _id: requestId,
      requester: new mongoose.Types.ObjectId(),
      addressee: addresseeId,
      status: 'pending',
      equals: (value: mongoose.Types.ObjectId) => addresseeId.equals(value),
    });
    friendshipModelMock.updateRequestStatus.mockResolvedValueOnce(null);
    mockAuthMiddleware(addresseeId);

    const response = await api
      .patch(`/api/friends/requests/${requestId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ action: 'accept' });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Failed to update friend request');
  });

  test('Input: user not addressee, Expected status: 403', async () => {
    // Input: user not addressee
    // Expected status code: 403
    // Expected behavior: controller denies access
    const userId = new mongoose.Types.ObjectId();
    const addresseeId = new mongoose.Types.ObjectId();
    const requestId = new mongoose.Types.ObjectId();
    friendshipModelMock.findById.mockResolvedValueOnce({
      _id: requestId,
      requester: new mongoose.Types.ObjectId(),
      addressee: addresseeId,
      status: 'pending',
      equals: (value: mongoose.Types.ObjectId) => addresseeId.equals(value),
    });
    mockAuthMiddleware(userId);

    const response = await api
      .patch(`/api/friends/requests/${requestId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ action: 'accept' });

    expect(response.status).toBe(403);
    expect(response.body?.message).toBe('You are not allowed to respond to this request');
  });

  test('Input: request not pending, Expected status: 400', async () => {
    // Input: request not pending
    // Expected status code: 400
    // Expected behavior: controller rejects non-pending requests
    const addresseeId = new mongoose.Types.ObjectId();
    const requestId = new mongoose.Types.ObjectId();
    friendshipModelMock.findById.mockResolvedValueOnce({
      _id: requestId,
      requester: new mongoose.Types.ObjectId(),
      addressee: addresseeId,
      status: 'accepted',
      equals: (value: mongoose.Types.ObjectId) => addresseeId.equals(value),
    });
    mockAuthMiddleware(addresseeId);

    const response = await api
      .patch(`/api/friends/requests/${requestId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ action: 'accept' });

    expect(response.status).toBe(400);
    expect(response.body?.message).toBe('Friend request is no longer pending');
  });

  test('Input: accept action, Expected status: 200', async () => {
    // Input: accept action
    // Expected status code: 200
    // Expected behavior: accepts and increments friend count
    const requesterId = new mongoose.Types.ObjectId();
    const addresseeId = new mongoose.Types.ObjectId();
    const requestId = new mongoose.Types.ObjectId();
    const requestDoc = {
      _id: requestId,
      requester: requesterId,
      addressee: addresseeId,
      status: 'pending',
      equals: (value: mongoose.Types.ObjectId) => addresseeId.equals(value),
    };
    const updatedRequest = {
      _id: requestId,
      requester: requesterId,
      addressee: addresseeId,
      status: 'accepted',
    };
    friendshipModelMock.findById.mockResolvedValueOnce(requestDoc);
    friendshipModelMock.updateRequestStatus.mockResolvedValueOnce(updatedRequest);
    userModelMock.incrementFriendCount.mockResolvedValueOnce(undefined);
    userModelMock.findById
      .mockResolvedValueOnce({ username: 'requester', fcmToken: 'token' })
      .mockResolvedValueOnce({ username: 'addressee' });
    messagingMock.send.mockResolvedValueOnce(undefined);
    mockAuthMiddleware(addresseeId);

    const response = await api
      .patch(`/api/friends/requests/${requestId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ action: 'accept' });

    expect(response.status).toBe(200);
    expect(userModelMock.incrementFriendCount).toHaveBeenCalledWith(requesterId);
    expect(userModelMock.incrementFriendCount).toHaveBeenCalledWith(addresseeId);
  });

  test('Input: accept action but notification fails, Expected status: 200', async () => {
    // Input: accept action but notification fails
    // Expected status code: 200
    // Expected behavior: logs warning when acceptance notification send fails
    const requesterId = new mongoose.Types.ObjectId();
    const addresseeId = new mongoose.Types.ObjectId();
    const requestId = new mongoose.Types.ObjectId();
    const requestDoc = {
      _id: requestId,
      requester: requesterId,
      addressee: addresseeId,
      status: 'pending',
      equals: (value: mongoose.Types.ObjectId) => addresseeId.equals(value),
    };
    const updatedRequest = {
      _id: requestId,
      requester: requesterId,
      addressee: addresseeId,
      status: 'accepted',
    };
    friendshipModelMock.findById.mockResolvedValueOnce(requestDoc);
    friendshipModelMock.updateRequestStatus.mockResolvedValueOnce(updatedRequest);
    userModelMock.incrementFriendCount.mockResolvedValueOnce(undefined);
    userModelMock.findById
      .mockResolvedValueOnce({ username: 'requester', fcmToken: 'token' })
      .mockResolvedValueOnce({ username: 'addressee' });
    messagingMock.send.mockRejectedValueOnce(new Error('fcm error'));
    mockAuthMiddleware(addresseeId);

    const response = await api
      .patch(`/api/friends/requests/${requestId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ action: 'accept' });

    expect(response.status).toBe(200);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to send FCM acceptance notification:',
      expect.any(Error)
    );
  });

  test('Input: decline action, Expected status: 200', async () => {
    // Input: decline action
    // Expected status code: 200
    // Expected behavior: declines and deletes friendship
    const requesterId = new mongoose.Types.ObjectId();
    const addresseeId = new mongoose.Types.ObjectId();
    const requestId = new mongoose.Types.ObjectId();
    const requestDoc = {
      _id: requestId,
      requester: requesterId,
      addressee: addresseeId,
      status: 'pending',
      equals: (value: mongoose.Types.ObjectId) => addresseeId.equals(value),
    };
    friendshipModelMock.findById.mockResolvedValueOnce(requestDoc);
    friendshipModelMock.updateRequestStatus.mockResolvedValueOnce({
      ...requestDoc,
      status: 'declined',
    });
    friendshipModelMock.deleteFriendship.mockResolvedValueOnce(true);
    mockAuthMiddleware(addresseeId);

    const response = await api
      .patch(`/api/friends/requests/${requestId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ action: 'decline' });

    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('Friend request declined successfully');
    expect(friendshipModelMock.deleteFriendship).toHaveBeenCalledWith(requestId);
  });

  test('Input: initial lookup throws error, Expected status: 500', async () => {
    // Input: initial lookup throws error
    // Expected behavior: controller logs error and forwards to next
    // Expected output: 500 internal server error
    const userId = new mongoose.Types.ObjectId();
    const requestId = new mongoose.Types.ObjectId();
    const error = new Error('lookup error');
    friendshipModelMock.findById.mockRejectedValueOnce(error);
    mockAuthMiddleware(userId);

    const response = await api
      .patch(`/api/friends/requests/${requestId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ action: 'accept' });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
    expect(logger.error).toHaveBeenCalledWith('Failed to respond to friend request:', error);
  });
});

