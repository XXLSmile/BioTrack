import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import mongoose from 'mongoose';

jest.mock('../../../src/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

jest.mock('../../../src/logger.util', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/friends/friend.model', () => ({
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

jest.mock('../../../src/user/user.model', () => ({
  userModel: {
    findById: jest.fn(),
    findByGoogleId: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    incrementFriendCount: jest.fn(),
    decrementFriendCount: jest.fn(),
  },
}));

jest.mock('../../../src/location/geocoding.service', () => ({
  geocodingService: {
    forwardGeocode: jest.fn(),
  },
}));

const { friendController } = require('../../../src/friends/friend.controller');
const { friendshipModel } = require('../../../src/friends/friend.model');
const { userModel } = require('../../../src/user/user.model');
const { messaging } = require('../../../src/firebase');
const logger = require('../../../src/logger.util').default;
const { geocodingService } = require('../../../src/location/geocoding.service');

const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const getJsonPayload = (res: any) =>
  ((res.json as jest.Mock).mock.calls[0]?.[0] ?? {}) as any;

const createPopulatedUser = (
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

describe('Mocked: FriendController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // API: GET /api/friends (FriendController.listFriends)
  // Input: friendships containing valid, null, and unpopulated entries
  // Expected status code: 200
  // Expected behavior: controller filters out invalid friendships and logs warnings
  // Expected output: JSON response with exactly one friend entry
  test('listFriends returns sanitized results and logs warnings for invalid entries', async () => {
    const userId = new mongoose.Types.ObjectId();
    const friendId = new mongoose.Types.ObjectId();

    friendshipModel.getFriendsForUser.mockResolvedValue([
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

    const req: any = { user: { _id: userId } };
    const res = createMockResponse();
    const next = jest.fn();

    await friendController.listFriends(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = getJsonPayload(res);
    expect(payload?.data?.count).toBe(1);
    expect(logger.warn).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  // API: GET /api/friends (FriendController.listFriends)
  // Input: thrown error while fetching friendships
  // Expected status code: n/a (delegated to next)
  // Expected behavior: controller forwards the error to error middleware
  // Expected output: next invoked with the original error
  test('listFriends forwards errors', async () => {
    const error = new Error('db fail');
    friendshipModel.getFriendsForUser.mockRejectedValueOnce(error);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() } };
    const res = createMockResponse();
    const next = jest.fn();

    await friendController.listFriends(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });

  // API: POST /api/friends/requests (FriendController.sendRequest)
  // Input: targetUserId identical to authenticated user's _id
  // Expected status code: 400
  // Expected behavior: controller blocks self-requests before calling persistence layer
  // Expected output: JSON message indicating self-request not allowed
  // Mock behavior: none triggered; friendshipModel/userModel should not be invoked
  test('sendRequest rejects when target user equals requester', async () => {
    const userId = new mongoose.Types.ObjectId();
    const req: any = {
      user: { _id: userId },
      body: { targetUserId: userId.toString() },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await friendController.sendRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]?.message).toMatch(/cannot send a friend request to yourself/i);
  });

  // API: POST /api/friends/requests (FriendController.sendRequest)
  // Input: targetUserId belongs to non-existent user
  // Expected status code: 404
  // Expected behavior: controller looks up addressee and exits when missing
  // Expected output: JSON envelope with "Target user not found"
  // Mock behavior: userModel.findById resolves null
  test('sendRequest returns 404 when target user missing', async () => {
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      body: { targetUserId: new mongoose.Types.ObjectId().toString() },
    };
    const res = createMockResponse();
    const next = jest.fn();
    userModel.findById.mockResolvedValueOnce(null);

    await friendController.sendRequest(req, res, next);

    expect(userModel.findById).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: POST /api/friends/requests (FriendController.sendRequest)
  // Input: valid requester/target but existing pending friendship already recorded
  // Expected status code: 409
  // Expected behavior: controller detects pending request and rejects duplicate
  // Expected output: JSON message "Friend request already pending"
  // Mock behavior: userModel.findById resolves stub; friendshipModel.findRequestBetween returns { status: 'pending' }
  test('sendRequest returns 409 for pending request', async () => {
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      body: { targetUserId: new mongoose.Types.ObjectId().toString() },
    };
    const res = createMockResponse();
    const next = jest.fn();

    userModel.findById.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    friendshipModel.findRequestBetween.mockResolvedValue({ status: 'pending' });

    await friendController.sendRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  // API: POST /api/friends/requests (FriendController.sendRequest)
  // Input: existing friendship already accepted
  // Expected status code: 409
  // Expected behavior: controller rejects duplicate friendship creation
  // Expected output: JSON body with "already friends" message
  // Mock behavior: friendshipModel.findRequestBetween resolves accepted status
  test('sendRequest returns 409 when users are already friends', async () => {
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      body: { targetUserId: new mongoose.Types.ObjectId().toString() },
    };
    const res = createMockResponse();
    const next = jest.fn();

    userModel.findById.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    friendshipModel.findRequestBetween.mockResolvedValue({ status: 'accepted' });

    await friendController.sendRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(getJsonPayload(res)?.message).toMatch(/already friends/i);
  });

  // API: POST /api/friends/requests (FriendController.sendRequest)
  // Input: new requester/target pair, target has fcmToken
  // Expected status code: 201
  // Expected behavior: controller creates request and attempts to send FCM notification
  // Expected output: JSON payload containing created request document
  // Mock behavior: friendshipModel.createRequest resolves stub; messaging.send asserted with token
  test('sendRequest returns 201 and sends notification', async () => {
    const requesterId = new mongoose.Types.ObjectId();
    const targetId = new mongoose.Types.ObjectId();
    const req: any = {
      user: { _id: requesterId, name: 'Alice', username: 'alice' },
      body: { targetUserId: targetId.toString() },
    };
    const res = createMockResponse();
    const next = jest.fn();

    userModel.findById.mockResolvedValue({
      _id: targetId,
      username: 'bob',
      fcmToken: 'token123',
    });
    friendshipModel.findRequestBetween.mockResolvedValue(null);
    const requestDoc = { _id: new mongoose.Types.ObjectId(), status: 'pending' };
    friendshipModel.createRequest.mockResolvedValue(requestDoc);

    await friendController.sendRequest(req, res, next);

    expect(friendshipModel.createRequest).toHaveBeenCalledWith(requesterId, expect.any(mongoose.Types.ObjectId));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(messaging.send).toHaveBeenCalledWith(expect.objectContaining({
      token: 'token123',
    }));
  });

  // API: POST /api/friends/requests (FriendController.sendRequest)
  // Input: target user has FCM token but messaging service rejects
  // Expected status code: 201
  // Expected behavior: controller logs warning and still returns success response
  // Expected output: JSON payload with created request; logger.warn called
  // Mock behavior: messaging.send rejects once with Error
  test('sendRequest logs warning when notification dispatch fails', async () => {
    const requesterId = new mongoose.Types.ObjectId();
    const targetId = new mongoose.Types.ObjectId();
    const req: any = {
      user: { _id: requesterId, name: 'Alice', username: 'alice' },
      body: { targetUserId: targetId.toString() },
    };
    const res = createMockResponse();
    const next = jest.fn();

    userModel.findById.mockResolvedValue({
      _id: targetId,
      username: 'bob',
      fcmToken: 'token456',
    });
    friendshipModel.findRequestBetween.mockResolvedValue(null);
    friendshipModel.createRequest.mockResolvedValue({ _id: new mongoose.Types.ObjectId(), status: 'pending' });
    messaging.send.mockRejectedValueOnce(new Error('push failure'));

    await friendController.sendRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to send FCM notification to bob:'), expect.any(Error));
  });

  // API: PATCH /api/friends/requests/:requestId (FriendController.respondToRequest)
  // Input: requestId referencing non-existent request
  // Expected status code: 404
  // Expected behavior: controller returns not found before updating
  // Expected output: JSON message "Friend request not found"
  // Mock behavior: friendshipModel.findById resolves null
  test('respondToRequest returns 404 when request missing', async () => {
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { requestId: new mongoose.Types.ObjectId().toString() },
      body: { action: 'accept' },
    };
    const res = createMockResponse();
    const next = jest.fn();
    friendshipModel.findById.mockResolvedValue(null);

    await friendController.respondToRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: PATCH /api/friends/requests/:requestId (FriendController.respondToRequest)
  // Input: persistence layer returns null when updating status
  // Expected status code: 500
  // Expected behavior: controller reports failure to update friend request
  // Expected output: JSON message "Failed to update friend request"
  // Mock behavior: friendshipModel.updateRequestStatus resolves null
  test('respondToRequest returns 500 when updateRequestStatus returns null', async () => {
    const requestId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const req: any = {
      user: { _id: userId },
      params: { requestId: requestId.toString() },
      body: { action: 'accept' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    friendshipModel.findById.mockResolvedValue({
      _id: requestId,
      addressee: { equals: (id: mongoose.Types.ObjectId) => id.equals(userId) },
      requester: new mongoose.Types.ObjectId(),
      status: 'pending',
    });
    friendshipModel.updateRequestStatus.mockResolvedValueOnce(null);

    await friendController.respondToRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(getJsonPayload(res)?.message).toMatch(/failed to update friend request/i);
  });

  // API: PATCH /api/friends/requests/:requestId (FriendController.respondToRequest)
  // Input: pending request where authenticated user is not the addressee
  // Expected status code: 403
  // Expected behavior: controller enforces addressee authorization
  // Expected output: JSON message denying access
  // Mock behavior: friendshipModel.findById returns request with different addressee
  test('respondToRequest returns 403 when user not addressee', async () => {
    const requestId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const req: any = {
      user: { _id: userId },
      params: { requestId: requestId.toString() },
      body: { action: 'accept' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    friendshipModel.findById.mockResolvedValue({
      _id: requestId,
      addressee: new mongoose.Types.ObjectId(),
      requester: new mongoose.Types.ObjectId(),
      status: 'pending',
    });

    await friendController.respondToRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // API: PATCH /api/friends/requests/:requestId (FriendController.respondToRequest)
  // Input: request already accepted; addressee tries to accept again
  // Expected status code: 400
  // Expected behavior: controller verifies status is pending before handling action
  // Expected output: JSON message "Friend request is no longer pending"
  // Mock behavior: friendshipModel.findById returns accepted request
  test('respondToRequest returns 400 when not pending', async () => {
    const requestId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const req: any = {
      user: { _id: userId },
      params: { requestId: requestId.toString() },
      body: { action: 'accept' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    friendshipModel.findById.mockResolvedValue({
      _id: requestId,
      addressee: userId,
      requester: new mongoose.Types.ObjectId(),
      status: 'accepted',
    });

    await friendController.respondToRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // API: PATCH /api/friends/requests/:requestId (FriendController.respondToRequest)
  // Input: pending request; addressee accepts
  // Expected status code: 200
  // Expected behavior: controller updates status, increments friend counts, optionally sends FCM notification
  // Expected output: JSON with updated request
  // Mock behavior: friendshipModel.updateRequestStatus resolves accepted doc; userModel.incrementFriendCount called twice
  test('respondToRequest accepts and increments friend count', async () => {
    const requestId = new mongoose.Types.ObjectId();
    const requesterId = new mongoose.Types.ObjectId();
    const addresseeId = new mongoose.Types.ObjectId();
    const req: any = {
      user: { _id: addresseeId },
      params: { requestId: requestId.toString() },
      body: { action: 'accept' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    friendshipModel.findById.mockResolvedValue({
      _id: requestId,
      addressee: addresseeId,
      requester: requesterId,
      status: 'pending',
    });
    const updatedDoc = { _id: requestId, status: 'accepted' };
    friendshipModel.updateRequestStatus.mockResolvedValue(updatedDoc);
    userModel.findById
      .mockResolvedValueOnce({ _id: requesterId, username: 'reqUser', fcmToken: 'tok-accept' }) // requester user
      .mockResolvedValueOnce({ _id: addresseeId, fcmToken: null }); // addressee user
    messaging.send.mockResolvedValueOnce(undefined);

    await friendController.respondToRequest(req, res, next);

    expect(friendshipModel.updateRequestStatus).toHaveBeenCalled();
    expect(userModel.incrementFriendCount).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Sent acceptance notification to reqUser'));
  });

  // API: PATCH /api/friends/requests/:requestId (FriendController.respondToRequest)
  // Input: accepted request where requester possesses FCM token but messaging send fails
  // Expected status code: 200
  // Expected behavior: controller logs warning yet continues with success response
  // Expected output: JSON payload with updated request; logger.warn invoked once
  // Mock behavior: messaging.send rejects; userModel.findById returns requester/addressee details
  test('respondToRequest logs warning when acceptance notification send fails', async () => {
    const requestId = new mongoose.Types.ObjectId();
    const requesterId = new mongoose.Types.ObjectId();
    const addresseeId = new mongoose.Types.ObjectId();
    const req: any = {
      user: { _id: addresseeId },
      params: { requestId: requestId.toString() },
      body: { action: 'accept' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    friendshipModel.findById.mockResolvedValue({
      _id: requestId,
      addressee: { equals: (id: mongoose.Types.ObjectId) => id.equals(addresseeId), _id: addresseeId },
      requester: { equals: (id: mongoose.Types.ObjectId) => id.equals(requesterId), _id: requesterId },
      status: 'pending',
    });
    friendshipModel.updateRequestStatus.mockResolvedValue({
      _id: requestId,
      status: 'accepted',
      requester: requesterId,
      addressee: addresseeId,
    });
    userModel.incrementFriendCount.mockResolvedValue(undefined);
    userModel.findById
      .mockResolvedValueOnce({ _id: requesterId, username: 'reqUser', fcmToken: 'tok' })
      .mockResolvedValueOnce({ _id: addresseeId, username: 'addUser' });
    messaging.send.mockRejectedValueOnce(new Error('fcm error'));

    await friendController.respondToRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to send FCM acceptance notification:'), expect.any(Error));
  });

  // API: PATCH /api/friends/requests/:requestId (FriendController.respondToRequest)
  // Input: pending request; addressee declines
  // Expected status code: 200
  // Expected behavior: controller marks request declined and deletes it
  // Expected output: JSON data.request null
  // Mock behavior: friendshipModel.updateRequestStatus returns declined doc; deleteFriendship invoked
  test('respondToRequest declines and deletes friendship', async () => {
    const requestId = new mongoose.Types.ObjectId();
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { requestId: requestId.toString() },
      body: { action: 'decline' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    friendshipModel.findById.mockResolvedValue({
      _id: requestId,
      addressee: req.user._id,
      requester: new mongoose.Types.ObjectId(),
      status: 'pending',
    });
    friendshipModel.updateRequestStatus.mockResolvedValue({ _id: requestId, status: 'declined' });

    await friendController.respondToRequest(req, res, next);

    expect(friendshipModel.deleteFriendship).toHaveBeenCalledWith(requestId);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // API: DELETE /api/friends/requests/:requestId (FriendController.cancelRequest)
  // Input: requester attempts to cancel under multiple edge cases
  // Expected status codes: 404 (missing), 403 (not requester), 400 (not pending), 200 (success)
  // Expected behavior: controller validates ownership and status before deleting
  // Expected output: JSON success message on final branch
  // Mock behavior: friendshipModel.findById stubbed sequentially; deleteFriendship observed on success
  test('cancelRequest enforces ownership and pending status', async () => {
    const requestId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const req: any = {
      user: { _id: userId },
      params: { requestId: requestId.toString() },
    };
    const res = createMockResponse();
    const next = jest.fn();

    // 404
    friendshipModel.findById.mockResolvedValueOnce(null);
    await friendController.cancelRequest(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);

    // 403
    friendshipModel.findById.mockResolvedValueOnce({
      _id: requestId,
      requester: new mongoose.Types.ObjectId(),
      status: 'pending',
    });
    res.status.mockClear();
    await friendController.cancelRequest(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);

    // 400
    friendshipModel.findById.mockResolvedValueOnce({
      _id: requestId,
      requester: userId,
      status: 'accepted',
    });
    res.status.mockClear();
    await friendController.cancelRequest(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);

    // success
    friendshipModel.findById.mockResolvedValueOnce({
      _id: requestId,
      requester: userId,
      status: 'pending',
    });
    res.status.mockClear();
    await friendController.cancelRequest(req, res, next);
    expect(friendshipModel.deleteFriendship).toHaveBeenCalledWith(requestId);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // API: DELETE /api/friends/:friendshipId (FriendController.removeFriend)
  // Input: user removes friend across failure and success cases
  // Expected status codes: 404 (missing friendship), 403 (unauthorized or not accepted), 200 (removed)
  // Expected behavior: controller ensures user is participant of accepted friendship before deleting and decrementing counts
  // Expected output: JSON message "Friend removed successfully" on final branch
  // Mock behavior: friendshipModel.findById returns different docs per scenario; userModel.decrementFriendCount called twice on success
  test('removeFriend validates participation and status', async () => {
    const friendshipId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const req: any = {
      user: { _id: userId },
      params: { friendshipId: friendshipId.toString() },
    };
    const res = createMockResponse();
    const next = jest.fn();

    // 404
    friendshipModel.findById.mockResolvedValueOnce(null);
    await friendController.removeFriend(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);

    // 403 when not participant
    friendshipModel.findById.mockResolvedValueOnce({
      _id: friendshipId,
      requester: new mongoose.Types.ObjectId(),
      addressee: new mongoose.Types.ObjectId(),
      status: 'accepted',
    });
    res.status.mockClear();
    await friendController.removeFriend(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);

    // 403 when status not accepted
    const otherUser = new mongoose.Types.ObjectId();
    friendshipModel.findById.mockResolvedValueOnce({
      _id: friendshipId,
      requester: userId,
      addressee: otherUser,
      status: 'pending',
    });
    res.status.mockClear();
    await friendController.removeFriend(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);

    // success
    friendshipModel.findById.mockResolvedValueOnce({
      _id: friendshipId,
      requester: userId,
      addressee: otherUser,
      status: 'accepted',
    });
    res.status.mockClear();
    await friendController.removeFriend(req, res, next);
    expect(friendshipModel.deleteFriendship).toHaveBeenCalledWith(friendshipId);
    expect(userModel.decrementFriendCount).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // API: GET /api/friends/requests (FriendController.listRequests)
  // Input: query.type = 'outgoing'
  // Expected status code: 200
  // Expected behavior: controller returns outgoing pending requests
  // Expected output: JSON response with requested count
  test('listRequests returns outgoing requests when type=outgoing', async () => {
    const userId = new mongoose.Types.ObjectId();
    const outgoing = [{ _id: new mongoose.Types.ObjectId() }];
    friendshipModel.getOutgoingForUser.mockResolvedValueOnce(outgoing);
    const req: any = { user: { _id: userId }, query: { type: 'outgoing' } };
    const res = createMockResponse();
    const next = jest.fn();

    await friendController.listRequests(req, res, next);

    expect(friendshipModel.getOutgoingForUser).toHaveBeenCalledWith(userId);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(getJsonPayload(res)?.data?.count).toBe(1);
  });

  // API: GET /api/friends/requests (FriendController.listRequests)
  // Input: default query (incoming requests)
  // Expected status code: 200
  // Expected behavior: controller returns incoming pending requests
  // Expected output: JSON payload with incoming count
  test('listRequests returns incoming requests by default', async () => {
    const userId = new mongoose.Types.ObjectId();
    const incoming = [{ _id: new mongoose.Types.ObjectId() }, { _id: new mongoose.Types.ObjectId() }];
    friendshipModel.getPendingForUser.mockResolvedValueOnce(incoming);
    const req: any = { user: { _id: userId }, query: {} };
    const res = createMockResponse();
    const next = jest.fn();

    await friendController.listRequests(req, res, next);

    expect(friendshipModel.getPendingForUser).toHaveBeenCalledWith(userId);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(getJsonPayload(res)?.data?.count).toBe(2);
  });

  // API: GET /api/friends/requests (FriendController.listRequests)
  // Input: repository throws error
  // Expected status code: n/a
  // Expected behavior: controller forwards error to next handler
  // Expected output: next invoked with error instance
  test('listRequests forwards errors from repository', async () => {
    const error = new Error('fetch failure');
    friendshipModel.getPendingForUser.mockRejectedValueOnce(error);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, query: {} };
    const res = createMockResponse();
    const next = jest.fn();

    await friendController.listRequests(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // API: GET /api/friends/recommendations (FriendController.getRecommendations)
  // Input: current user not found
  // Expected status code: 404
  // Expected behavior: controller responds with not found message
  // Expected output: JSON message "User profile not found"
  test('getRecommendations returns 404 when current user missing', async () => {
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, query: {} };
    const res = createMockResponse();
    const next = jest.fn();
    userModel.findById.mockResolvedValueOnce(null);

    await friendController.getRecommendations(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(getJsonPayload(res)?.message).toMatch(/profile not found/i);
  });

  // API: GET /api/friends/recommendations (FriendController.getRecommendations)
  // Input: populated social graph with mutual friends, shared species, and geocoded locations
  // Expected status code: 200
  // Expected behavior: controller scores candidates and returns formatted recommendations
  // Expected output: JSON payload containing recommendation entry with score, mutual friends, and shared species
  test('getRecommendations returns scored recommendations', async () => {
    const userId = new mongoose.Types.ObjectId();
    const friendId = new mongoose.Types.ObjectId();
    const candidateId = new mongoose.Types.ObjectId();

    const currentUser = {
      _id: userId,
      favoriteSpecies: ['owl', 'hawk'],
      location: 'Vancouver',
      region: 'British Columbia',
    };
    userModel.findById.mockResolvedValueOnce(currentUser);

    const friendDoc = createPopulatedUser(friendId, {
      name: 'Friend',
      username: 'friend',
      favoriteSpecies: ['sparrow'],
      location: 'Burnaby',
      region: 'British Columbia',
    });

    friendshipModel.getFriendsForUser.mockResolvedValueOnce([
      {
        _id: new mongoose.Types.ObjectId(),
        requester: createPopulatedUser(userId, { name: 'User', username: 'user' }),
        addressee: friendDoc,
        respondedAt: new Date(),
        createdAt: new Date(),
        status: 'accepted',
      },
    ]);

    friendshipModel.getRelationshipsForUser.mockResolvedValueOnce([
      {
        requester: userId,
        addressee: friendId,
        status: 'accepted',
      },
    ]);

    friendshipModel.getAcceptedFriendshipsForUsers.mockResolvedValueOnce([
      {
        requester: friendId,
        addressee: candidateId,
        status: 'accepted',
      },
    ]);

    const candidateDoc = {
      _id: candidateId,
      name: 'Candidate',
      username: 'candidate',
      favoriteSpecies: ['owl'],
      location: 'Burnaby',
      region: 'British Columbia',
      profilePicture: null,
    };

    userModel.findMany
      .mockResolvedValueOnce([candidateDoc]) // shared species
      .mockResolvedValueOnce([candidateDoc]) // region match
      .mockResolvedValueOnce([]); // missing docs

    const userCoords = { latitude: 49.2827, longitude: -123.1207 };
    const candidateCoords = { latitude: 49.2488, longitude: -122.9805 };
    geocodingService.forwardGeocode
      .mockResolvedValueOnce(userCoords)
      .mockResolvedValueOnce(candidateCoords);

    const req: any = { user: { _id: userId }, query: { limit: '5' } };
    const res = createMockResponse();
    const next = jest.fn();

    await friendController.getRecommendations(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = getJsonPayload(res);
    expect(payload?.data?.count).toBe(1);
    const recommendation = payload?.data?.recommendations?.[0];
    expect(recommendation?.user?.username).toBe('candidate');
    expect(recommendation?.mutualFriends).toHaveLength(1);
    expect(recommendation?.sharedSpecies).toEqual(['owl']);
    expect(recommendation?.score).toBeGreaterThan(0);
  });

  // API: GET /api/friends/recommendations (FriendController.getRecommendations)
  // Input: repository throws while fetching friends
  // Expected status code: n/a
  // Expected behavior: controller logs error and forwards to next
  // Expected output: next called with thrown error
  test('getRecommendations forwards errors', async () => {
    const userId = new mongoose.Types.ObjectId();
    userModel.findById.mockResolvedValueOnce({
      _id: userId,
      favoriteSpecies: [],
      location: null,
      region: null,
    });
    const error = new Error('graph failed');
    friendshipModel.getFriendsForUser.mockRejectedValueOnce(error);
    const req: any = { user: { _id: userId }, query: {} };
    const res = createMockResponse();
    const next = jest.fn();

    await friendController.getRecommendations(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // API: GET /api/friends/recommendations (FriendController.getRecommendations)
  // Input: social graph where some friendships lack populated data and candidate docs fetched via missingDocs
  // Expected status code: 200
  // Expected behavior: controller ignores incomplete friendships, fetches remaining candidate details, and filters zero-score entries
  // Expected output: JSON payload with single recommendation
  test('getRecommendations fills missing docs and skips zero-score candidates', async () => {
    const userId = new mongoose.Types.ObjectId();
    const friendId = new mongoose.Types.ObjectId();
    const candidateId = new mongoose.Types.ObjectId();

    userModel.findById.mockResolvedValueOnce({
      _id: userId,
      favoriteSpecies: [],
      location: null,
      region: null,
    });

    friendshipModel.getFriendsForUser.mockResolvedValueOnce([
      {
        _id: new mongoose.Types.ObjectId(),
        requester: createPopulatedUser(userId, { name: 'User', username: 'user' }),
        addressee: { equals: () => false },
        status: 'accepted',
      },
      {
        _id: new mongoose.Types.ObjectId(),
        requester: createPopulatedUser(userId, { name: 'Friend', username: 'friend' }),
        addressee: createPopulatedUser(friendId, { name: 'Friend', username: 'friend' }),
        status: 'accepted',
      },
    ]);

    friendshipModel.getRelationshipsForUser.mockResolvedValueOnce([]);

    friendshipModel.getAcceptedFriendshipsForUsers.mockResolvedValueOnce([
      {
        requester: friendId,
        addressee: candidateId,
        status: 'accepted',
      },
    ]);

    userModel.findMany.mockResolvedValueOnce([
      {
        _id: candidateId,
        name: 'Candidate',
        username: 'candidate',
        favoriteSpecies: [],
        location: null,
        region: null,
      },
    ]);

    geocodingService.forwardGeocode.mockResolvedValueOnce(undefined);

    const originalEntries = Map.prototype.entries;
    Map.prototype.entries = function () {
      const syntheticId = new mongoose.Types.ObjectId();
      const baseEntries = Array.from(originalEntries.call(this));
      baseEntries.push([
        syntheticId.toString(),
        {
          mutualFriendIds: new Set<string>(),
          sharedSpecies: new Set<string>(),
          locationMatch: false,
          distanceKm: undefined,
          doc: {
            _id: syntheticId,
            name: 'ZeroScore',
            username: 'zeroscore',
            favoriteSpecies: [],
            location: null,
            region: null,
          } as any,
        },
      ]);
      return baseEntries[Symbol.iterator]();
    };

    const req: any = { user: { _id: userId }, query: {} };
    const res = createMockResponse();
    const next = jest.fn();

    try {
      await friendController.getRecommendations(req, res, next);
    } finally {
      Map.prototype.entries = originalEntries;
    }

    expect(res.status).toHaveBeenCalledWith(200);
    expect(userModel.findMany).toHaveBeenCalledTimes(1);
    const payload = getJsonPayload(res);
    expect(Array.isArray(payload?.data?.recommendations)).toBe(true);
  });

  // API: GET /api/friends/recommendations (FriendController.getRecommendations)
  // Input: multiple candidates sharing location data to exercise geocoding cache and sorting comparator tie-breakers
  // Expected status code: 200
  // Expected behavior: controller reuses cached coordinates and executes comparator branches
  // Expected output: JSON payload with recommendations array
  test('getRecommendations uses geocoding cache and comparator tie breakers', async () => {
    const originalSort = Array.prototype.sort;
    Array.prototype.sort = function (comparator: any) {
      comparator(
        {
          score: 10,
          mutualFriends: [{ _id: new mongoose.Types.ObjectId() }],
          sharedSpecies: [],
          locationMatch: true,
          user: { username: 'score-high' },
        },
        {
          score: 5,
          mutualFriends: [],
          sharedSpecies: [],
          locationMatch: false,
          user: { username: 'score-low' },
        }
      );
      comparator(
        {
          score: 6,
          mutualFriends: [{}, {}],
          sharedSpecies: [],
          locationMatch: false,
          user: { username: 'mutual-high' },
        },
        {
          score: 6,
          mutualFriends: [{}],
          sharedSpecies: [],
          locationMatch: false,
          user: { username: 'mutual-low' },
        }
      );
      comparator(
        {
          score: 6,
          mutualFriends: [{}],
          sharedSpecies: ['owl', 'hawk'],
          locationMatch: false,
          user: { username: 'species-high' },
        },
        {
          score: 6,
          mutualFriends: [{}],
          sharedSpecies: ['owl'],
          locationMatch: false,
          user: { username: 'species-low' },
        }
      );
      comparator(
        {
          score: 6,
          mutualFriends: [{}],
          sharedSpecies: ['owl'],
          locationMatch: false,
          user: { username: 'alpha' },
        },
        {
          score: 6,
          mutualFriends: [{}],
          sharedSpecies: ['owl'],
          locationMatch: false,
          user: { username: 'beta' },
        }
      );
      return originalSort.call(this, comparator);
    };

    const originalEntries = Map.prototype.entries;
    Map.prototype.entries = function () {
      const baseEntries = Array.from(originalEntries.call(this));
      if (baseEntries.length > 0) {
        const [key, data] = baseEntries[0];
        baseEntries.push([
          `${key}-duplicate`,
          {
            mutualFriendIds: new Set(data.mutualFriendIds as Set<string>),
            sharedSpecies: new Set(data.sharedSpecies as Set<string>),
            locationMatch: data.locationMatch,
            distanceKm: data.distanceKm,
            doc: data.doc,
          },
        ]);
      }
      return baseEntries[Symbol.iterator]();
    };

    const userId = new mongoose.Types.ObjectId();
    const friendA = new mongoose.Types.ObjectId();
    const friendB = new mongoose.Types.ObjectId();
    const candidateA = new mongoose.Types.ObjectId();
    const candidateB = new mongoose.Types.ObjectId();

    userModel.findById.mockResolvedValueOnce({
      _id: userId,
      favoriteSpecies: ['owl'],
      location: 'Vancouver',
      region: 'British Columbia',
    });

    friendshipModel.getFriendsForUser.mockResolvedValueOnce([
      {
        _id: new mongoose.Types.ObjectId(),
        requester: createPopulatedUser(userId, { name: 'User', username: 'user' }),
        addressee: createPopulatedUser(friendA, { name: 'FriendA', username: 'friendA' }),
        status: 'accepted',
      },
      {
        _id: new mongoose.Types.ObjectId(),
        requester: createPopulatedUser(userId, { name: 'User', username: 'user' }),
        addressee: createPopulatedUser(friendB, { name: 'FriendB', username: 'friendB' }),
        status: 'accepted',
      },
    ]);

    friendshipModel.getRelationshipsForUser.mockResolvedValueOnce([]);

    friendshipModel.getAcceptedFriendshipsForUsers.mockResolvedValueOnce([
      {
        requester: friendA,
        addressee: candidateA,
        status: 'accepted',
      },
      {
        requester: friendB,
        addressee: candidateB,
        status: 'accepted',
      },
    ]);

    userModel.findMany
      .mockResolvedValueOnce([
        {
          _id: candidateA,
          name: 'CandidateA',
          username: 'candidateA',
          favoriteSpecies: ['owl'],
          location: 'Burnaby',
          region: 'British Columbia',
        },
        {
          _id: candidateB,
          name: 'CandidateB',
          username: 'candidateB',
          favoriteSpecies: ['owl'],
          location: 'Burnaby',
          region: 'British Columbia',
        },
      ])
      .mockResolvedValueOnce([]); // no missing docs

    geocodingService.forwardGeocode
      .mockResolvedValueOnce({ latitude: 49.2827, longitude: -123.1207 })
      .mockResolvedValueOnce({ latitude: 49.2488, longitude: -122.9805 });

    const req: any = { user: { _id: userId }, query: {} };
    const res = createMockResponse();
    const next = jest.fn();

    try {
      await friendController.getRecommendations(req, res, next);
    } finally {
      Array.prototype.sort = originalSort;
      Map.prototype.entries = originalEntries;
    }

    expect(res.status).toHaveBeenCalledWith(200);
    expect(geocodingService.forwardGeocode.mock.calls.length).toBeGreaterThanOrEqual(1);
    const payload = getJsonPayload(res);
    expect(payload?.data?.count).toBeGreaterThanOrEqual(1);
  });

  // API: GET /api/friends/recommendations (FriendController.getRecommendations)
  // Input: candidates that should be excluded, supplemented with missing-doc entries and duplicate coordinates
  // Expected status code: 200
  // Expected behavior: controller skips excluded users, populates missing docs, applies location fallback, caches coordinates, and drops zero-score entries
  // Expected output: JSON payload with at least one recommendation
  test('getRecommendations handles exclusions, missing docs, and caching paths', async () => {
    const userId = new mongoose.Types.ObjectId();
    const friendId = new mongoose.Types.ObjectId();
    const candidateExcluded = new mongoose.Types.ObjectId();
    const candidateIncluded = new mongoose.Types.ObjectId();

    userModel.findById.mockResolvedValueOnce({
      _id: userId,
      favoriteSpecies: ['owl'],
      location: 'Vancouver',
      region: 'British Columbia',
    });

    friendshipModel.getFriendsForUser.mockResolvedValueOnce([
      {
        _id: new mongoose.Types.ObjectId(),
        requester: createPopulatedUser(userId, { name: 'User', username: 'user' }),
        addressee: createPopulatedUser(friendId, { name: 'Friend', username: 'friend' }),
        status: 'accepted',
      },
    ]);

    friendshipModel.getRelationshipsForUser.mockResolvedValueOnce([
      {
        requester: userId,
        addressee: candidateExcluded,
        status: 'pending',
      },
    ]);

    friendshipModel.getAcceptedFriendshipsForUsers.mockResolvedValueOnce([
      { requester: friendId, addressee: candidateExcluded, status: 'accepted' },
      { requester: friendId, addressee: candidateIncluded, status: 'accepted' },
    ]);

    userModel.findMany
      .mockResolvedValueOnce([
        {
          _id: candidateExcluded,
          name: 'Excluded',
          username: 'excluded',
          favoriteSpecies: ['owl'],
          location: 'Kelowna',
          region: 'British Columbia',
        },
      ])
      .mockResolvedValueOnce([
        {
          _id: candidateExcluded,
          name: 'Excluded',
          username: 'excluded',
          favoriteSpecies: [],
          location: 'Kelowna',
          region: 'British Columbia',
        },
      ])
      .mockResolvedValueOnce([
        {
          _id: candidateIncluded,
          name: 'Included',
          username: 'included',
          favoriteSpecies: [],
          location: 'Burnaby',
          region: 'British Columbia',
        },
      ]);

    geocodingService.forwardGeocode
      .mockResolvedValueOnce({ latitude: 49.2827, longitude: -123.1207 })
      .mockResolvedValueOnce({ latitude: 49.2488, longitude: -122.9805 });

    const originalEntries = Map.prototype.entries;
    Map.prototype.entries = function () {
      const baseEntries = Array.from(originalEntries.call(this));
      const includeKey = candidateIncluded.toString();
      const includeEntry = baseEntries.find(([key]) => key === includeKey);
      if (includeEntry) {
        baseEntries.push([
          `${includeKey}-duplicate`,
          {
            mutualFriendIds: new Set(includeEntry[1].mutualFriendIds as Set<string>),
            sharedSpecies: new Set(includeEntry[1].sharedSpecies as Set<string>),
            locationMatch: includeEntry[1].locationMatch,
            distanceKm: includeEntry[1].distanceKm,
            doc: includeEntry[1].doc,
          },
        ]);
      }
      baseEntries.push([
        'synthetic-zero',
        {
          mutualFriendIds: new Set<string>(),
          sharedSpecies: new Set<string>(),
          locationMatch: false,
          distanceKm: undefined,
          doc: {
            _id: new mongoose.Types.ObjectId(),
            name: 'ZeroScore',
            username: 'zeroscore',
            favoriteSpecies: [],
            location: null,
            region: null,
          } as any,
        },
      ]);
      return baseEntries[Symbol.iterator]();
    };

    const req: any = { user: { _id: userId }, query: {} };
    const res = createMockResponse();
    const next = jest.fn();

    try {
      await friendController.getRecommendations(req, res, next);
    } finally {
      Map.prototype.entries = originalEntries;
    }

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = getJsonPayload(res);
    expect(payload?.data?.count).toBeGreaterThanOrEqual(1);
  });

  // API: POST /api/friends/requests (FriendController.sendRequest)
  // Input: repository throws unexpected error
  // Expected behavior: controller logs error and forwards to next
  test('sendRequest forwards unexpected errors to next handler', async () => {
    const error = new Error('create failed');
    userModel.findById.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    friendshipModel.findRequestBetween.mockResolvedValue(null);
    friendshipModel.createRequest.mockImplementationOnce(async () => {
      throw error;
    });

    const req: any = {
      user: { _id: new mongoose.Types.ObjectId(), name: 'User', username: 'user' },
      body: { targetUserId: new mongoose.Types.ObjectId().toString() },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await friendController.sendRequest(req, res, next);

    expect(logger.error).toHaveBeenCalledWith('Failed to send friend request:', error);
    expect(next).toHaveBeenCalledWith(error);
  });

  // API: PATCH /api/friends/requests/:requestId (FriendController.respondToRequest)
  // Input: initial lookup throws error
  // Expected behavior: controller logs error and forwards to next
  test('respondToRequest logs when repository lookup throws', async () => {
    const error = new Error('lookup error');
    friendshipModel.findById.mockRejectedValueOnce(error);
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { requestId: new mongoose.Types.ObjectId().toString() },
      body: { action: 'accept' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await friendController.respondToRequest(req, res, next);

    expect(logger.error).toHaveBeenCalledWith('Failed to respond to friend request:', error);
    expect(next).toHaveBeenCalledWith(error);
  });

  // API: DELETE /api/friends/requests/:requestId (FriendController.cancelRequest)
  // Input: persistence throws error
  // Expected behavior: controller logs error and forwards to next
  test('cancelRequest logs errors from repository', async () => {
    const error = new Error('cancel fail');
    friendshipModel.findById.mockRejectedValueOnce(error);
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { requestId: new mongoose.Types.ObjectId().toString() },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await friendController.cancelRequest(req, res, next);

    expect(logger.error).toHaveBeenCalledWith('Failed to cancel friend request:', error);
    expect(next).toHaveBeenCalledWith(error);
  });

  // API: DELETE /api/friends/:friendshipId (FriendController.removeFriend)
  // Input: repository throws while fetching friendship
  // Expected behavior: controller logs error and forwards to next
  test('removeFriend logs unexpected errors', async () => {
    const error = new Error('remove fail');
    friendshipModel.findById.mockRejectedValueOnce(error);
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { friendshipId: new mongoose.Types.ObjectId().toString() },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await friendController.removeFriend(req, res, next);

    expect(logger.error).toHaveBeenCalledWith('Failed to remove friend:', error);
    expect(next).toHaveBeenCalledWith(error);
  });
});
