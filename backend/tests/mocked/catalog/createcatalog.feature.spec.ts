// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import mongoose from 'mongoose';

import { CatalogNameConflictError } from '../../../src/models/catalog/catalog.model';
import {
  api,
  catalogModelMock,
  mockAuthMiddleware,
  resetAllMocks,
} from './test.utils';

describe('Mocked: API: catalog creation flow', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Input: authenticated owner with valid payload, Expected status: 201', async () => {
    // Input: owner id and payload { name, description }
    // Expected status code: 201
    // Expected behavior: delegates to catalogModel.createCatalog and returns created doc
    // Expected output: JSON payload containing catalog
    const userId = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner: userId, name: 'Birds', description: 'notes' };
    catalogModelMock.createCatalog.mockResolvedValueOnce(catalog);
    mockAuthMiddleware(userId);

    const response = await api
      .post('/api/catalogs')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Birds', description: 'notes' });

    expect(response.status).toBe(201);
    expect(response.body?.message).toBe('Catalog created successfully');
    expect(response.body?.data?.catalog).toMatchObject({
      name: 'Birds',
      description: 'notes',
    });
    expect(catalogModelMock.createCatalog).toHaveBeenCalledWith(userId, {
      name: 'Birds',
      description: 'notes',
    });
  });

  test('Input: request lacks authenticated user, Expected status: 401', async () => {
    // Input: no authenticated user
    // Expected status code: 401
    mockAuthMiddleware(undefined);

    const response = await api.post('/api/catalogs').send({ name: 'Birds' });

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
    expect(catalogModelMock.createCatalog).not.toHaveBeenCalled();
  });

  test('Input: invalid payload triggering Zod validation error, Expected status: 400', async () => {
    // Input: invalid payload (empty name)
    // Expected status code: 400
    const userId = new mongoose.Types.ObjectId();
    mockAuthMiddleware(userId);

    const response = await api
      .post('/api/catalogs')
      .set('Authorization', 'Bearer test-token')
      .send({ name: '' });

    expect(response.status).toBe(400);
    expect(response.body?.error).toBe('Validation error');
    expect(catalogModelMock.createCatalog).not.toHaveBeenCalled();
  });

  test('Input: payload that violates unique index (CatalogNameConflictError), Expected status: 409', async () => {
    // Input: payload that violates unique index
    // Expected status code: 409
    // Expected behavior: controller returns conflict response
    // Expected output: JSON message about catalog existing
    const userId = new mongoose.Types.ObjectId();
    const duplicateError = new CatalogNameConflictError();
    catalogModelMock.createCatalog.mockRejectedValueOnce(duplicateError);
    mockAuthMiddleware(userId);

    const response = await api
      .post('/api/catalogs')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Dup' });

    expect(response.status).toBe(409);
    expect(response.body?.message).toBe('Catalog with the same name already exists');
  });

  test('Input: model throws unexpected error, Expected status: 500', async () => {
    // Input: model throws unexpected error
    // Expected behavior: controller forwards to next
    // Expected output: 500 internal server error
    const userId = new mongoose.Types.ObjectId();
    const error = new Error('boom');
    catalogModelMock.createCatalog.mockRejectedValueOnce(error);
    mockAuthMiddleware(userId);

    const response = await api
      .post('/api/catalogs')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Oops' });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});

