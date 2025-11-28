// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import mongoose from 'mongoose';

import {
  api,
  createPopulatedUser,
  friendshipModelMock,
  geocodingServiceMock,
  mockAuthMiddleware,
  resetAllMocks,
  userModelMock,
} from './test.utils';

describe('Mocked: API: get friend recommendations flow', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Input: user with location, geocode returns null, Expected status: 200', async () => {
    // Input: user with location, geocode returns null
    // Expected status code: 200
    // Expected behavior: caches null geocode results
    const userId = new mongoose.Types.ObjectId();
    userModelMock.findById.mockResolvedValueOnce({
      _id: userId,
      favoriteSpecies: [],
      location: 'Kelowna',
      region: 'British Columbia',
    });
    friendshipModelMock.getFriendsForUser.mockResolvedValueOnce([]);
    friendshipModelMock.getRelationshipsForUser.mockResolvedValueOnce([]);
    friendshipModelMock.getAcceptedFriendshipsForUsers.mockResolvedValueOnce([]);
    userModelMock.findMany.mockResolvedValueOnce([]);
    geocodingServiceMock.forwardGeocode.mockResolvedValueOnce(undefined);
    mockAuthMiddleware(userId);

    const response = await api
      .get('/api/friends/recommendations')
      .set('Authorization', 'Bearer test-token');

    expect(geocodingServiceMock.forwardGeocode).toHaveBeenCalledWith('Kelowna, British Columbia');
    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(0);
  });

  test('Input: user and candidate share identical address, Expected status: 200', async () => {
    // Input: user and candidate share identical address strings
    // Expected behavior: controller geocodes once, reuses cached coordinates
    const userId = new mongoose.Types.ObjectId();
    const friendId = new mongoose.Types.ObjectId();
    const candidateId = new mongoose.Types.ObjectId();

    userModelMock.findById.mockResolvedValueOnce({
      _id: userId,
      favoriteSpecies: [],
      location: 'Kelowna',
      region: null,
    });

    friendshipModelMock.getFriendsForUser.mockResolvedValueOnce([
      {
        _id: new mongoose.Types.ObjectId(),
        requester: createPopulatedUser(userId, { name: 'User', username: 'user' }),
        addressee: createPopulatedUser(friendId, { name: 'Friend', username: 'friend' }),
        status: 'accepted',
      },
    ]);

    friendshipModelMock.getRelationshipsForUser.mockResolvedValueOnce([]);
    friendshipModelMock.getAcceptedFriendshipsForUsers.mockResolvedValueOnce([
      { requester: friendId, addressee: candidateId, status: 'accepted' },
    ]);

    userModelMock.findMany.mockResolvedValueOnce([
      {
        _id: candidateId,
        name: 'Candidate',
        username: 'candidate',
        favoriteSpecies: [],
        location: 'Kelowna',
        region: null,
      },
    ]);

    geocodingServiceMock.forwardGeocode.mockResolvedValueOnce({
      latitude: 49.2827,
      longitude: -123.1207,
    });

    mockAuthMiddleware(userId);

    const response = await api
      .get('/api/friends/recommendations')
      .set('Authorization', 'Bearer test-token');

    expect(geocodingServiceMock.forwardGeocode).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(1);
    expect(response.body?.data?.recommendations?.[0]?.distanceKm).toBe(0);
  });

  test('Input: candidate already in friend list, Expected status: 200', async () => {
    // Input: candidate already present in current friend list
    // Expected behavior: controller excludes the candidate and returns zero recommendations
    const userId = new mongoose.Types.ObjectId();
    const candidateId = new mongoose.Types.ObjectId();

    userModelMock.findById.mockResolvedValueOnce({
      _id: userId,
      favoriteSpecies: ['owl'],
      location: null,
      region: null,
    });

    friendshipModelMock.getFriendsForUser.mockResolvedValueOnce([
      {
        _id: new mongoose.Types.ObjectId(),
        requester: createPopulatedUser(userId, { name: 'User', username: 'user' }),
        addressee: createPopulatedUser(candidateId, { name: 'Friend', username: 'friend' }),
        status: 'accepted',
      },
    ]);

    friendshipModelMock.getRelationshipsForUser.mockResolvedValueOnce([]);
    friendshipModelMock.getAcceptedFriendshipsForUsers.mockResolvedValueOnce([]);

    userModelMock.findMany.mockResolvedValueOnce([
      {
        _id: candidateId,
        name: 'Candidate',
        username: 'candidate',
        favoriteSpecies: ['owl'],
      },
    ]);

    mockAuthMiddleware(userId);

    const response = await api
      .get('/api/friends/recommendations')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(0);
  });

  test('Input: candidate already related to user, Expected status: 200', async () => {
    // Input: candidate already related to user
    // Expected behavior: excludes related candidates
    const userId = new mongoose.Types.ObjectId();
    const candidateId = new mongoose.Types.ObjectId();
    userModelMock.findById.mockResolvedValueOnce({
      _id: userId,
      favoriteSpecies: ['owl'],
      location: null,
      region: null,
    });
    friendshipModelMock.getFriendsForUser.mockResolvedValueOnce([]);
    friendshipModelMock.getRelationshipsForUser.mockResolvedValueOnce([
      {
        requester: userId,
        addressee: candidateId,
        status: 'accepted',
      },
    ]);
    friendshipModelMock.getAcceptedFriendshipsForUsers.mockResolvedValueOnce([]);
    userModelMock.findMany.mockResolvedValueOnce([
      {
        _id: candidateId,
        name: 'Candidate',
        username: 'candidate',
        favoriteSpecies: ['owl'],
      },
    ]);

    mockAuthMiddleware(userId);

    const response = await api
      .get('/api/friends/recommendations')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(0);
  });

  test('Input: friend-of-friend candidate lacks populated doc, Expected status: 200', async () => {
    // Input: friend-of-friend candidate lacks populated doc
    // Expected behavior: controller loads missing docs and returns hydrated recommendation
    const userId = new mongoose.Types.ObjectId();
    const friendId = new mongoose.Types.ObjectId();
    const candidateId = new mongoose.Types.ObjectId();

    userModelMock.findById.mockResolvedValueOnce({
      _id: userId,
      favoriteSpecies: [],
      location: null,
      region: null,
    });

    friendshipModelMock.getFriendsForUser.mockResolvedValueOnce([
      {
        _id: new mongoose.Types.ObjectId(),
        requester: createPopulatedUser(userId, { name: 'User', username: 'user' }),
        addressee: createPopulatedUser(friendId, { name: 'Friend', username: 'friend' }),
        status: 'accepted',
      },
    ]);

    friendshipModelMock.getRelationshipsForUser.mockResolvedValueOnce([]);
    friendshipModelMock.getAcceptedFriendshipsForUsers.mockResolvedValueOnce([
      { requester: friendId, addressee: candidateId, status: 'accepted' },
    ]);

    userModelMock.findMany.mockResolvedValueOnce([
      {
        _id: candidateId,
        name: 'CandidateDoc',
        username: 'candidateDoc',
        favoriteSpecies: [],
        location: 'Kelowna',
        region: null,
      },
    ]);

    geocodingServiceMock.forwardGeocode.mockResolvedValueOnce(undefined);

    mockAuthMiddleware(userId);

    const response = await api
      .get('/api/friends/recommendations')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.data?.recommendations?.[0]?.user?.username).toBe('candidateDoc');
  });

  test('Input: network friendship with friend as addressee, Expected status: 200', async () => {
    // Input: network friendship where friend appears as addressee
    // Expected behavior: controller maps requester to candidateId and surfaces recommendation
    const userId = new mongoose.Types.ObjectId();
    const friendId = new mongoose.Types.ObjectId();
    const candidateId = new mongoose.Types.ObjectId();

    userModelMock.findById.mockResolvedValueOnce({
      _id: userId,
      favoriteSpecies: [],
      location: null,
      region: null,
    });

    friendshipModelMock.getFriendsForUser.mockResolvedValueOnce([
      {
        _id: new mongoose.Types.ObjectId(),
        requester: createPopulatedUser(userId, { name: 'User', username: 'user' }),
        addressee: createPopulatedUser(friendId, { name: 'Friend', username: 'friend' }),
        status: 'accepted',
      },
    ]);

    friendshipModelMock.getRelationshipsForUser.mockResolvedValueOnce([]);
    friendshipModelMock.getAcceptedFriendshipsForUsers.mockResolvedValueOnce([
      { requester: candidateId, addressee: friendId, status: 'accepted' },
    ]);

    userModelMock.findMany.mockResolvedValueOnce([
      {
        _id: candidateId,
        name: 'CandidateRequester',
        username: 'candidateRequester',
        favoriteSpecies: [],
        location: 'Kelowna',
        region: null,
      },
    ]);

    geocodingServiceMock.forwardGeocode.mockResolvedValueOnce(undefined);

    mockAuthMiddleware(userId);

    const response = await api
      .get('/api/friends/recommendations')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(1);
    expect(response.body?.data?.recommendations?.[0]?.user?.username).toBe('candidateRequester');
  });

  test('Input: network edge targets current user, Expected status: 200', async () => {
    // Input: accepted friendship between a friend and the current user
    // Expected behavior: controller skips the relation without errors
    const userId = new mongoose.Types.ObjectId();
    const friendId = new mongoose.Types.ObjectId();

    userModelMock.findById.mockResolvedValueOnce({
      _id: userId,
      favoriteSpecies: [],
      location: null,
      region: null,
    });

    friendshipModelMock.getFriendsForUser.mockResolvedValueOnce([
      {
        _id: new mongoose.Types.ObjectId(),
        requester: createPopulatedUser(userId, { name: 'User', username: 'user' }),
        addressee: createPopulatedUser(friendId, { name: 'Friend', username: 'friend' }),
        status: 'accepted',
      },
    ]);

    friendshipModelMock.getRelationshipsForUser.mockResolvedValueOnce([]);
    friendshipModelMock.getAcceptedFriendshipsForUsers.mockResolvedValueOnce([
      { requester: friendId, addressee: userId, status: 'accepted' },
    ]);

    mockAuthMiddleware(userId);

    const response = await api
      .get('/api/friends/recommendations')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(0);
    expect(userModelMock.findMany).not.toHaveBeenCalled();
  });

  test('Input: normalized region strings match, Expected status: 200', async () => {
    // Input: normalized region strings should mark candidates as location matches
    // Expected behavior: controller sets locationMatch via normalized region comparison
    const userId = new mongoose.Types.ObjectId();
    const candidateId = new mongoose.Types.ObjectId();

    userModelMock.findById.mockResolvedValueOnce({
      _id: userId,
      favoriteSpecies: ['owl'],
      location: 'Vancouver',
      region: ' British Columbia ',
    });

    friendshipModelMock.getFriendsForUser.mockResolvedValueOnce([]);
    friendshipModelMock.getRelationshipsForUser.mockResolvedValueOnce([]);
    friendshipModelMock.getAcceptedFriendshipsForUsers.mockResolvedValueOnce([]);

    userModelMock.findMany
      .mockResolvedValueOnce([
        {
          _id: candidateId,
          name: 'Candidate',
          username: 'candidate',
          favoriteSpecies: ['owl'],
          location: 'Victoria',
          region: 'british columbia',
        },
      ])
      .mockResolvedValueOnce([]);
    geocodingServiceMock.forwardGeocode.mockResolvedValueOnce(undefined);

    mockAuthMiddleware(userId);

    const response = await api
      .get('/api/friends/recommendations')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.data?.recommendations?.[0]?.locationMatch).toBe(true);
  });

  test('Input: species matches without shared favorites, Expected status: 200', async () => {
    // Input: species matches without shared favorites
    // Expected behavior: ignores species matches without shared favorites
    const userId = new mongoose.Types.ObjectId();
    userModelMock.findById.mockResolvedValueOnce({
      _id: userId,
      favoriteSpecies: ['owl'],
      location: null,
      region: null,
    });
    friendshipModelMock.getFriendsForUser.mockResolvedValueOnce([]);
    friendshipModelMock.getRelationshipsForUser.mockResolvedValueOnce([]);
    friendshipModelMock.getAcceptedFriendshipsForUsers.mockResolvedValueOnce([]);
    userModelMock.findMany.mockResolvedValueOnce([
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Candidate',
        username: 'candidate',
        favoriteSpecies: undefined,
      },
    ]);

    mockAuthMiddleware(userId);

    const response = await api
      .get('/api/friends/recommendations')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(0);
  });

  test('Input: current user not found, Expected status: 404', async () => {
    // Input: current user not found
    // Expected status code: 404
    // Expected behavior: controller responds with not found message
    const userId = new mongoose.Types.ObjectId();
    userModelMock.findById.mockResolvedValueOnce(null);
    mockAuthMiddleware(userId);

    const response = await api
      .get('/api/friends/recommendations')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(404);
    expect(response.body?.message).toMatch(/profile not found/i);
  });

  test('Input: populated social graph with mutual friends and shared species, Expected status: 200', async () => {
    // Input: populated social graph with mutual friends, shared species, and geocoded locations
    // Expected status code: 200
    // Expected behavior: controller scores candidates and returns formatted recommendations
    const userId = new mongoose.Types.ObjectId();
    const friendId = new mongoose.Types.ObjectId();
    const candidateId = new mongoose.Types.ObjectId();

    const currentUser = {
      _id: userId,
      favoriteSpecies: ['owl', 'hawk'],
      location: 'Vancouver',
      region: 'British Columbia',
    };
    userModelMock.findById.mockResolvedValueOnce(currentUser);

    const friendDoc = createPopulatedUser(friendId, {
      name: 'Friend',
      username: 'friend',
      favoriteSpecies: ['sparrow'],
      location: 'Burnaby',
      region: 'British Columbia',
    });

    friendshipModelMock.getFriendsForUser.mockResolvedValueOnce([
      {
        _id: new mongoose.Types.ObjectId(),
        requester: createPopulatedUser(userId, { name: 'User', username: 'user' }),
        addressee: friendDoc,
        respondedAt: new Date(),
        createdAt: new Date(),
        status: 'accepted',
      },
    ]);

    friendshipModelMock.getRelationshipsForUser.mockResolvedValueOnce([
      {
        requester: userId,
        addressee: friendId,
        status: 'accepted',
      },
    ]);

    friendshipModelMock.getAcceptedFriendshipsForUsers.mockResolvedValueOnce([
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

    userModelMock.findMany
      .mockResolvedValueOnce([candidateDoc]) // shared species
      .mockResolvedValueOnce([candidateDoc]) // region match
      .mockResolvedValueOnce([]); // missing docs

    const userCoords = { latitude: 49.2827, longitude: -123.1207 };
    const candidateCoords = { latitude: 49.2488, longitude: -122.9805 };
    geocodingServiceMock.forwardGeocode
      .mockResolvedValueOnce(userCoords)
      .mockResolvedValueOnce(candidateCoords);

    mockAuthMiddleware(userId);

    const response = await api
      .get('/api/friends/recommendations?limit=5')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBe(1);
    const recommendation = response.body?.data?.recommendations?.[0];
    expect(recommendation?.user?.username).toBe('candidate');
    expect(recommendation?.mutualFriends).toHaveLength(1);
    expect(recommendation?.sharedSpecies).toEqual(['owl']);
    expect(recommendation?.score).toBeGreaterThan(0);
  });

  test('Input: repository throws while fetching friends, Expected status: 500', async () => {
    // Input: repository throws while fetching friends
    // Expected behavior: controller forwards error to next
    const userId = new mongoose.Types.ObjectId();
    userModelMock.findById.mockResolvedValueOnce({
      _id: userId,
      favoriteSpecies: [],
      location: null,
      region: null,
    });
    const error = new Error('graph failed');
    friendshipModelMock.getFriendsForUser.mockRejectedValueOnce(error);
    mockAuthMiddleware(userId);

    const response = await api
      .get('/api/friends/recommendations')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });

  test('Input: request lacks authenticated user, Expected status: 401', async () => {
    // Input: no authenticated user
    // Expected status code: 401
    mockAuthMiddleware(undefined);

    const response = await api.get('/api/friends/recommendations');

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
  });
});

