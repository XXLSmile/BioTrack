// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import mongoose from 'mongoose';

import {
  api,
  buildCatalogEntriesResponseMock,
  catalogEntryLinkModelMock,
  catalogModelMock,
  catalogRepositoryMock,
  catalogShareModelMock,
  emitCatalogEntriesUpdated,
  mockAuthMiddleware,
  resetAllMocks,
} from './test.utils';

describe('Mocked: API: link catalog entry flow', () => {
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
      .post(`/api/catalogs/${catalogId}/entries/${entryId}`)
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

    const response = await api.post(`/api/catalogs/${catalogId}/entries/${entryId}`);

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
      .post(`/api/catalogs/${catalogId}/entries/${entryId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
    expect(response.body?.message).toBe('You do not have permission to update entries in this catalog');
  });

  test('Input: entry not found, Expected status: 404', async () => {
    // Input: entry not found
    // Expected status code: 404
    const owner = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    catalogRepositoryMock.findById.mockResolvedValueOnce(null);
    mockAuthMiddleware(owner);

    const response = await api
      .post(`/api/catalogs/${catalogId}/entries/${entryId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(404);
    expect(response.body?.message).toBe('Observation entry not found');
  });

  test('Input: entry not owned by caller, Expected status: 403', async () => {
    // Input: entry not owned by caller
    // Expected status code: 403
    // Note: Permission check happens first, so if user is not owner/editor, they get 403 before ownership check
    const owner = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    catalogShareModelMock.getUserAccess.mockResolvedValueOnce(null); // No share access
    mockAuthMiddleware(userId);

    const response = await api
      .post(`/api/catalogs/${catalogId}/entries/${entryId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
    expect(response.body?.message).toBe('You do not have permission to update entries in this catalog');
  });

  test('Input: entry not owned by caller (with edit permission), Expected status: 403', async () => {
    // Input: user has edit permission but entry belongs to different user
    // Expected status code: 403
    const owner = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    catalogShareModelMock.getUserAccess.mockResolvedValueOnce({ role: 'editor' }); // Has edit permission
    catalogRepositoryMock.findById.mockResolvedValueOnce({
      _id: entryId,
      userId: new mongoose.Types.ObjectId(), // Different user
    });
    mockAuthMiddleware(userId);

    const response = await api
      .post(`/api/catalogs/${catalogId}/entries/${entryId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(403);
    expect(response.body?.message).toBe('You can only link entries that you created');
  });

  test('Input: entry already linked, Expected status: 409', async () => {
    // Input: entry already linked
    // Expected status code: 409
    const owner = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    catalogRepositoryMock.findById.mockResolvedValueOnce({
      _id: entryId,
      userId: owner,
    });
    catalogEntryLinkModelMock.isEntryLinked.mockResolvedValueOnce(true);
    mockAuthMiddleware(owner);

    const response = await api
      .post(`/api/catalogs/${catalogId}/entries/${entryId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(409);
    expect(response.body?.message).toBe('Entry already linked to this catalog');
  });

  test('Input: valid owner linking entry, Expected status: 200', async () => {
    // Input: valid owner linking entry
    // Expected status code: 200
    // Expected behavior: links entry and emits update event
    const owner = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    const catalog = { _id: catalogId, owner };
    const entry = { _id: entryId, userId: owner };
    const entries = [{ entry: { id: 1 } }];
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogRepositoryMock.findById.mockResolvedValueOnce(entry);
    catalogEntryLinkModelMock.isEntryLinked.mockResolvedValueOnce(false);
    catalogEntryLinkModelMock.listEntriesWithDetails.mockResolvedValueOnce(entries);
    buildCatalogEntriesResponseMock.mockReturnValueOnce(entries);
    mockAuthMiddleware(owner);

    const response = await api
      .post(`/api/catalogs/${catalogId}/entries/${entryId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('Entry linked to catalog successfully');
    expect(catalogEntryLinkModelMock.linkEntry).toHaveBeenCalledWith(catalogId, entryId, owner);
    expect(emitCatalogEntriesUpdated).toHaveBeenCalledWith(catalogId, entries, owner);
  });

  test('Input: unexpected error, Expected status: 500', async () => {
    // Input: unexpected error
    // Expected behavior: forwards to next
    // Expected output: 500 internal server error
    const owner = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    const error = new Error('fail');
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner });
    catalogRepositoryMock.findById.mockRejectedValueOnce(error);
    mockAuthMiddleware(owner);

    const response = await api
      .post(`/api/catalogs/${catalogId}/entries/${entryId}`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});

