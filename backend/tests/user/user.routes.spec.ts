import request from 'supertest';
import mongoose from 'mongoose';

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
import { userModel } from '../../src/user/user.model';
import type { IUser } from '../../src/user/user.types';
import {
  authHeaderForUser,
  createTestUser,
  toObjectId,
} from '../utils/testHelpers';

const app = createApp();

const fetchUser = async (id: mongoose.Types.ObjectId) =>
  userModel.findById(id);

// Interface GET /user/profile
describe('Unmocked: GET /user/profile', () => {
  // Input: authenticated request
  // Expected status code: 200
  // Expected behavior: returns current user info
  // Expected output: message & user data
  test('returns the authenticated user profile', async () => {
    const currentUser = await createTestUser();

    const response = await request(app)
      .get('/api/user/profile')
      .set(authHeaderForUser(currentUser));

    expect(response.status).toBe(200);
    expect(response.body?.data?.user?._id).toBe(
      currentUser._id.toString()
    );
  });
});

describe('Mocked: GET /user/profile', () => {
  // Input: authenticated request
  // Expected status code: 500
  // Expected behavior: propagates DB errors from auth middleware
  // Expected output: internal server error
  // Mock behavior: userModel.findById throws during authentication
  test('returns 500 when authentication lookup fails', async () => {
    const currentUser = await createTestUser();
    const spy = jest
      .spyOn(userModel, 'findById')
      .mockRejectedValueOnce(new Error('db down'));

    try {
      const response = await request(app)
        .get('/api/user/profile')
        .set(authHeaderForUser(currentUser));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface POST /user/profile
describe('Unmocked: POST /user/profile', () => {
  // Input: authenticated user with valid update fields
  // Expected status code: 200
  // Expected behavior: userModel.update persists changes
  // Expected output: updated user info
  test('updates the user profile when data is valid', async () => {
    const currentUser = await createTestUser();

    const response = await request(app)
      .post('/api/user/profile')
      .set(authHeaderForUser(currentUser))
      .send({ name: 'Updated Name', location: 'Vancouver' });

    expect(response.status).toBe(200);
    expect(response.body?.data?.user?.name).toBe('Updated Name');

    const reloaded = await fetchUser(currentUser._id);
    expect(reloaded?.location).toBe('Vancouver');
  });
});

describe('Mocked: POST /user/profile', () => {
  // Input: valid payload
  // Expected status code: 500
  // Expected behavior: handles update failures gracefully
  // Expected output: internal server error message
  // Mock behavior: userModel.update throws
  test('returns 500 when update fails', async () => {
    const currentUser = await createTestUser();
    const spy = jest
      .spyOn(userModel, 'update')
      .mockRejectedValueOnce(new Error('update failed'));

    try {
      const response = await request(app)
        .post('/api/user/profile')
        .set(authHeaderForUser(currentUser))
        .send({ name: 'Another Name' });

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface DELETE /user/profile
describe('Unmocked: DELETE /user/profile', () => {
  // Input: authenticated request
  // Expected status code: 200
  // Expected behavior: deletes user and related friendships
  // Expected output: success message
  test('deletes the profile successfully', async () => {
    const currentUser = await createTestUser();

    const response = await request(app)
      .delete('/api/user/profile')
      .set(authHeaderForUser(currentUser));

    expect(response.status).toBe(200);
    const reloaded = await fetchUser(currentUser._id);
    expect(reloaded).toBeNull();
  });
});

describe('Mocked: DELETE /user/profile', () => {
  // Input: authenticated request
  // Expected status code: 500
  // Expected behavior: error bubble up
  // Expected output: internal server error
  // Mock behavior: userModel.delete throws
  test('returns 500 when deletion fails', async () => {
    const currentUser = await createTestUser();
    const spy = jest
      .spyOn(userModel, 'delete')
      .mockRejectedValueOnce(new Error('delete failed'));

    try {
      const response = await request(app)
        .delete('/api/user/profile')
        .set(authHeaderForUser(currentUser));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /user/check-username
describe('Unmocked: GET /user/check-username', () => {
  // Input: available username
  // Expected status code: 200
  // Expected behavior: indicates availability
  // Expected output: available = true
  test('confirms availability for new username', async () => {
    const currentUser = await createTestUser();

    const response = await request(app)
      .get('/api/user/check-username')
      .query({ username: 'new_name' })
      .set(authHeaderForUser(currentUser));

    expect(response.status).toBe(200);
    expect(response.body?.available).toBe(true);
  });
});

describe('Mocked: GET /user/check-username', () => {
  // Input: valid username
  // Expected status code: 500
  // Expected behavior: handles backend errors
  // Expected output: internal server error
  // Mock behavior: userModel.isUsernameAvailable throws
  test('returns 500 when availability check fails', async () => {
    const currentUser = await createTestUser();
    const spy = jest
      .spyOn(userModel, 'isUsernameAvailable')
      .mockRejectedValueOnce(new Error('db down'));

    try {
      const response = await request(app)
        .get('/api/user/check-username')
        .query({ username: 'valid_name' })
        .set(authHeaderForUser(currentUser));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /user/search
describe('Unmocked: GET /user/search', () => {
  // Input: query matching a public user
  // Expected status code: 200
  // Expected behavior: returns matching public accounts
  // Expected output: list containing target user
  test('returns public users matching query', async () => {
    const currentUser = await createTestUser({ username: 'searcher' } as Partial<IUser>);
    await createTestUser({
      name: 'Atlas Explorer',
      username: 'atlas_explorer',
      isPublicProfile: true,
    } as Partial<IUser>);

    const response = await request(app)
      .get('/api/user/search')
      .query({ query: 'atlas' })
      .set(authHeaderForUser(currentUser));

    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBeGreaterThanOrEqual(1);
  });
});

describe('Mocked: GET /user/search', () => {
  // Input: query string
  // Expected status code: 500
  // Expected behavior: server error forwarded
  // Expected output: 500 status
  // Mock behavior: userModel.searchByName throws
  test('returns 500 when search fails', async () => {
    const currentUser = await createTestUser();
    const spy = jest
      .spyOn(userModel, 'searchByName')
      .mockRejectedValueOnce(new Error('search failure'));

    try {
      const response = await request(app)
        .get('/api/user/search')
        .query({ query: 'anything' })
        .set(authHeaderForUser(currentUser));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /user/stats
describe('Unmocked: GET /user/stats', () => {
  // Input: authenticated request
  // Expected status code: 200
  // Expected behavior: returns stats object
  // Expected output: counts from user document
  test('returns stats for current user', async () => {
    const currentUser = await createTestUser({
      observationCount: 3,
      speciesDiscovered: 2,
      friendCount: 1,
      badges: ['starter'],
    } as Partial<IUser>);

    const response = await request(app)
      .get('/api/user/stats')
      .set(authHeaderForUser(currentUser));

    expect(response.status).toBe(200);
    expect(response.body?.data?.observationCount).toBeGreaterThanOrEqual(0);
  });
});

describe('Mocked: GET /user/stats', () => {
  // Input: authenticated request
  // Expected status code: 500
  // Expected behavior: server error forwarded
  // Expected output: internal server error
  // Mock behavior: userModel.getUserStats throws
  test('returns 500 when stats lookup fails', async () => {
    const currentUser = await createTestUser();
    const spy = jest
      .spyOn(userModel, 'getUserStats')
      .mockRejectedValueOnce(new Error('stats failure'));

    try {
      const response = await request(app)
        .get('/api/user/stats')
        .set(authHeaderForUser(currentUser));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface POST /user/favorite-species
describe('Unmocked: POST /user/favorite-species', () => {
  // Input: speciesName in body
  // Expected status code: 200
  // Expected behavior: species added to favorites
  // Expected output: success message
  test('adds species to favorites', async () => {
    const currentUser = await createTestUser();

    const response = await request(app)
      .post('/api/user/favorite-species')
      .set(authHeaderForUser(currentUser))
      .send({ speciesName: 'Bald Eagle' });

    expect(response.status).toBe(200);
    const reloaded = await fetchUser(currentUser._id);
    expect(reloaded?.favoriteSpecies).toContain('Bald Eagle');
  });
});

describe('Mocked: POST /user/favorite-species', () => {
  // Input: speciesName provided
  // Expected status code: 500
  // Expected behavior: error returned
  // Expected output: internal server error
  // Mock behavior: userModel.addFavoriteSpecies throws
  test('returns 500 when add fails', async () => {
    const currentUser = await createTestUser();
    const spy = jest
      .spyOn(userModel, 'addFavoriteSpecies')
      .mockRejectedValueOnce(new Error('mongo failure'));

    try {
      const response = await request(app)
        .post('/api/user/favorite-species')
        .set(authHeaderForUser(currentUser))
        .send({ speciesName: 'Bald Eagle' });

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface DELETE /user/favorite-species
describe('Unmocked: DELETE /user/favorite-species', () => {
  // Input: speciesName body
  // Expected status code: 200
  // Expected behavior: species removed
  // Expected output: success response
  test('removes species from favorites', async () => {
    const currentUser = await createTestUser();
    await userModel.addFavoriteSpecies(currentUser._id, 'Orca');

    const response = await request(app)
      .delete('/api/user/favorite-species')
      .set(authHeaderForUser(currentUser))
      .send({ speciesName: 'Orca' });

    expect(response.status).toBe(200);
    const reloaded = await fetchUser(currentUser._id);
    expect(reloaded?.favoriteSpecies).not.toContain('Orca');
  });
});

describe('Mocked: DELETE /user/favorite-species', () => {
  // Input: speciesName provided
  // Expected status code: 500
  // Expected behavior: surfaces backend error
  // Expected output: internal server error
  // Mock behavior: userModel.removeFavoriteSpecies throws
  test('returns 500 when removal fails', async () => {
    const currentUser = await createTestUser();
    const spy = jest
      .spyOn(userModel, 'removeFavoriteSpecies')
      .mockRejectedValueOnce(new Error('mongo failure'));

    try {
      const response = await request(app)
        .delete('/api/user/favorite-species')
        .set(authHeaderForUser(currentUser))
        .send({ speciesName: 'Orca' });

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface POST /user/update-fcm-token
describe('Unmocked: POST /user/update-fcm-token', () => {
  // Input: token string
  // Expected status code: 200
  // Expected behavior: token stored on user
  // Expected output: message 'Token updated'
  test('stores FCM token', async () => {
    const currentUser = await createTestUser();

    const response = await request(app)
      .post('/api/user/update-fcm-token')
      .set(authHeaderForUser(currentUser))
      .send({ token: 'fcm-123' });

    expect(response.status).toBe(200);
    const reloaded = await fetchUser(currentUser._id);
    expect(reloaded?.fcmToken).toBe('fcm-123');
  });
});

describe('Mocked: POST /user/update-fcm-token', () => {
  // Input: valid token string
  // Expected status code: 500
  // Expected behavior: error returned
  // Expected output: internal server error
  // Mock behavior: userModel.update throws
  test('returns 500 when token update fails', async () => {
    const currentUser = await createTestUser();
    const spy = jest
      .spyOn(userModel, 'update')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .post('/api/user/update-fcm-token')
        .set(authHeaderForUser(currentUser))
        .send({ token: 'fcm-123' });

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface DELETE /user/fcm-token
describe('Unmocked: DELETE /user/fcm-token', () => {
  // Input: authenticated request
  // Expected status code: 200
  // Expected behavior: token cleared
  // Expected output: message 'Token cleared'
  test('clears stored FCM token', async () => {
    const currentUser = await createTestUser();
    await userModel.update(currentUser._id, { fcmToken: 'existing' } as Partial<IUser>);

    const response = await request(app)
      .delete('/api/user/fcm-token')
      .set(authHeaderForUser(currentUser));

    expect(response.status).toBe(200);
    const reloaded = await fetchUser(currentUser._id);
    expect(reloaded?.fcmToken).toBeNull();
  });
});

describe('Mocked: DELETE /user/fcm-token', () => {
  // Input: authenticated request
  // Expected status code: 500
  // Expected behavior: server error forwarded
  // Expected output: internal server error
  // Mock behavior: userModel.update throws
  test('returns 500 when clearing token fails', async () => {
    const currentUser = await createTestUser();
    const spy = jest
      .spyOn(userModel, 'update')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .delete('/api/user/fcm-token')
        .set(authHeaderForUser(currentUser));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /user/:userId
describe('Unmocked: GET /user/:userId', () => {
  // Input: request for another public user
  // Expected status code: 200
  // Expected behavior: returns public profile
  // Expected output: data.user populated
  test('returns public profile by user id', async () => {
    const requester = await createTestUser();
    const target = await createTestUser({
      isPublicProfile: true,
      username: 'public_user',
    } as Partial<IUser>);

    const response = await request(app)
      .get(`/api/user/${target._id.toString()}`)
      .set(authHeaderForUser(requester));

    expect(response.status).toBe(200);
    expect(response.body?.data?.user?._id).toBe(target._id.toString());
  });
});

describe('Mocked: GET /user/:userId', () => {
  // Input: request for user
  // Expected status code: 500
  // Expected behavior: surfaces repository failure
  // Expected output: internal server error
  // Mock behavior: userModel.findById throws
  test('returns 500 when lookup fails', async () => {
    const requester = await createTestUser();
    const spy = jest
      .spyOn(userModel, 'findById')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .get(`/api/user/${new mongoose.Types.ObjectId().toString()}`)
        .set(authHeaderForUser(requester));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /user/profile/:username
describe('Unmocked: GET /user/profile/:username', () => {
  // Input: request by username
  // Expected status code: 200
  // Expected behavior: returns profile when accessible
  // Expected output: user data
  test('returns profile by username', async () => {
    const requester = await createTestUser();
    const createdTarget = await createTestUser();
    const updatedTarget = await userModel.update(createdTarget._id, {
      username: 'profile_target',
      isPublicProfile: true,
    } as Partial<IUser>);
    const target = updatedTarget ?? createdTarget;

    const response = await request(app)
      .get(`/api/user/profile/${target.username}`)
      .set(authHeaderForUser(requester));

    expect(response.status).toBe(200);
    expect(response.body?.data?.user?.username).toBe('profile_target');
  });
});

describe('Mocked: GET /user/profile/:username', () => {
  // Input: request by username
  // Expected status code: 500
  // Expected behavior: surfaces lookup error
  // Expected output: internal server error
  // Mock behavior: userModel.findByUsername throws
  test('returns 500 when username lookup fails', async () => {
    const requester = await createTestUser();
    const spy = jest
      .spyOn(userModel, 'findByUsername')
      .mockImplementationOnce(() => {
        throw new Error('db failure');
      });

    try {
      const response = await request(app)
        .get('/api/user/profile/anyone')
        .set(authHeaderForUser(requester));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /user/username/:username
describe('Unmocked: GET /user/username/:username', () => {
  // Input: request by username slug
  // Expected status code: 200
  // Expected behavior: returns profile when accessible
  // Expected output: user data
  test('returns profile by username slug', async () => {
    const requester = await createTestUser();
    const createdTarget = await createTestUser();
    const updatedTarget = await userModel.update(createdTarget._id, {
      username: 'slug_target',
      isPublicProfile: true,
    } as Partial<IUser>);
    const target = updatedTarget ?? createdTarget;

    const response = await request(app)
      .get(`/api/user/username/${target.username}`)
      .set(authHeaderForUser(requester));

    expect(response.status).toBe(200);
    expect(response.body?.data?.user?.username).toBe(target.username);
  });
});

describe('Mocked: GET /user/username/:username', () => {
  // Input: username slug
  // Expected status code: 500
  // Expected behavior: surfaces lookup error
  // Expected output: internal server error
  // Mock behavior: userModel.findByUsername throws
  test('returns 500 when lookup fails', async () => {
    const requester = await createTestUser();
    const spy = jest
      .spyOn(userModel, 'findByUsername')
      .mockImplementationOnce(() => {
        throw new Error('db failure');
      });

    try {
      const response = await request(app)
        .get('/api/user/username/slug_target')
        .set(authHeaderForUser(requester));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /user/name/:username
describe('Unmocked: GET /user/name/:username', () => {
  // Input: request by display name
  // Expected status code: 200
  // Expected behavior: returns user when accessible
  // Expected output: user data
  test('returns profile by display name', async () => {
    const requester = await createTestUser();
    const target = await createTestUser({
      name: 'River Runner',
      username: 'river_runner',
      isPublicProfile: true,
    } as Partial<IUser>);

    const response = await request(app)
      .get('/api/user/name/River Runner')
      .set(authHeaderForUser(requester));

    expect(response.status).toBe(200);
    expect(response.body?.data?.user?.name).toBe('River Runner');
  });
});

describe('Mocked: GET /user/name/:username', () => {
  // Input: request by display name
  // Expected status code: 500
  // Expected behavior: surfaces lookup error
  // Expected output: internal server error
  // Mock behavior: userModel.findByName throws
  test('returns 500 when name lookup fails', async () => {
    const requester = await createTestUser();
    const spy = jest
      .spyOn(userModel, 'findByName')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .get('/api/user/name/Someone')
        .set(authHeaderForUser(requester));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});
