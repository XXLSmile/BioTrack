import { afterEach, beforeEach, describe, expect, test, jest } from '@jest/globals';
import request from 'supertest';

import { createApp } from '../../../src/core/app';
import { userModel } from '../../../src/models/user/user.model';
import { mockGoogleVerifyFailure, mockGoogleVerifySuccess, VALID_ID_TOKEN, VALID_GOOGLE_PAYLOAD } from './helpers';

const app = createApp();
const api = request(app);

describe('Unmocked: POST /api/auth/signin', () => {
  beforeEach(async () => {
    await userModel.deleteMany({});
    jest.restoreAllMocks();
  });

  afterEach(async () => {
    await userModel.deleteMany({});
    jest.restoreAllMocks();
  });

  test('Input: valid token, Expected status: 200 (JWT returned)', async () => {
    mockGoogleVerifySuccess();
    await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });

    const response = await api.post('/api/auth/signin').send({ idToken: VALID_ID_TOKEN });

    expect(response.status).toBe(200);
    expect(typeof response.body?.data?.token).toBe('string');
  });

  test('Input: missing token, Expected status: 400', async () => {
    const response = await api.post('/api/auth/signin').send({});
    expect(response.status).toBe(400);
    expect(response.body?.message).toBe('Google token is required');
  });

  test('Input: invalid token, Expected status: 401', async () => {
    const spy = mockGoogleVerifyFailure();
    const response = await api.post('/api/auth/signin').send({ idToken: 'bad' });
    expect(response.status).toBe(401);
    expect(spy).toHaveBeenCalled();
  });

  test('Input: valid token for nonexistent user, Expected status: 404', async () => {
    const verify = mockGoogleVerifySuccess();
    await userModel.deleteMany({});

    const response = await api.post('/api/auth/signin').send({ idToken: VALID_ID_TOKEN });

    expect(response.status).toBe(404);
    expect(response.body?.message).toMatch(/User not found/);
    expect(verify).toHaveBeenCalled();
  });
});
