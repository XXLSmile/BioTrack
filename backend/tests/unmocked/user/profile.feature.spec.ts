import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';

import { createApp } from '../../../src/core/app';
import { userModel } from '../../../src/models/user/user.model';
import { friendshipModel } from '../../../src/models/friends/friend.model';
import { createUserAndToken, createUserAndTokenWithPayload, VALID_GOOGLE_PAYLOAD } from '../auth/helpers';
import { createCustomUser } from './helpers';

const payloadFor = (suffix: string) => ({
  sub: `test-google-id-${suffix}-${Math.floor(Math.random() * 1000)}`,
  email: `user-${suffix}@example.com`,
  name: `User ${suffix}`,
});

const app = createApp();
const api = request(app);
const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;

describe('API: /api/user profile and stats', () => {
  beforeEach(async () => {
    await userModel.deleteAllUsers();
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  });

  afterEach(async () => {
    await userModel.deleteAllUsers();
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
    jest.restoreAllMocks();
  });

  describe('GET /api/user/profile', () => {
    test('returns the signed-in user profile', async () => {
      const token = await createUserAndToken(api);

      const response = await api.get('/api/user/profile').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.message).toBe('Profile fetched successfully');
      expect(response.body?.data?.user?.email).toBe(VALID_GOOGLE_PAYLOAD.email);
    });

    test('rejects requests without authentication', async () => {
      const response = await api.get('/api/user/profile');

      expect(response.status).toBe(401);
      expect(response.body?.error).toBe('Access denied');
      expect(response.body?.message).toBe('Authentication required');
    });

    test('rejects updateProfile requests without authentication', async () => {
      const response = await api.post('/api/user/profile').send({ name: 'Test' });

      expect(response.status).toBe(401);
      expect(response.body?.message).toBe('Authentication required');
    });

    test('updates username field', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .post('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'newusername' });

      expect(response.status).toBe(200);
      expect(response.body?.data?.user?.username).toBe('newusername');
    });

    test('updates region field', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .post('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ region: 'Ontario' });

      expect(response.status).toBe(200);
      expect(response.body?.data?.user?.region).toBe('Ontario');
    });

    test('updates fcmToken field to null', async () => {
      const token = await createUserAndToken(api);
      
      // First set a token
      await api
        .post('/api/user/update-fcm-token')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'test-token' });

      // Then clear it via profile update
      const response = await api
        .post('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ fcmToken: null });

      expect(response.status).toBe(200);
      const stored = await userModel.findByGoogleId(VALID_GOOGLE_PAYLOAD.sub);
      expect(stored?.fcmToken).toBeNull();
    });
  });

  describe('POST /api/user/profile', () => {
    test('updates allowable fields and persists them', async () => {
      const token = await createUserAndToken(api);

      const result = await api
        .post('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Name',
          location: 'Burnaby',
          favoriteSpecies: ['Oryx'],
          isPublicProfile: false,
        });

      expect(result.status).toBe(200);
      expect(result.body?.message).toBe('User info updated successfully');
      expect(result.body?.data?.user?.location).toBe('Burnaby');
      expect(result.body?.data?.user?.favoriteSpecies).toContain('Oryx');

      const stored = await userModel.findByGoogleId(VALID_GOOGLE_PAYLOAD.sub);
      expect(stored?.name).toBe('Updated Name');
      expect(stored?.isPublicProfile).toBe(false);
    });

    test('rejects invalid username format', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .post('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'Bad Username!' });

      expect(response.status).toBe(400);
      expect(response.body?.error).toBe('Validation error');
      expect(response.body?.details?.[0]?.field).toBe('username');
    });

    test('returns conflict when the requested username is already in use', async () => {
      await createCustomUser({ username: 'taken_name' });
      const token = await createUserAndToken(api);

      const response = await api
        .post('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'taken_name' });

      expect(response.status).toBe(409);
      expect(response.body?.message).toBe('Username already taken. Please choose a different username.');
    });

    test('responds with 404 when the update returns null', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'update').mockResolvedValueOnce(null);

      const response = await api
        .post('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ location: 'Nowhere' });

      expect(response.status).toBe(404);
      expect(response.body?.message).toBe('User not found');
    });

    test('returns 500 when update throws', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'update').mockRejectedValueOnce(new Error('boom'));

      const response = await api
        .post('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ location: 'Errorville' });

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('boom');
    });

    test('handles duplicate key error from MongoDB', async () => {
      await createCustomUser({ username: 'taken_name' });
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'update').mockRejectedValueOnce(new Error('E11000 duplicate key error'));

      const response = await api
        .post('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'taken_name' });

      expect(response.status).toBe(409);
      expect(response.body?.message).toBe('Username already taken. Please choose a different username.');
    });

    test('handles non-Error exceptions in updateProfile', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'update').mockRejectedValueOnce('string error');

      const response = await api
        .post('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ location: 'Errorville' });

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    });

    test('requires authentication', async () => {
      const response = await api.post('/api/user/profile').send({ name: 'No Auth' });

      expect(response.status).toBe(401);
      expect(response.body?.message).toBe('Authentication required');
    });
  });

  describe('DELETE /api/user/profile', () => {
    test('deletes the user and all associated data', async () => {
      const token = await createUserAndToken(api);

      const response = await api.delete('/api/user/profile').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.message).toBe('User deleted successfully');
      const stored = await userModel.findByGoogleId(VALID_GOOGLE_PAYLOAD.sub);
      expect(stored).toBeNull();
    });

    test('rejects unauthenticated delete requests', async () => {
      const response = await api.delete('/api/user/profile');

      expect(response.status).toBe(401);
      expect(response.body?.message).toBe('Authentication required');
    });

    test('handles errors during profile deletion', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(friendshipModel, 'deleteAllForUser').mockRejectedValueOnce(new Error('delete failed'));

      const response = await api
        .delete('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .timeout(10000);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('delete failed');
    }, 10000);

    test('handles non-Error exceptions in deleteProfile', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(friendshipModel, 'deleteAllForUser').mockRejectedValueOnce('string error');

      const response = await api
        .delete('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .timeout(10000);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    }, 10000);

    test('handles multiple friend count decrements in deleteProfile', async () => {
      const token = await createUserAndToken(api);
      const userId = await userModel.findByGoogleId(VALID_GOOGLE_PAYLOAD.sub);
      if (!userId) {
        throw new Error('User not found');
      }

      // Mock deleteAllForUser to return some friend IDs to test the decrement path
      const friendId1 = new mongoose.Types.ObjectId();
      const friendId2 = new mongoose.Types.ObjectId();
      jest.spyOn(friendshipModel, 'deleteAllForUser').mockResolvedValueOnce([
        friendId1,
        friendId2,
        friendId1, // Duplicate to test Set deduplication
      ] as any);
      jest.spyOn(userModel, 'decrementFriendCount').mockResolvedValueOnce(undefined);

      const response = await api
        .delete('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .timeout(10000);

      expect(response.status).toBe(200);
      // Should call decrementFriendCount for each unique friend ID
      expect(userModel.decrementFriendCount).toHaveBeenCalledTimes(2);
    }, 10000);
  });

  describe('GET /api/user/stats', () => {
    test('returns observation statistics for the authenticated user', async () => {
      const token = await createUserAndToken(api);

      const response = await api.get('/api/user/stats').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.message).toBe('User stats fetched successfully');
      expect(response.body?.data).toHaveProperty('observationCount');
    });

    test('requires authentication to view stats', async () => {
      const response = await api.get('/api/user/stats');

      expect(response.status).toBe(401);
      expect(response.body?.message).toBe('Authentication required');
    });

    test('returns 404 when user stats not found', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'getUserStats').mockResolvedValueOnce(null);

      const response = await api
        .get('/api/user/stats')
        .set('Authorization', `Bearer ${token}`)
        .timeout(10000);

      expect(response.status).toBe(404);
      expect(response.body?.message).toBe('User stats not found');
    }, 10000);

    test('handles errors when fetching user stats', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'getUserStats').mockRejectedValueOnce(new Error('stats error'));

      const response = await api
        .get('/api/user/stats')
        .set('Authorization', `Bearer ${token}`)
        .timeout(10000);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('stats error');
    }, 10000);

    test('handles non-Error exceptions in getUserStats', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'getUserStats').mockRejectedValueOnce('string error');

      const response = await api
        .get('/api/user/stats')
        .set('Authorization', `Bearer ${token}`)
        .timeout(10000);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    }, 10000);
  });
});
