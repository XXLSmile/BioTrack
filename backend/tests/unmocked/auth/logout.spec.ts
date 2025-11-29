import { afterEach, describe, expect, test, jest } from '@jest/globals';
import request from 'supertest';

import { createApp } from '../../../src/core/app';
import { mockGoogleVerifySuccess, VALID_ID_TOKEN } from './helpers';

const app = createApp();
const api = request(app);

// Interface POST /api/auth/logout
// Input: optional bearer token
// Expected status code: 200 for success, 500 when authService throws
// Expected behavior: clears session details or gracefully handles logout errors
// Expected output: success confirmation or internal error message
describe('Unmocked: POST /api/auth/logout', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Input: no token, Expected status: 200', async () => {
    const response = await api.post('/api/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('User logged out successfully');
  });

  test('Input: valid bearer token, Expected status: 200', async () => {
    mockGoogleVerifySuccess();
    await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });
    const signin = await api.post('/api/auth/signin').send({ idToken: VALID_ID_TOKEN });
    const token = signin.body?.data?.token;

    const response = await api.post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('User logged out successfully');
  });

  test('Input: authService throws error during logout, Expected status: 500', async () => {
    // Input: authService.logout throws an error
    // Expected status: 500
    const authServiceModule = require('../../../src/services/auth.service');
    const originalLogout = authServiceModule.authService.logout;
    jest.spyOn(authServiceModule.authService, 'logout').mockRejectedValueOnce(new Error('logout failed'));

    const response = await api.post('/api/auth/logout');

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
    
    authServiceModule.authService.logout = originalLogout;
  });
});
