import { afterEach, beforeEach, describe, expect, test, jest } from '@jest/globals';
import request from 'supertest';

import { createApp } from '../../../src/core/app';
import { userModel } from '../../../src/models/user/user.model';
import {
  mockGoogleVerifyFailure,
  mockGoogleVerifySuccess,
  mockGoogleVerifyWithPayload,
  VALID_GOOGLE_PAYLOAD,
  VALID_ID_TOKEN,
} from './helpers';

const app = createApp();
const api = request(app);
const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;

describe('Unmocked: POST /api/auth/signin', () => {
  beforeEach(async () => {
    await userModel.deleteAllUsers();
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
    jest.restoreAllMocks();
  });

  afterEach(async () => {
    await userModel.deleteAllUsers();
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
    jest.restoreAllMocks();
  });

  test('Input: valid token with existing user, Expected status: 200 with JWT', async () => {
    // Input: payload for an already registered user.
    // Expected status: 200 with token string returned.
    mockGoogleVerifySuccess();
    await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });

    const response = await api.post('/api/auth/signin').send({ idToken: VALID_ID_TOKEN });

    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('User signed in successfully');
    expect(typeof response.body?.data?.token).toBe('string');
    expect(response.body?.data?.user?.googleId).toBe(VALID_GOOGLE_PAYLOAD.sub);
  });

  test('Input: missing token, Expected status: 400 validation error', async () => {
    // Input: empty payload rejected by validation middleware.
    // Expected status: 400 with validation details about idToken.
    const response = await api.post('/api/auth/signin').send({});

    expect(response.status).toBe(400);
    expect(response.body?.error).toBe('Validation error');
    expect(response.body?.details?.[0]?.field).toBe('idToken');
  });

  test('Input: invalid Google token, Expected status: 401', async () => {
    // Input: idToken leads to Google verification rejection.
    // Expected status: 401 with Invalid Google token response.
    const spy = mockGoogleVerifyFailure();
    const response = await api.post('/api/auth/signin').send({ idToken: 'bad' });

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Invalid Google token');
    expect(spy).toHaveBeenCalled();
  });

  test('Input: token for nonexistent user, Expected status: 404', async () => {
    // Input: Google payload is valid but user has not signed up.
    // Expected status: 404 with guidance to sign-up.
    const verify = mockGoogleVerifySuccess();

    const response = await api.post('/api/auth/signin').send({ idToken: VALID_ID_TOKEN });

    expect(response.status).toBe(404);
    expect(response.body?.message).toBe('User not found, please sign up first.');
    expect(verify).toHaveBeenCalled();
  });

  test('Input: Google payload missing name, Expected status: 401', async () => {
    // Input: Google payload lacking the name field.
    // Expected status: 401 because authService rejects incomplete user info.
    mockGoogleVerifyWithPayload({
      ...VALID_GOOGLE_PAYLOAD,
      name: undefined,
    });

    const response = await api.post('/api/auth/signin').send({ idToken: VALID_ID_TOKEN });

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Invalid Google token');
  });

  test('Input: JWT secret missing, Expected status: 500', async () => {
    // Input: valid user but JWT generation fails due to missing secret.
    // Expected status: 500 as the error propagates to the global handler.
    mockGoogleVerifySuccess();
    await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });
    delete process.env.JWT_SECRET;

    const response = await api.post('/api/auth/signin').send({ idToken: VALID_ID_TOKEN });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});
