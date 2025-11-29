import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';

import { createApp } from '../../../src/core/app';
import { userModel } from '../../../src/models/user/user.model';
import { createUserAndToken } from '../auth/helpers';
import { createCustomUser, signTokenForUser } from './helpers';

const app = createApp();
const api = request(app);

describe('API: /api/user public endpoints', () => {
  beforeEach(async () => {
    await userModel.deleteAllUsers();
  });

  afterEach(async () => {
    await userModel.deleteAllUsers();
    jest.restoreAllMocks();
  });

  describe('GET /api/user/check-username', () => {
    test('rejects when username query is missing', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .get('/api/user/check-username')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body?.message).toBe('Username is required');
    });

    test('rejects invalid username formats', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .get('/api/user/check-username')
        .query({ username: 'Bad Name!' })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body?.available).toBe(false);
      expect(response.body?.message).toMatch(/Invalid username format/);
    });

    test('reports availability and conflicts', async () => {
    const conflictUsername = `feature_test_${Math.random().toString(36).slice(2, 8)}`;
    const token = await createUserAndToken(api);
    await createCustomUser({ username: conflictUsername });

    const taken = await api
      .get('/api/user/check-username')
      .query({ username: conflictUsername })
      .set('Authorization', `Bearer ${token}`);

      expect(taken.status).toBe(200);
      expect(taken.body?.available).toBe(false);

      const available = await api
        .get('/api/user/check-username')
        .query({ username: 'unique_username' })
        .set('Authorization', `Bearer ${token}`);

      expect(available.status).toBe(200);
      expect(available.body?.available).toBe(true);
    });

    test('requires authentication', async () => {
      const response = await api
        .get('/api/user/check-username')
        .query({ username: 'missing_auth' });

      expect(response.status).toBe(401);
      expect(response.body?.message).toBe('Authentication required');
    });

    test('rejects username shorter than 3 characters', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .get('/api/user/check-username')
        .query({ username: 'ab' })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body?.message).toBe('Username must be between 3 and 30 characters.');
      expect(response.body?.available).toBe(false);
    });

    test('rejects username longer than 30 characters', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .get('/api/user/check-username')
        .query({ username: 'a'.repeat(31) })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body?.message).toBe('Username must be between 3 and 30 characters.');
      expect(response.body?.available).toBe(false);
    });

    test('handles errors when checking username availability', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'isUsernameAvailable').mockRejectedValueOnce(new Error('db error'));

      const response = await api
        .get('/api/user/check-username')
        .query({ username: 'testuser' })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    });
  });

  describe('GET /api/user/search', () => {
    test('filters to public profiles and excludes the requester', async () => {
      await createCustomUser({ name: 'Public Explorer' });
      await createCustomUser({ name: 'Private Explorer', isPublicProfile: false });
      const token = await createUserAndToken(api);

      const response = await api
        .get('/api/user/search')
        .query({ query: 'public' })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.message).toBe('Search completed successfully');
      expect(response.body?.data?.count).toBe(1);
      expect(response.body?.data?.users?.[0]?.name).toBe('Public Explorer');
    });

    test('rejects empty queries', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .get('/api/user/search')
        .set('Authorization', `Bearer ${token}`)
        .query({ query: '' });

      expect(response.status).toBe(400);
      expect(response.body?.message).toBe('Search query is required');
    });

    test('requires authentication', async () => {
      const response = await api.get('/api/user/search').query({ query: 'public' });

      expect(response.status).toBe(401);
      expect(response.body?.message).toBe('Authentication required');
    });

    test('handles internal search failures', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'findById').mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        email: 'placeholder@example.com',
        name: 'Placeholder',
        username: 'placeholder',
        googleId: 'placeholder',
        observationCount: 0,
        speciesDiscovered: 0,
        badges: [],
        favoriteSpecies: [],
        isPublicProfile: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        friendCount: 0,
        location: '',
        region: '',
      } as never);
      jest.spyOn(userModel, 'searchByName').mockRejectedValueOnce(new Error('boom'));

      const response = await api
        .get('/api/user/search')
        .query({ query: 'boom' })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    });

    test('handles errors when searchByName throws', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'findById').mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        email: 'test@example.com',
        name: 'Test',
        username: 'test',
        googleId: 'test',
        observationCount: 0,
        speciesDiscovered: 0,
        badges: [],
        favoriteSpecies: [],
        isPublicProfile: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        friendCount: 0,
        location: '',
        region: '',
      } as never);
      jest.spyOn(userModel, 'searchByName').mockRejectedValueOnce(new Error('search error'));

      const response = await api
        .get('/api/user/search')
        .query({ query: 'test' })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    });

    test('handles search when user is authenticated but excludes self from results', async () => {
      // User is authenticated, so currentUserId is defined
      const token = await createUserAndToken(api);
      const publicUser = await createCustomUser({ username: 'public_search', isPublicProfile: true });

      const response = await api
        .get('/api/user/search')
        .query({ query: 'public' })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.data?.users).toBeDefined();
      // Should return public users but exclude the authenticated user
      const currentUser = await userModel.findByGoogleId('test-google-id');
      if (currentUser) {
        const userInResults = response.body?.data?.users?.find(
          (u: any) => u._id === currentUser._id.toString()
        );
        expect(userInResults).toBeUndefined();
      }
    });
  });

  describe('GET /api/user/username/:username and /profile/:username', () => {
    test('returns public user data', async () => {
      const other = await createCustomUser({ name: 'Public Explorer', username: 'publicuser' });
      const token = await createUserAndToken(api);

      const response = await api
        .get(`/api/user/username/${other.username}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.data?.user?.username).toBe(other.username);
    });

    test('rejects private profiles for non-owners', async () => {
      await createCustomUser({ username: 'private_user', isPublicProfile: false });
      const token = await createUserAndToken(api);

      const response = await api
        .get('/api/user/username/private_user')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body?.message).toBe('This profile is private');
    });

    test('allows the owner to read their own private profile', async () => {
      const privateUser = await createCustomUser({
        username: 'private_user',
        isPublicProfile: false,
      });
      const privateToken = signTokenForUser(privateUser);

      const response = await api
        .get(`/api/user/profile/${privateUser.username}`)
        .set('Authorization', `Bearer ${privateToken}`);

      expect(response.status).toBe(200);
      expect(response.body?.data?.user?._id).toBe(privateUser._id.toString());
    });

    test('returns 404 when the username does not exist', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .get('/api/user/username/unknown')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body?.message).toBe('User not found');
    });

    test('handles repository errors gracefully', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'findByUsername').mockRejectedValueOnce(new Error('boom'));

      const response = await api
        .get('/api/user/username/error-case')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    });

    test('handles errors when fetching user by name', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'findByName').mockRejectedValueOnce(new Error('db error'));

      const response = await api
        .get('/api/user/name/Test%20Name')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    });
  });

  describe('GET /api/user/name/:username', () => {
    test('is case-insensitive and returns the user profile', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .get('/api/user/name/feature%20test')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.data?.user).toHaveProperty('name');
    });

    test('returns 404 when the name is missing', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .get('/api/user/name/doesnotexist')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body?.message).toBe('User not found');
    });

    test('rejects private profiles when not the owner', async () => {
      await createCustomUser({ username: 'private_user', isPublicProfile: false, name: 'Private' });
      const token = await createUserAndToken(api);

      const response = await api
        .get('/api/user/name/Private')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body?.message).toBe('This profile is private');
    });
  });

  describe('GET /api/user/:userId', () => {
    test('returns the requested public profile', async () => {
      const other = await createCustomUser({ name: 'Public Explorer' });
      const token = await createUserAndToken(api);

      const response = await api
        .get(`/api/user/${other._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.data?.user?._id).toBe(other._id.toString());
    });

    test('rejects private profiles for other users', async () => {
      const privateUser = await createCustomUser({
        username: 'private_user',
        isPublicProfile: false,
      });
      const token = await createUserAndToken(api);

      const response = await api
        .get(`/api/user/${privateUser._id}`)
        .set('Authorization', `Bearer ${token}`)
        .timeout(10000);

      expect(response.status).toBe(403);
      expect(response.body?.message).toBe('This profile is private');
    }, 10000);

    test('returns 404 when the user is not found', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .get(`/api/user/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${token}`)
        .timeout(10000);

      expect(response.status).toBe(404);
      expect(response.body?.message).toBe('User not found');
    }, 10000);

    test('handles errors thrown by the repository', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'findById').mockRejectedValueOnce(new Error('boom'));

      const response = await api
        .get(`/api/user/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${token}`)
        .timeout(10000);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    }, 10000);

    test('returns 500 when the userId parameter is invalid', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .get('/api/user/not-an-object-id')
        .set('Authorization', `Bearer ${token}`)
        .timeout(10000);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    }, 10000);
  });
});
