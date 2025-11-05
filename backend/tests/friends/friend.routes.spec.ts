import mongoose from 'mongoose';
import request from 'supertest';
jest.mock('../../src/firebase', () => ({
  __esModule: true,
  messaging: {
    send: jest.fn().mockResolvedValue(undefined),
  },
  default: {
    messaging: {
      send: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

import { createApp } from '../../src/app';
import { friendshipModel } from '../../src/friends/friend.model';
import { createTestUser, authHeaderForUser } from '../utils/testHelpers';

const app = createApp();

// Interface POST /friends/requests
describe('Unmocked: POST /friends/requests', () => {
  // Input: authenticated user sending request to another existing user
  // Expected status code: 201
  // Expected behavior: request stored with pending status, no duplicates
  // Expected output: response contains created friend request id
  test('creates a pending friend request for a valid target user', async () => {
    const currentUser = await createTestUser();
    const targetUser = await createTestUser();

    const response = await request(app)
      .post('/api/friends/requests')
      .set(authHeaderForUser(currentUser))
      .send({ targetUserId: targetUser._id.toString() });

    expect(response.status).toBe(201);
    expect(response.body?.data?.request).toBeDefined();
    expect(response.body?.data?.request?.status).toBe('pending');
    expect(response.body?.data?.request?.requester).toBe(
      currentUser._id.toString()
    );
    expect(response.body?.data?.request?.addressee).toBe(
      targetUser._id.toString()
    );
  });
});

// Interface GET /friends (list)
describe('Unmocked: GET /friends', () => {
  // Input: authenticated user without friends
  // Expected status code: 200
  // Expected behavior: returns empty list
  // Expected output: data.count = 0
  test('returns empty friends list when user has no friends', async () => {
    const user = await createTestUser();

    const response = await request(app)
      .get('/api/friends')
      .set(authHeaderForUser(user));

    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(0);
  });
});

describe('Mocked: GET /friends', () => {
  // Input: authenticated user
  // Expected status code: 500
  // Expected behavior: error bubbled
  // Expected output: internal server error
  // Mock behavior: friendshipModel.getFriendsForUser throws
  test('returns 500 when listing friends fails', async () => {
    const user = await createTestUser();
    const spy = jest
      .spyOn(friendshipModel, 'getFriendsForUser')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .get('/api/friends')
        .set(authHeaderForUser(user));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /friends/recommendations
describe('Unmocked: GET /friends/recommendations', () => {
  // Input: authenticated user
  // Expected status code: 200
  // Expected behavior: returns recommendation results (possibly empty)
  // Expected output: data.recommendations defined
  test('returns recommendations (may be empty)', async () => {
    const user = await createTestUser();

    const response = await request(app)
      .get('/api/friends/recommendations')
      .set(authHeaderForUser(user));

    expect(response.status).toBe(200);
    expect(response.body?.data).toBeDefined();
  });
});

describe('Mocked: GET /friends/recommendations', () => {
  // Input: authenticated user
  // Expected status code: 500
  // Expected behavior: error bubbled
  // Expected output: 500
  // Mock behavior: friendshipModel.getFriendsForUser throws
  test('returns 500 when recommendations query fails', async () => {
    const user = await createTestUser();
    const spy = jest
      .spyOn(friendshipModel, 'getFriendsForUser')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .get('/api/friends/recommendations')
        .set(authHeaderForUser(user));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface PATCH /friends/requests/:requestId
describe('Unmocked: PATCH /friends/requests/:requestId', () => {
  // Input: pending request responded by addressee
  // Expected status code: 200
  // Expected behavior: request status updated
  // Expected output: friendship list includes new friend
  test('accepts pending friend request', async () => {
    const requester = await createTestUser();
    const addressee = await createTestUser();

    const creation = await request(app)
      .post('/api/friends/requests')
      .set(authHeaderForUser(requester))
      .send({ targetUserId: addressee._id.toString() });

    const requestId = creation.body?.data?.request?._id;

    const response = await request(app)
      .patch(`/api/friends/requests/${requestId}`)
      .set(authHeaderForUser(addressee))
      .send({ action: 'accept' });

    expect(response.status).toBe(200);

    const friendsResponse = await request(app)
      .get('/api/friends')
      .set(authHeaderForUser(requester));

    expect(friendsResponse.status).toBe(200);
    expect(friendsResponse.body?.data?.count).toBe(1);
  });
});

describe('Mocked: PATCH /friends/requests/:requestId', () => {
  // Input: request id
  // Expected status code: 500
  // Expected behavior: error returned
  // Expected output: 500
  // Mock behavior: friendshipModel.findById throws
  test('returns 500 when request lookup fails', async () => {
    const user = await createTestUser();
    const spy = jest
      .spyOn(friendshipModel, 'findById')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .patch(`/api/friends/requests/${new mongoose.Types.ObjectId().toString()}`)
        .set(authHeaderForUser(user))
        .send({ action: 'accept' });

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface DELETE /friends/:friendshipId
describe('Unmocked: DELETE /friends/:friendshipId', () => {
  // Input: existing friendship
  // Expected status code: 200
  // Expected behavior: friendship removed
  // Expected output: success message
  test('removes an accepted friendship', async () => {
    const requester = await createTestUser();
    const addressee = await createTestUser();

    const creation = await request(app)
      .post('/api/friends/requests')
      .set(authHeaderForUser(requester))
      .send({ targetUserId: addressee._id.toString() });
    const requestId = creation.body?.data?.request?._id;

    await request(app)
      .patch(`/api/friends/requests/${requestId}`)
      .set(authHeaderForUser(addressee))
      .send({ action: 'accept' })
      .expect(200);

    const friendshipId = creation.body?.data?.request?._id;

    const response = await request(app)
      .delete(`/api/friends/${friendshipId}`)
      .set(authHeaderForUser(requester));

    expect(response.status).toBe(200);
  });
});

describe('Mocked: DELETE /friends/:friendshipId', () => {
  // Input: friendship id
  // Expected status code: 500
  // Expected behavior: error forwarded
  // Expected output: 500
  // Mock behavior: friendshipModel.deleteFriendship throws
  test('returns 500 when removing friendship fails', async () => {
    const requester = await createTestUser();
    const friendshipId = new mongoose.Types.ObjectId();
    const findSpy = jest
      .spyOn(friendshipModel, 'findById')
      .mockResolvedValueOnce({
        _id: friendshipId,
        requester: requester._id,
        addressee: new mongoose.Types.ObjectId(),
        status: 'accepted',
      } as any);
    const deleteSpy = jest
      .spyOn(friendshipModel, 'deleteFriendship')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .delete(`/api/friends/${friendshipId.toString()}`)
        .set(authHeaderForUser(requester));

      expect(response.status).toBe(500);
    } finally {
      findSpy.mockRestore();
      deleteSpy.mockRestore();
    }
  });
});

// Interface DELETE /friends/requests/:requestId
describe('Unmocked: DELETE /friends/requests/:requestId', () => {
  // Input: pending request cancelled by requester
  // Expected status code: 200
  // Expected behavior: request removed
  // Expected output: success message
  test('cancels a pending friend request', async () => {
    const requester = await createTestUser();
    const addressee = await createTestUser();

    const creation = await request(app)
      .post('/api/friends/requests')
      .set(authHeaderForUser(requester))
      .send({ targetUserId: addressee._id.toString() });

    const requestId = creation.body?.data?.request?._id;

    const response = await request(app)
      .delete(`/api/friends/requests/${requestId}`)
      .set(authHeaderForUser(requester));

    expect(response.status).toBe(200);
  });
});

describe('Mocked: DELETE /friends/requests/:requestId', () => {
  // Input: request id
  // Expected status code: 500
  // Expected behavior: error forwarded
  // Expected output: 500
  // Mock behavior: friendshipModel.deleteFriendship throws
  test('returns 500 when cancelling request fails', async () => {
    const requester = await createTestUser();
    const requestId = new mongoose.Types.ObjectId();
    const findSpy = jest
      .spyOn(friendshipModel, 'findById')
      .mockResolvedValueOnce({
        _id: requestId,
        requester: requester._id,
        addressee: new mongoose.Types.ObjectId(),
        status: 'pending',
      } as any);
    const deleteSpy = jest
      .spyOn(friendshipModel, 'deleteFriendship')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .delete(`/api/friends/requests/${requestId.toString()}`)
        .set(authHeaderForUser(requester));

      expect(response.status).toBe(500);
    } finally {
      findSpy.mockRestore();
      deleteSpy.mockRestore();
    }
  });
});

describe('Mocked: POST /friends/requests', () => {
  // Input: valid target user
  // Expected status code: 500
  // Expected behavior: error bubbled to client
  // Expected output: internal server error
  // Mock behavior: friendshipModel.createRequest throws
  test('returns 500 when creation fails', async () => {
    const currentUser = await createTestUser();
    const targetUser = await createTestUser();
    const spy = jest
      .spyOn(friendshipModel, 'createRequest')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .post('/api/friends/requests')
        .set(authHeaderForUser(currentUser))
        .send({ targetUserId: targetUser._id.toString() });

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /friends/requests
describe('Unmocked: GET /friends/requests', () => {
  // Input: authenticated user with a single outgoing request
  // Expected status code: 200
  // Expected behavior: outgoing query returns array with one item
  // Expected output: response data.count equals 1
  test('returns outgoing requests for the current user', async () => {
    const requester = await createTestUser();
    const addressee = await createTestUser();

    await request(app)
      .post('/api/friends/requests')
      .set(authHeaderForUser(requester))
      .send({ targetUserId: addressee._id.toString() })
      .expect(201);

    const response = await request(app)
      .get('/api/friends/requests')
      .query({ type: 'outgoing' })
      .set(authHeaderForUser(requester));

    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(1);
    expect(Array.isArray(response.body?.data?.requests)).toBe(true);
    expect(response.body?.data?.requests?.[0]?.status).toBe('pending');
  });
});

describe('Mocked: GET /friends/requests', () => {
  // Input: authenticated user
  // Expected status code: 500
  // Expected behavior: error forwarded
  // Expected output: internal server error
  // Mock behavior: friendshipModel.getOutgoingForUser throws
  test('returns 500 when listing requests fails', async () => {
    const requester = await createTestUser();
    const spy = jest
      .spyOn(friendshipModel, 'getOutgoingForUser')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .get('/api/friends/requests')
        .query({ type: 'outgoing' })
        .set(authHeaderForUser(requester));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});
