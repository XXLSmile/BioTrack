// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import mongoose from 'mongoose';

import {
  api,
  buildCatalogEntriesResponseMock,
  catalogEntryLinkModelMock,
  catalogModelMock,
  catalogShareModelMock,
  emitCatalogEntriesUpdated,
  mockAuthMiddleware,
  resetAllMocks,
} from './test.utils';

describe('Mocked: API: unlink catalog entry flow', () => {
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
    const entryId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce(null);
    mockAuthMiddleware(userId);

    const response = await api
      .delete(`/api/catalogs/${catalogId}/entries/${entryId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(404);
    expect(response.body?.message).toBe('Catalog not found');
  });

  test('Input: request lacks authenticated user, Expected status: 401', async () => {
    // Input: no authenticated user
    // Expected status code: 401
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    mockAuthMiddleware(undefined);

    const response = await api.delete(`/api/catalogs/${catalogId}/entries/${entryId}`);

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
    expect(catalogModelMock.findById).not.toHaveBeenCalled();
  });

  test('Input: user with viewer role, Expected status: 403', async () => {
    // Input: user with viewer role
    // Expected status code: 403
    const owner = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    catalogShareModelMock.getUserAccess.mockResolvedValueOnce({ role: 'viewer' });
    mockAuthMiddleware(userId);

    const response = await api
      .delete(`/api/catalogs/${catalogId}/entries/${entryId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
    expect(response.body?.message).toBe('You do not have permission to remove entries from this catalog');
    expect(catalogEntryLinkModelMock.unlinkEntry).not.toHaveBeenCalled();
  });

  test('Input: valid owner removing entry, Expected status: 200', async () => {
    // Input: valid owner removing entry
    // Expected status code: 200
    // Expected behavior: unlinks entry, rebuilds entries, emits update
    const owner = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    const catalog = { _id: catalogId, owner };
    const entries = [{ entry: { id: 1 } }];
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogEntryLinkModelMock.listEntriesWithDetails.mockResolvedValueOnce(entries);
    buildCatalogEntriesResponseMock.mockReturnValueOnce(entries);
    mockAuthMiddleware(owner);

    const response = await api
      .delete(`/api/catalogs/${catalogId}/entries/${entryId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('Entry unlinked from catalog successfully');
    expect(catalogEntryLinkModelMock.unlinkEntry).toHaveBeenCalled();
    expect(emitCatalogEntriesUpdated).toHaveBeenCalledWith(catalogId, entries, owner);
  });

  test('Input: unexpected error, Expected status: 500', async () => {
    // Input: unlink operation throws
    // Expected behavior: forwards to next
    // Expected output: 500 internal server error
    const owner = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    const error = new Error('unlink fail');
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    catalogEntryLinkModelMock.unlinkEntry.mockRejectedValueOnce(error);
    mockAuthMiddleware(owner);

    const response = await api
      .delete(`/api/catalogs/${catalogId}/entries/${entryId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});

