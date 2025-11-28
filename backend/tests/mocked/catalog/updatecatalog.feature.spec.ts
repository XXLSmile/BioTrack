// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import mongoose from 'mongoose';

import { CatalogNameConflictError } from '../../../src/models/catalog/catalog.model';
import {
  api,
  catalogModelMock,
  emitCatalogMetadataUpdated,
  mockAuthMiddleware,
  resetAllMocks,
} from './test.utils';

describe('Mocked: API: catalog update flow', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Input: catalog not found, Expected status: 404', async () => {
    // Input: catalog id not found
    // Expected status code: 404
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce(null);
    mockAuthMiddleware(userId);

    const response = await api
      .patch(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Updated' });

    expect(response.status).toBe(404);
    expect(response.body?.message).toBe('Catalog not found');
  });

  test('Input: request lacks authenticated user, Expected status: 401', async () => {
    // Input: no authenticated user
    // Expected status code: 401
    const catalogId = new mongoose.Types.ObjectId();
    mockAuthMiddleware(undefined);

    const response = await api.patch(`/api/catalogs/${catalogId}`).send({ name: 'Updated' });

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
  });

  test('Input: user is not owner, Expected status: 403', async () => {
    // Input: user is not owner
    // Expected status code: 403
    const owner = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    mockAuthMiddleware(userId);

    const response = await api
      .patch(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Updated' });

    expect(response.status).toBe(403);
    expect(response.body?.message).toBe('Only the owner can update this catalog');
  });

  test('Input: update returns null, Expected status: 404', async () => {
    // Input: update returns null
    // Expected status code: 404
    const owner = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    catalogModelMock.updateCatalog.mockResolvedValueOnce(null);
    mockAuthMiddleware(owner);

    const response = await api
      .patch(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Updated' });

    expect(response.status).toBe(404);
    expect(response.body?.message).toBe('Catalog not found');
  });

  test('Input: duplicate key error (CatalogNameConflictError), Expected status: 409', async () => {
    // Input: duplicate key error
    // Expected status code: 409
    const owner = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const duplicateError = new CatalogNameConflictError();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    catalogModelMock.updateCatalog.mockRejectedValueOnce(duplicateError);
    mockAuthMiddleware(owner);

    const response = await api
      .patch(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Updated' });

    expect(response.status).toBe(409);
    expect(response.body?.message).toBe('Catalog with the same name already exists');
  });

  test('Input: valid owner updating catalog, Expected status: 200', async () => {
    // Input: valid owner updating catalog
    // Expected status code: 200
    // Expected behavior: updates metadata and emits socket event
    const owner = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const updated = { _id: catalogId, owner, name: 'Updated' };
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    catalogModelMock.updateCatalog.mockResolvedValueOnce(updated);
    mockAuthMiddleware(owner);

    const response = await api
      .patch(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Updated' });

    expect(response.status).toBe(200);
    expect(response.body?.data?.catalog).toMatchObject({ name: 'Updated' });
    expect(emitCatalogMetadataUpdated).toHaveBeenCalledWith(updated, owner);
  });

  test('Input: unexpected error, Expected status: 500', async () => {
    // Input: unexpected error from updateCatalog
    // Expected behavior: forwards to next
    // Expected output: 500 internal server error
    const owner = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const error = new Error('fail');
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    catalogModelMock.updateCatalog.mockRejectedValueOnce(error);
    mockAuthMiddleware(owner);

    const response = await api
      .patch(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Updated' });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});

