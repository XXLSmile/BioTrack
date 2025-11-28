import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import { createApp } from '../../../src/core/app';
import { userModel } from '../../../src/models/user/user.model';
import { createUserAndToken, VALID_GOOGLE_PAYLOAD } from '../auth/helpers';

const app = createApp();
const api = request(app);

describe('API: /api/user FCM token endpoints', () => {
  beforeEach(async () => {
    await userModel.deleteAllUsers();
  });

  afterEach(async () => {
    await userModel.deleteAllUsers();
    jest.restoreAllMocks();
  });

  describe('POST /api/user/update-fcm-token', () => {
    test('updates FCM token for authenticated user', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .post('/api/user/update-fcm-token')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'test-fcm-token-123' });

      expect(response.status).toBe(200);
      expect(response.body?.message).toBe('Token updated');

      const stored = await userModel.findByGoogleId(VALID_GOOGLE_PAYLOAD.sub);
      expect(stored?.fcmToken).toBe('test-fcm-token-123');
    });

    test('rejects empty token', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .post('/api/user/update-fcm-token')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: '   ' });

      expect(response.status).toBe(400);
      expect(response.body?.message).toBe('A valid FCM token is required');
    });

    test('rejects missing token', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .post('/api/user/update-fcm-token')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body?.message).toBe('A valid FCM token is required');
    });

    test('rejects non-string token', async () => {
      const token = await createUserAndToken(api);

      const response = await api
        .post('/api/user/update-fcm-token')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 123 });

      expect(response.status).toBe(400);
      expect(response.body?.message).toBe('A valid FCM token is required');
    });

    test('requires authentication', async () => {
      const response = await api.post('/api/user/update-fcm-token').send({ token: 'test-token' });

      expect(response.status).toBe(401);
      expect(response.body?.message).toBe('Authentication required');
    });

    test('handles errors when updating FCM token fails', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'update').mockRejectedValueOnce(new Error('update failed'));

      const response = await api
        .post('/api/user/update-fcm-token')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'test-token' });

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    });
  });

  describe('DELETE /api/user/fcm-token', () => {
    test('clears FCM token for authenticated user', async () => {
      const token = await createUserAndToken(api);
      // First set a token
      await api
        .post('/api/user/update-fcm-token')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'test-fcm-token-123' });

      const response = await api.delete('/api/user/fcm-token').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body?.message).toBe('Token cleared');

      const stored = await userModel.findByGoogleId(VALID_GOOGLE_PAYLOAD.sub);
      expect(stored?.fcmToken).toBeNull();
    });

    test('requires authentication', async () => {
      const response = await api.delete('/api/user/fcm-token');

      expect(response.status).toBe(401);
      expect(response.body?.message).toBe('Authentication required');
    });

    test('handles errors when clearing FCM token fails', async () => {
      const token = await createUserAndToken(api);
      jest.spyOn(userModel, 'update').mockRejectedValueOnce(new Error('clear failed'));

      const response = await api.delete('/api/user/fcm-token').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    });
  });
});

