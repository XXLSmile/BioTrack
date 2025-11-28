import request from 'supertest';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../../../src/services/location/geocoding.service', () => ({
  geocodingService: {
    forwardGeocode: jest.fn(async () => ({
      latitude: 49.2827,
      longitude: -123.1207,
    })),
  },
}));

import { createApp } from '../../../src/core/app';
import {
  dropTestDb,
  registerUser,
  respondFriendRequest,
  sendFriendRequest,
} from './test.utils';

const app = createApp();
const api = request(app);

describe('API: GET /api/friends/recommendations', () => {
  beforeEach(async () => {
    await dropTestDb();
  });

  afterEach(async () => {
    await dropTestDb();
    jest.restoreAllMocks();
  });

  test('requires authentication', async () => {
    const response = await api.get('/api/friends/recommendations');
    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
  });

  test('provides friend recommendations based on mutual connections', async () => {
    const alice = await registerUser(api, 'recommend-alice');
    const bob = await registerUser(api, 'recommend-bob');
    const carol = await registerUser(api, 'recommend-carol');

    const aliceRequest = await sendFriendRequest(api, alice.token, bob.user._id.toString());
    const aliceRequestId = aliceRequest.body?.data?.request?._id;
    await respondFriendRequest(api, bob.token, aliceRequestId, 'accept');

    const carolRequest = await sendFriendRequest(api, carol.token, bob.user._id.toString());
    const carolRequestId = carolRequest.body?.data?.request?._id;
    await respondFriendRequest(api, bob.token, carolRequestId, 'accept');

    const response = await api
      .get('/api/friends/recommendations')
      .set('Authorization', `Bearer ${alice.token}`)
      .query({ limit: '5' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body?.data?.recommendations)).toBe(true);
    expect(response.body?.data?.count).toBeGreaterThanOrEqual(1);
    const candidate = response.body?.data?.recommendations?.find(
      (rec: any) => rec?.user?.username === carol.user?.username
    );
    expect(candidate).toBeDefined();
  });

  test('handles friendships with missing populated user data in recommendations', async () => {
    const alice = await registerUser(api, 'recommend-alice-warn');
    const bob = await registerUser(api, 'recommend-bob-warn');

    const aliceRequest = await sendFriendRequest(api, alice.token, bob.user._id.toString());
    const aliceRequestId = aliceRequest.body?.data?.request?._id;
    await respondFriendRequest(api, bob.token, aliceRequestId, 'accept');

    // Mock getFriendsForUser to return friendship with unpopulated user
    const friendshipModel = require('../../../src/models/friends/friend.model');
    const originalGetFriends = friendshipModel.friendshipModel.getFriendsForUser;
    const friendships = await friendshipModel.friendshipModel.getFriendsForUser(alice.user._id);
    
    // Create a friendship with unpopulated ObjectId instead of populated user
    const mockFriendship = {
      ...friendships[0],
      addressee: bob.user._id, // ObjectId instead of populated user
    };
    
    jest.spyOn(friendshipModel.friendshipModel, 'getFriendsForUser').mockResolvedValueOnce([mockFriendship]);

    const response = await api
      .get('/api/friends/recommendations')
      .set('Authorization', `Bearer ${alice.token}`)
      .query({ limit: '5' });

    expect(response.status).toBe(200);
    // Should handle gracefully and continue processing

    friendshipModel.friendshipModel.getFriendsForUser = originalGetFriends;
  });
});
