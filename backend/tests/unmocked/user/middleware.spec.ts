import { afterEach, beforeEach, describe, expect, test, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import { createApp } from '../../../src/core/app';
import { userModel } from '../../../src/models/user/user.model';
import { createUserAndToken, VALID_GOOGLE_PAYLOAD } from '../auth/helpers';

const app = createApp();
const api = request(app);
const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;

describe('Unmocked: Auth middleware protecting /api/user', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
    jest.restoreAllMocks();
  });

  afterEach(() => {
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
    jest.restoreAllMocks();
  });

  test('Input: no Authorization header, Expected status: 401', async () => {
    // Input: request with no Authorization header.
    // Expected status: 401 with access denied message.
    const res = await api.get('/api/user/profile');

    expect(res.status).toBe(401);
    expect(res.body?.message).toBe('Authentication required');
    expect(res.body?.error).toBe('Access denied');
  });

  test('Input: invalid token string, Expected status: 401', async () => {
    // Input: header containing malformed token.
    // Expected status: 401 as JsonWebTokenError triggers invalid token response.
    const res = await api.get('/api/user/profile').set('Authorization', 'Bearer invalid');

    expect(res.status).toBe(401);
    expect(res.body?.message).toMatch(/malformed/i);
    expect(res.body?.error).toBe('Invalid token');
  });

  test('Input: valid bearer token, Expected status: 200', async () => {
    // Input: header with JWT from a signed-in user.
    // Expected status: 200 with user profile data returned.
    const token = await createUserAndToken(api);
    const res = await api.get('/api/user/profile').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.data?.user?.email).toBeDefined();
  });

  test('Input: secret missing while validating token, Expected status: 500', async () => {
    // Input: valid token but JWT_SECRET unset before middleware runs.
    // Expected status: 500 with "JWT secret is not configured".
    const token = await createUserAndToken(api);
    delete process.env.JWT_SECRET;

    const res = await api.get('/api/user/profile').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body?.message).toBe('JWT secret is not configured');
    expect(res.body?.error).toBe('Server misconfiguration');
  });

  test('Input: token expired, Expected status: 401', async () => {
    // Input: JWT issued with near-zero TTL.
    // Expected status: 401 because TokenExpiredError is caught.
    const token = await createUserAndToken(api);
    const user = await userModel.findByGoogleId(VALID_GOOGLE_PAYLOAD.sub);
    const secret = process.env.JWT_SECRET ?? '';
    const shortLived = jwt.sign({ id: user?._id }, secret, { expiresIn: '1ms' });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const res = await api.get('/api/user/profile').set('Authorization', `Bearer ${shortLived}`);

    expect(res.status).toBe(401);
    expect(res.body?.message).toBe('Please login again');
    expect(res.body?.error).toBe('Token expired');
  });

  test('Input: valid token but user deleted, Expected status: 401', async () => {
    // Input: JWT for user that no longer exists in DB.
    // Expected status: 401 with user not found message.
    const token = await createUserAndToken(api);
    const user = await userModel.findByGoogleId(VALID_GOOGLE_PAYLOAD.sub);
    if (user) {
      await userModel.delete(user._id);
    }

    const res = await api.get('/api/user/profile').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body?.message).toBe('Token is valid but user no longer exists');
    expect(res.body?.error).toBe('User not found');
  });

  test('Input: token without id claim, Expected status: 401', async () => {
    // Input: JWT payload missing the id field.
    // Expected status: 401 because resolveUserObjectId returns undefined.
    const secret = process.env.JWT_SECRET ?? '';
    const token = jwt.sign({ foo: 'bar' }, secret);

    const res = await api.get('/api/user/profile').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body?.message).toBe('Token verification failed');
    expect(res.body?.error).toBe('Invalid token');
  });

  test('Input: token with invalid id value, Expected status: 401', async () => {
    // Input: JWT contains an id that is not a valid ObjectId.
    // Expected status: 401 because resolveUserObjectId rejects the raw id.
    const secret = process.env.JWT_SECRET ?? '';
    const token = jwt.sign({ id: '123' }, secret);

    const res = await api.get('/api/user/profile').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body?.message).toBe('Token verification failed');
    expect(res.body?.error).toBe('Invalid token');
  });
});
