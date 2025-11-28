import { afterEach, describe, expect, test, jest } from '@jest/globals';
import request from 'supertest';

import { createApp } from '../../../src/core/app';
import { userModel } from '../../../src/models/user/user.model';
import { mockGoogleVerifySuccess, VALID_ID_TOKEN } from '../../unmock/auth/helpers';

const app = createApp();
const api = request(app);

describe('Mocked: POST /api/auth/signup', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Input: DB create fails with "Failed to process user", Expected status: 500', async () => {
    // Input: Google verifies successfully, but userModel.create rejects with a custom error.
    // Expected status: 500 with controller-level message about processing failure.
    mockGoogleVerifySuccess();
    jest.spyOn(userModel, 'findByGoogleId').mockResolvedValue(null);
    jest.spyOn(userModel, 'create').mockRejectedValue(new Error('Failed to process user'));

    const response = await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Failed to process user information');
  });

  test('Input: DB lookup throws, Expected status: 500', async () => {
    // Input: findByGoogleId throws before creation.
    // Expected status: 500 with generic internal server error message.
    mockGoogleVerifySuccess();
    jest.spyOn(userModel, 'findByGoogleId').mockRejectedValue(new Error('Failed to find user'));

    const response = await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});
