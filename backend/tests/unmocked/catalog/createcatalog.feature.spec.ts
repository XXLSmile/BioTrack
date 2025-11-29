import { afterEach, beforeEach, describe, expect, test, jest } from '@jest/globals';
import { api, createCatalogRequest, dropTestDb } from './test.utils';
import { createUserAndToken, createUserAndTokenWithPayload } from '../auth/helpers';
import { userModel } from '../../../src/models/user/user.model';

// Interface POST /api/catalogs and GET /api/catalogs
// Input: authenticated user with catalog name/description, optional listing requests without auth
// Expected status code: 201 for successful creation, 200 for listing, 400/401/409 for validation/auth/duplicate issues, 500 for internal errors
// Expected behavior: persists new catalog for owner, listing respects auth, rejects invalid payloads and duplicates, surfaces controller/model failures
// Expected output: created catalog payload and list of catalogs or detailed error message
describe('API: catalog creation flow', () => {
  beforeEach(async () => {
    await dropTestDb();
  });

  afterEach(async () => {
    await dropTestDb();
    jest.restoreAllMocks();
  });

  test('creates a catalog for an authenticated owner', async () => {
    const token = await createUserAndToken(api);

    const response = await createCatalogRequest(token, { name: 'Birds', description: 'Feathered friends' });

    expect(response.status).toBe(201);
    expect(response.body?.data?.catalog?.name).toBe('Birds');
  });

  test('rejects invalid payloads', async () => {
    const token = await createUserAndToken(api);

    const response = await createCatalogRequest(token, { name: '' });

    expect(response.status).toBe(400);
    expect(response.body?.error).toBe('Validation error');
  });

  test('rejects duplicate catalog names for the same owner', async () => {
    const token = await createUserAndToken(api);
    await createCatalogRequest(token, { name: 'Birds' });

    const duplicate = await createCatalogRequest(token, { name: 'Birds' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body?.message).toBe('Catalog with the same name already exists');
  });

  test('lists catalogs for the authenticated user', async () => {
    const token = await createUserAndToken(api);
    await createCatalogRequest(token, { name: 'Bird Watching' });

    const listRes = await api.get('/api/catalogs').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body?.data?.catalogs)).toBe(true);
  });

  test('requires authentication to list catalogs', async () => {
    const response = await api.get('/api/catalogs');
    expect(response.status).toBe(401);
  });

  test('requires authentication to create catalog', async () => {
    const response = await api.post('/api/catalogs').send({ name: 'Test' });
    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
  });

  test('handles duplicate catalog name with CatalogNameConflictError', async () => {
    const token = await createUserAndToken(api);
    await createCatalogRequest(token, { name: 'Birds' });

    // Mock to throw CatalogNameConflictError
    const catalogModelModule = require('../../../src/models/catalog/catalog.model');
    const { CatalogNameConflictError } = catalogModelModule;
    const originalCreate = catalogModelModule.catalogModel.createCatalog;
    jest.spyOn(catalogModelModule.catalogModel, 'createCatalog').mockRejectedValueOnce(
      new CatalogNameConflictError('Duplicate name')
    );

    const response = await createCatalogRequest(token, { name: 'Birds' });
    expect(response.status).toBe(409);
    expect(response.body?.message).toBe('Catalog with the same name already exists');

    catalogModelModule.catalogModel.createCatalog = originalCreate;
  });

  test('handles Zod validation errors from controller (bubbled to global error handler)', async () => {
    const token = await createUserAndToken(api);
    
    // Mock the controller's createCatalogSchema.parse call to throw validation error
    // This tests the error handling path in the controller (lines 69-73)
    const catalogTypes = require('../../../src/types/catalog.types');
    const mockParse = jest.fn(() => {
      const error = new Error('Validation error');
      (error as any).name = 'ZodError';
      (error as any).issues = [{ path: ['name'], message: 'Invalid' }];
      throw error;
    });

    // Spy on the schema's parse method so the controller sees a Zod-style validation error.
    jest.spyOn(catalogTypes.createCatalogSchema, 'parse').mockImplementationOnce(mockParse);

    const response = await createCatalogRequest(token, { name: 'Test' });
    // Route-level validation middleware currently bubbles these errors to the global error handler,
    // which returns a generic 500 response.
    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Validation processing failed');

    jest.restoreAllMocks();
  });

  test('handles mongoose ValidationError (bubbled to global error handler)', async () => {
    const token = await createUserAndToken(api);
    
    // Mock mongoose ValidationError
    const mongoose = require('mongoose');
    const catalogModel = require('../../../src/models/catalog/catalog.model');
    const originalCreate = catalogModel.catalogModel.createCatalog;
    const validationError = new mongoose.Error.ValidationError();
    jest.spyOn(catalogModel.catalogModel, 'createCatalog').mockRejectedValueOnce(validationError);

    const response = await createCatalogRequest(token, { name: 'Test' });
    // Mongoose ValidationError is now handled by the global error handler, which returns 500
    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');

    catalogModel.catalogModel.createCatalog = originalCreate;
  });
});
