// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import mongoose from 'mongoose';

import {
  api,
  catalogModelMock,
  emitCatalogDeleted,
  mockAuthMiddleware,
  resetAllMocks,
} from './test.utils';

describe('Mocked: API: catalog deletion flow', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Input: catalog missing, Expected status: 404', async () => {
    // Input: catalog id not found
    // Expected status code: 404
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce(null);
    mockAuthMiddleware(userId);

    const response = await api
      .delete(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(404);
    expect(response.body?.message).toBe('Catalog not found');
  });

  test('Input: request lacks authenticated user, Expected status: 401', async () => {
    // Input: no authenticated user
    // Expected status code: 401
    const catalogId = new mongoose.Types.ObjectId();
    mockAuthMiddleware(undefined);

    const response = await api.delete(`/api/catalogs/${catalogId}`);

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
      .delete(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
    expect(response.body?.message).toBe('Only the owner can delete this catalog');
  });

  test('Input: delete operation affects no documents, Expected status: 404', async () => {
    // Input: delete operation affects no documents
    // Expected status code: 404
    const owner = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    catalogModelMock.deleteCatalog.mockResolvedValueOnce(false);
    mockAuthMiddleware(owner);

    const response = await api
      .delete(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(404);
    expect(response.body?.message).toBe('Catalog not found');
  });

  test('Input: valid owner deleting catalog, Expected status: 200', async () => {
    // Input: valid owner deleting catalog
    // Expected status code: 200
    // Expected behavior: deletes record and emits socket event
    const owner = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    catalogModelMock.deleteCatalog.mockResolvedValueOnce(true);
    mockAuthMiddleware(owner);

    const response = await api
      .delete(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('Catalog deleted successfully');
    expect(emitCatalogDeleted).toHaveBeenCalledWith(catalogId.toString(), owner);
  });

  test('Input: unexpected error, Expected status: 500', async () => {
    // Input: unexpected error
    // Expected behavior: forwards to next
    // Expected output: 500 internal server error
    const owner = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const error = new Error('fail');
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    catalogModelMock.deleteCatalog.mockRejectedValueOnce(error);
    mockAuthMiddleware(owner);

    const response = await api
      .delete(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});

