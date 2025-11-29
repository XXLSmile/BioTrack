import request from 'supertest';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { createApp } from '../../../src/core/app';
import { dropTestDb, registerUser, respondFriendRequest, sendFriendRequest } from './test.utils';

const app = createApp();
const api = request(app);

describe('API: GET /api/friends', () => {
  beforeEach(async () => {
    await dropTestDb();
  });

  afterEach(async () => {
    await dropTestDb();
    jest.restoreAllMocks();
  });

  const acceptRequest = async (senderToken: string, recipientToken: string, recipientId: string) => {
    const creation = await sendFriendRequest(api, senderToken, recipientId);
    const requestId = creation.body?.data?.request?._id;
    await respondFriendRequest(api, recipientToken, requestId, 'accept');
  };

  test('returns accepted friends after mutual confirmation', async () => {
    const alice = await registerUser(api, 'list-alice');
    const bob = await registerUser(api, 'list-bob');

    await acceptRequest(alice.token, bob.token, bob.user._id.toString());

    const response = await api.get('/api/friends').set('Authorization', `Bearer ${alice.token}`);

    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(1);
    expect(response.body?.data?.friends?.[0]?.user?.username).toBe(bob.user?.username);
  });

  test('rejects unauthorized access', async () => {
    const response = await api.get('/api/friends');
    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
  });

  test('handles friendships with missing populated user data', async () => {
    const alice = await registerUser(api, 'list-alice');
    const bob = await registerUser(api, 'list-bob');

    await acceptRequest(alice.token, bob.token, bob.user._id.toString());

    // Mock getFriendsForUser to return friendship with unpopulated user (ObjectId instead of populated document)
    const friendshipModel = require('../../../src/models/friends/friend.model');
    const originalGetFriends = friendshipModel.friendshipModel.getFriendsForUser;
    const mongoose = require('mongoose');
    
    // Create a mock friendship where requester is an ObjectId (not populated)
    const mockFriendship = {
      _id: new mongoose.Types.ObjectId(),
      requester: alice.user._id, // ObjectId, not populated
      addressee: bob.user._id, // ObjectId, not populated
      status: 'accepted',
      createdAt: new Date(),
      respondedAt: new Date(),
    };
    
    jest.spyOn(friendshipModel.friendshipModel, 'getFriendsForUser').mockResolvedValueOnce([mockFriendship]);

    const response = await api.get('/api/friends').set('Authorization', `Bearer ${alice.token}`);

    expect(response.status).toBe(200);
    expect(response.body?.data?.friends).toHaveLength(0); // Should filter out null entries due to unpopulated users

    friendshipModel.friendshipModel.getFriendsForUser = originalGetFriends;
  });
});
