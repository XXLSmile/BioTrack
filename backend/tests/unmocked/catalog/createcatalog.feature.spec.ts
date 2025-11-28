import { afterEach, beforeEach, describe, expect, test, jest } from '@jest/globals';
import { api, createCatalogRequest, dropTestDb } from './test.utils';
import { createUserAndToken, createUserAndTokenWithPayload } from '../auth/helpers';
import { userModel } from '../../../src/models/user/user.model';

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
    const response = await createCatalogRequest(null as any, { name: 'Test' });
    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Authentication required');
  });

  test('handles duplicate catalog name with CatalogNameConflictError', async () => {
    const token = await createUserAndToken(api);
    await createCatalogRequest(token, { name: 'Birds' });

    // Mock to throw CatalogNameConflictError
    const catalogModel = require('../../../src/models/catalog/catalog.model');
    const originalCreate = catalogModel.catalogModel.createCatalog;
    const { CatalogNameConflictError } = require('../../../src/types/catalog.types');
    jest.spyOn(catalogModel.catalogModel, 'createCatalog').mockRejectedValueOnce(
      new CatalogNameConflictError('Duplicate name')
    );

    const response = await createCatalogRequest(token, { name: 'Birds' });
    expect(response.status).toBe(409);
    expect(response.body?.message).toBe('Catalog with the same name already exists');

    catalogModel.catalogModel.createCatalog = originalCreate;
  });

  test('handles duplicate catalog name with MongoDB error code 11000', async () => {
    const token = await createUserAndToken(api);
    
    // Mock to throw MongoDB duplicate key error
    const catalogModel = require('../../../src/models/catalog/catalog.model');
    const originalCreate = catalogModel.catalogModel.createCatalog;
    const duplicateError = new Error('Duplicate key');
    (duplicateError as any).code = 11000;
    jest.spyOn(catalogModel.catalogModel, 'createCatalog').mockRejectedValueOnce(duplicateError);

    const response = await createCatalogRequest(token, { name: 'Birds' });
    expect(response.status).toBe(409);
    expect(response.body?.message).toBe('Catalog with the same name already exists');

    catalogModel.catalogModel.createCatalog = originalCreate;
  });

  test('handles Zod validation errors', async () => {
    const token = await createUserAndToken(api);
    
    // Mock Zod to throw validation error
    const zod = require('zod');
    const originalParse = zod.z.object;
    jest.spyOn(zod, 'z').mockImplementationOnce(() => ({
      object: () => ({
        parse: () => {
          const error = new Error('Validation error');
          (error as any).issues = [{ path: ['name'], message: 'Invalid' }];
          throw error;
        },
      }),
    }));

    const response = await createCatalogRequest(token, { name: 'Test' });
    expect(response.status).toBe(400);
    expect(response.body?.message).toBe('Invalid catalog data');
  });

  test('handles mongoose ValidationError', async () => {
    const token = await createUserAndToken(api);
    
    // Mock mongoose ValidationError
    const mongoose = require('mongoose');
    const catalogModel = require('../../../src/models/catalog/catalog.model');
    const originalCreate = catalogModel.catalogModel.createCatalog;
    const validationError = new mongoose.Error.ValidationError();
    jest.spyOn(catalogModel.catalogModel, 'createCatalog').mockRejectedValueOnce(validationError);

    const response = await createCatalogRequest(token, { name: 'Test' });
    expect(response.status).toBe(400);
    expect(response.body?.message).toBe('Invalid catalog data');

    catalogModel.catalogModel.createCatalog = originalCreate;
  });
});
