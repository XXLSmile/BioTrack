import request from 'supertest';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { createApp } from '../../../src/core/app';
import { dropTestDb, registerUser, sendFriendRequest } from './test.utils';

const app = createApp();
const api = request(app);

// Interface POST /api/friends/requests
// Input: authenticated user with targetUserId to invite
// Expected status code: 201 on new request, 400 for self-requests, 404 for missing targets, 409 for duplicates, 401 when unauthenticated
// Expected behavior: creates pending requests for valid targets, rejects self or duplicate attempts, enforces authentication
// Expected output: pending request payload or error message
describe('API: POST /api/friends/requests', () => {
  beforeEach(async () => {
    await dropTestDb();
  });

  afterEach(async () => {
    await dropTestDb();
    jest.restoreAllMocks();
  });

  test('creates a friend request for an existing user', async () => {
    const alice = await registerUser(api, 'alice');
    const bob = await registerUser(api, 'bob');

    const response = await sendFriendRequest(api, alice.token, bob.user._id.toString());

    expect(response.status).toBe(201);
    expect(response.body?.data?.request?.status).toBe('pending');
  });

  test('rejects self requests', async () => {
    const { token, user } = await registerUser(api, 'self');

    const response = await sendFriendRequest(api, token, user._id.toString());

    expect(response.status).toBe(400);
    expect(response.body?.message).toBe('You cannot send a friend request to yourself');
  });

  test('prevents duplicate pending requests', async () => {
    const requester = await registerUser(api, 'requester');
    const target = await registerUser(api, 'target');

    await sendFriendRequest(api, requester.token, target.user._id.toString());
    const duplicate = await sendFriendRequest(api, requester.token, target.user._id.toString());

    expect(duplicate.status).toBe(409);
    expect(duplicate.body?.message).toBe('Friend request already pending');
  });

  test('returns 404 for missing target', async () => {
    const requester = await registerUser(api, 'requester-missing');
    const missingId = '64b8d2f8c7b1d1a2ee9d3f00';

    const response = await sendFriendRequest(api, requester.token, missingId);

    expect(response.status).toBe(404);
    expect(response.body?.message).toBe('Target user not found');
  });

  test('requires authentication', async () => {
    const response = await api.post('/api/friends/requests').send({ targetUserId: '123' });

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
  });
});
