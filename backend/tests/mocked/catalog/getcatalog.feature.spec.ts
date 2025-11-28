// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import mongoose from 'mongoose';

import {
  api,
  buildCatalogEntriesResponseMock,
  catalogEntryLinkModelMock,
  catalogModelMock,
  catalogShareModelMock,
  mockAuthMiddleware,
  resetAllMocks,
} from './test.utils';

describe('Mocked: API: get catalog by id flow', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Input: catalog id not found, Expected status: 404', async () => {
    // Input: catalog id not found
    // Expected status code: 404
    // Expected behavior: returns not found message
    // Expected output: JSON { message: 'Catalog not found' }
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce(null);
    mockAuthMiddleware(userId);

    const response = await api
      .get(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(404);
    expect(response.body?.message).toBe('Catalog not found');
  });

  test('Input: request lacks authenticated user, Expected status: 401', async () => {
    // Input: no authenticated user
    // Expected status code: 401
    const catalogId = new mongoose.Types.ObjectId();
    mockAuthMiddleware(undefined);

    const response = await api.get(`/api/catalogs/${catalogId}`);

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
  });

  test('Input: user without ownership or share access, Expected status: 403', async () => {
    // Input: user without ownership or share access
    // Expected status code: 403
    // Expected behavior: denies access when catalogShareModel returns null
    // Expected output: JSON access denied message
    const owner = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({
      _id: catalogId,
      owner,
    });
    catalogShareModelMock.getUserAccess.mockResolvedValueOnce(null);
    mockAuthMiddleware(userId);

    const response = await api
      .get(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
    expect(response.body?.message).toBe('You do not have access to this catalog');
  });

  test('Input: share record without role property, Expected status: 200 with empty entries', async () => {
    // Input: share record without role property
    // Expected status code: 200
    // Expected behavior: skip entries when share has no role value
    // Expected output: entries array empty
    const owner = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const catalog = { _id: catalogId, owner };
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogShareModelMock.getUserAccess.mockResolvedValueOnce({ role: undefined });
    buildCatalogEntriesResponseMock.mockReturnValueOnce([]);
    mockAuthMiddleware(userId);

    const response = await api
      .get(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.data?.entries).toEqual([]);
  });

  test('Input: valid owner, Expected status: 200 with entries', async () => {
    // Input: valid owner
    // Expected status code: 200
    // Expected behavior: returns catalog with entries
    // Expected output: JSON payload with catalog and entries
    const owner = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const catalog = { _id: catalogId, owner, name: 'Birds' };
    const entries = [{ entry: { id: 1 } }];
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogEntryLinkModelMock.listEntriesWithDetails.mockResolvedValueOnce(entries);
    buildCatalogEntriesResponseMock.mockReturnValueOnce(entries);
    mockAuthMiddleware(owner);

    const response = await api
      .get(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.data?.catalog).toMatchObject({ name: 'Birds' });
    expect(response.body?.data?.entries).toEqual(entries);
  });

  test('Input: allowed access for accepted editor share, Expected status: 200', async () => {
    // Input: user with editor share access
    // Expected status code: 200
    // Expected behavior: returns catalog with entries
    const owner = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const catalog = { _id: catalogId, owner };
    const entries = [{ entry: { id: 1 } }];
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogShareModelMock.getUserAccess.mockResolvedValueOnce({ role: 'editor', status: 'accepted' });
    catalogEntryLinkModelMock.listEntriesWithDetails.mockResolvedValueOnce(entries);
    buildCatalogEntriesResponseMock.mockReturnValueOnce(entries);
    mockAuthMiddleware(userId);

    const response = await api
      .get(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.data?.entries).toEqual(entries);
  });

  test('Input: unexpected error, Expected status: 500', async () => {
    // Input: unexpected error
    // Expected behavior: forwards to next
    // Expected output: 500 internal server error
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const error = new Error('unexpected');
    catalogModelMock.findById.mockRejectedValueOnce(error);
    mockAuthMiddleware(userId);

    const response = await api
      .get(`/api/catalogs/${catalogId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});

