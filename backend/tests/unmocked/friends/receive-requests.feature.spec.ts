import request from 'supertest';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { createApp } from '../../../src/core/app';
import {
  cancelFriendRequest,
  dropTestDb,
  registerUser,
  respondFriendRequest,
  sendFriendRequest,
} from './test.utils';

const app = createApp();
const api = request(app);

// Interface /api/friends/requests operations
// Input: authenticated user requesting incoming/outgoing lists, acting on request IDs for accept/decline/cancel
// Expected status code: 200 for listings and state changes, 401 when unauthenticated
// Expected behavior: allows users to view their requests, accept/decline incoming, cancel outgoing, rejects unauthenticated calls
// Expected output: request counts/messages or error detail
describe('API: /api/friends/requests operations', () => {
  beforeEach(async () => {
    await dropTestDb();
  });

  afterEach(async () => {
    await dropTestDb();
    jest.restoreAllMocks();
  });

  test('lists incoming and outgoing requests', async () => {
    const alice = await registerUser(api, 'alice-list');
    const bob = await registerUser(api, 'bob-list');

    await sendFriendRequest(api, alice.token, bob.user._id.toString());

    const incoming = await api.get('/api/friends/requests').set('Authorization', `Bearer ${bob.token}`);
    expect(incoming.status).toBe(200);
    expect(incoming.body?.message).toContain('Incoming');
    expect(incoming.body?.data?.count).toBe(1);

    const outgoing = await api
      .get('/api/friends/requests')
      .set('Authorization', `Bearer ${alice.token}`)
      .query({ type: 'outgoing' });
    expect(outgoing.status).toBe(200);
    expect(outgoing.body?.message).toContain('Outgoing');
    expect(outgoing.body?.data?.count).toBe(1);
  });

  test('accepts a pending request', async () => {
    const requester = await registerUser(api, 'accept-requester');
    const recipient = await registerUser(api, 'accept-recipient');

    const create = await sendFriendRequest(api, requester.token, recipient.user._id.toString());
    const requestId = create.body?.data?.request?._id;
    const accept = await respondFriendRequest(api, recipient.token, requestId, 'accept');

    expect(accept.status).toBe(200);
    expect(accept.body?.data?.request?.status).toBe('accepted');
  });

  test('declines a pending request', async () => {
    const requester = await registerUser(api, 'decline-requester');
    const target = await registerUser(api, 'decline-target');

    const create = await sendFriendRequest(api, requester.token, target.user._id.toString());
    const requestId = create.body?.data?.request?._id;
    const decline = await respondFriendRequest(api, target.token, requestId, 'decline');

    expect(decline.status).toBe(200);
    expect(decline.body?.message).toContain('declined successfully');
  });

  test('cancels a sent request', async () => {
    const sender = await registerUser(api, 'cancel-sender');
    const receiver = await registerUser(api, 'cancel-receiver');

    const create = await sendFriendRequest(api, sender.token, receiver.user._id.toString());
    const requestId = create.body?.data?.request?._id;
    const cancel = await cancelFriendRequest(api, sender.token, requestId);

    expect(cancel.status).toBe(200);
    expect(cancel.body?.message).toContain('cancelled successfully');

    const incoming = await api.get('/api/friends/requests').set('Authorization', `Bearer ${receiver.token}`);
    expect(incoming.body?.data?.count).toBe(0);
  });

  test('requires authentication for request management', async () => {
    const response = await api.get('/api/friends/requests');

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
  });
});
