import { afterEach, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../../../src/core/app';
import { catalogModel } from '../../../src/models/catalog/catalog.model';
import { catalogRepository } from '../../../src/models/recognition/catalog.model';
import { createUserAndToken } from '../../unmocked/auth/helpers';

const app = createApp();
const api = request(app);

describe('Mocked: CatalogController error paths', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('createCatalog propagates unexpected errors to global handler', async () => {
    const token = await createUserAndToken(api);

    jest
      .spyOn(catalogModel, 'createCatalog')
      .mockRejectedValueOnce(new Error('db error'));

    const response = await api
      .post('/api/catalogs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Birds', description: 'Feathered friends' });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });

  test('createCatalog maps CatalogNameConflictError to 409', async () => {
    const token = await createUserAndToken(api);

    const { CatalogNameConflictError } = require('../../../src/models/catalog/catalog.model');
    jest
      .spyOn(catalogModel, 'createCatalog')
      .mockRejectedValueOnce(new CatalogNameConflictError('Duplicate name'));

    const response = await api
      .post('/api/catalogs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Birds' });

    expect(response.status).toBe(409);
    expect(response.body?.message).toBe('Catalog with the same name already exists');
  });

  test('createCatalog maps Mongo duplicate key (11000) to 409', async () => {
    const token = await createUserAndToken(api);

    const duplicateError: any = new Error('Duplicate key');
    duplicateError.code = 11000;

    jest
      .spyOn(catalogModel, 'createCatalog')
      .mockRejectedValueOnce(duplicateError);

    const response = await api
      .post('/api/catalogs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Birds' });

    expect(response.status).toBe(409);
    expect(response.body?.message).toBe('Catalog with the same name already exists');
  });

  test('listCatalogs propagates unexpected errors to global handler', async () => {
    const token = await createUserAndToken(api);

    jest
      .spyOn(catalogModel, 'listCatalogs')
      .mockRejectedValueOnce(new Error('db error'));

    const response = await api
      .get('/api/catalogs')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });

  test('getCatalogById propagates unexpected errors to global handler', async () => {
    const token = await createUserAndToken(api);
    const catalogId = new mongoose.Types.ObjectId().toString();

    jest
      .spyOn(catalogModel, 'findById')
      .mockRejectedValueOnce(new Error('db error'));

    const response = await api
      .get(`/api/catalogs/${catalogId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });

  test('updateCatalog propagates unexpected errors to global handler', async () => {
    const token = await createUserAndToken(api);
    const catalogId = new mongoose.Types.ObjectId().toString();

    jest
      .spyOn(catalogModel, 'findById')
      .mockRejectedValueOnce(new Error('db error'));

    const response = await api
      .patch(`/api/catalogs/${catalogId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated name' });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });

  test('deleteCatalog propagates unexpected errors to global handler', async () => {
    const token = await createUserAndToken(api);
    const catalogId = new mongoose.Types.ObjectId().toString();

    jest
      .spyOn(catalogModel, 'findById')
      .mockRejectedValueOnce(new Error('db error'));

    const response = await api
      .delete(`/api/catalogs/${catalogId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });

  test('linkCatalogEntry propagates unexpected errors to global handler', async () => {
    const token = await createUserAndToken(api);
    const catalogId = new mongoose.Types.ObjectId().toString();
    const entryId = new mongoose.Types.ObjectId().toString();

    jest
      .spyOn(catalogModel, 'findById')
      .mockRejectedValueOnce(new Error('db error'));

    const response = await api
      .post(`/api/catalogs/${catalogId}/entries/${entryId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });

  test('unlinkCatalogEntry propagates unexpected errors to global handler', async () => {
    const token = await createUserAndToken(api);
    const catalogId = new mongoose.Types.ObjectId().toString();
    const entryId = new mongoose.Types.ObjectId().toString();

    jest
      .spyOn(catalogModel, 'findById')
      .mockRejectedValueOnce(new Error('db error'));

    const response = await api
      .delete(`/api/catalogs/${catalogId}/entries/${entryId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });

  test('getUserCatalog (recognition catalog) propagates unexpected errors to global handler', async () => {
    const token = await createUserAndToken(api);

    jest
      .spyOn(catalogRepository, 'findByUserId')
      .mockRejectedValueOnce(new Error('db error'));

    const response = await api
      .get('/api/recognition/catalog')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});


