import { afterEach, describe, expect, test, jest } from '@jest/globals';
import request from 'supertest';

import { createApp } from '../../../src/core/app';
import { userModel } from '../../../src/models/user/user.model';
import { mockGoogleVerifySuccess, VALID_ID_TOKEN } from '../../unmock/auth/helpers';

const app = createApp();
const api = request(app);

describe('Mocked: POST /api/auth/signin', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Input: DB lookup throws, Expected status: 500', async () => {
    // Input: Google verifies, but userModel.findByGoogleId throws before generating a JWT.
    // Expected status: 500 from the global error handler.
    mockGoogleVerifySuccess();
    jest.spyOn(userModel, 'findByGoogleId').mockRejectedValue(new Error('Failed to find user'));

    const response = await api.post('/api/auth/signin').send({ idToken: VALID_ID_TOKEN });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});
