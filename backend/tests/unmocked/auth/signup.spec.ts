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

describe('Unmocked: POST /api/auth/signup', () => {
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

  test('Input: valid token, Expected status: 201 then 409 on repeat', async () => {
    // Input: fresh Google idToken that corresponds to no existing user.
    // Expected status: 201 with user data, 409 on reconnect to guard against duplicates.
    // Expected behavior: userModel persists the user once.
    const spy = mockGoogleVerifySuccess();
    const response = await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });

    expect(response.status).toBe(201);
    expect(response.body?.message).toBe('User signed up successfully');
    expect(typeof response.body?.data?.token).toBe('string');

    const created = await userModel.findByGoogleId(VALID_GOOGLE_PAYLOAD.sub);
    expect(created?.email).toBe(VALID_GOOGLE_PAYLOAD.email);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        idToken: VALID_ID_TOKEN,
      })
    );

    const conflict = await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });
    expect(conflict.status).toBe(409);
    expect(conflict.body?.message).toBe('User already exists, please sign in instead.');
  });

  test('Input: missing token, Expected status: 400 validation error', async () => {
    // Input: no idToken provided so validation middleware should reject.
    // Expected status: 400 with validation details referencing idToken.
    const response = await api.post('/api/auth/signup').send({});

    expect(response.status).toBe(400);
    expect(response.body?.error).toBe('Validation error');
    expect(response.body?.message).toBe('Invalid input data');
    expect(response.body?.details?.[0]?.field).toBe('idToken');
  });

  test('Input: empty string token, Expected status: 400', async () => {
    // Input: idToken is empty string (bypasses validation middleware but caught by controller)
    // Expected status: 400
    const response = await api.post('/api/auth/signup').send({ idToken: '' });

    expect(response.status).toBe(400);
    expect(response.body?.message).toBe('Google token is required');
  });

  test('Input: invalid Google token, Expected status: 401', async () => {
    // Input: Google OAuth rejects the provided token.
    // Expected status: 401 with Invalid Google token response.
    const spy = mockGoogleVerifyFailure();
    const response = await api.post('/api/auth/signup').send({ idToken: 'bad' });

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Invalid Google token');
    expect(spy).toHaveBeenCalled();
  });

  test('Input: Google payload missing email, Expected status: 401', async () => {
    // Input: OAuth ticket lacks the email field.
    // Expected status: 401 because authService refuses incomplete profiles.
    mockGoogleVerifyWithPayload({
      ...VALID_GOOGLE_PAYLOAD,
      email: undefined,
    });

    const response = await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Invalid Google token');
    expect(response.body?.data).toBeUndefined();
  });

  test('Input: Google payload missing entirely, Expected status: 401', async () => {
    mockGoogleVerifyWithPayload(null);

    const response = await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Invalid Google token');
    expect(response.body?.data).toBeUndefined();
  });

  test('Input: JWT secret missing, Expected status: 500', async () => {
    // Input: valid payload but JWT_SECRET is unset before token generation.
    // Expected status: 500 from the global error handler.
    mockGoogleVerifySuccess();
    delete process.env.JWT_SECRET;

    const response = await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});
