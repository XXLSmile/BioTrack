// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import mongoose from 'mongoose';

import {
  api,
  catalogModelMock,
  mockAuthMiddleware,
  resetAllMocks,
} from './test.utils';

describe('Mocked: API: catalog listing flow', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Input: authenticated user, Expected status: 200', async () => {
    // Input: authenticated user
    // Expected status code: 200
    // Expected behavior: returns catalogs associated with owner
    // Expected output: JSON payload with catalogs array
    const userId = new mongoose.Types.ObjectId();
    const catalogs = [{ _id: new mongoose.Types.ObjectId(), name: 'Birds', owner: userId }];
    catalogModelMock.listCatalogs.mockResolvedValueOnce(catalogs);
    mockAuthMiddleware(userId);

    const response = await api.get('/api/catalogs').set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('Catalogs fetched successfully');
    expect(Array.isArray(response.body?.data?.catalogs)).toBe(true);
    expect(response.body?.data?.catalogs.length).toBe(catalogs.length);
    expect(catalogModelMock.listCatalogs).toHaveBeenCalledWith(userId);
  });

  test('Input: request lacks authenticated user, Expected status: 401', async () => {
    // Input: no authenticated user
    // Expected status code: 401
    mockAuthMiddleware(undefined);

    const response = await api.get('/api/catalogs');

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
    expect(catalogModelMock.listCatalogs).not.toHaveBeenCalled();
  });

  test('Input: model throws, Expected status: 500', async () => {
    // Input: model throws
    // Expected behavior: controller logs and forwards error
    // Expected output: 500 internal server error
    const userId = new mongoose.Types.ObjectId();
    const error = new Error('db down');
    catalogModelMock.listCatalogs.mockRejectedValueOnce(error);
    mockAuthMiddleware(userId);

    const response = await api.get('/api/catalogs').set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});

