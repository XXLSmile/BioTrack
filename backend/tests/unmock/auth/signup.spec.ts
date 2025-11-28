import { afterEach, beforeEach, describe, expect, test, jest } from '@jest/globals';
import request from 'supertest';

import { createApp } from '../../../src/core/app';
import { userModel } from '../../../src/models/user/user.model';
import { mockGoogleVerifyFailure, mockGoogleVerifySuccess, VALID_ID_TOKEN, VALID_GOOGLE_PAYLOAD } from './helpers';

const app = createApp();
const api = request(app);

describe('Unmocked: POST /api/auth/signup', () => {
  beforeEach(async () => {
    await userModel.deleteMany({});
    jest.restoreAllMocks();
  });

  afterEach(async () => {
    await userModel.deleteMany({});
    jest.restoreAllMocks();
  });

  test('Input: valid token, Expected status code: 201 then 409', async () => {
    const spy = mockGoogleVerifySuccess();
    const response = await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });

    expect(response.status).toBe(201);
    expect(response.body?.message).toBe('User signed up successfully');
    const created = await userModel.findByGoogleId(VALID_GOOGLE_PAYLOAD.sub);
    expect(created?.email).toBe(VALID_GOOGLE_PAYLOAD.email);
    expect(spy).toHaveBeenCalledWith(VALID_ID_TOKEN);

    const conflict = await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });
    expect(conflict.status).toBe(409);
  });

  test('Input: missing token, Expected status code: 400', async () => {
    const response = await api.post('/api/auth/signup').send({});
    expect(response.status).toBe(400);
    expect(response.body?.message).toBe('Google token is required');
  });

  test('Input: invalid token, Expected status code: 401', async () => {
    const spy = mockGoogleVerifyFailure();
    const response = await api.post('/api/auth/signup').send({ idToken: 'bad' });
    expect(response.status).toBe(401);
    expect(spy).toHaveBeenCalled();
  });
});
