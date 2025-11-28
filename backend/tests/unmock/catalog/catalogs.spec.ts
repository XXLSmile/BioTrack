import { describe, expect, test, jest } from '@jest/globals';
import request from 'supertest';

import { createApp } from '../../../src/core/app';
import { catalogModel } from '../../../src/models/catalog/catalog.model';
import {
  mockGoogleVerifySuccess,
  VALID_GOOGLE_PAYLOAD,
  VALID_ID_TOKEN,
} from '../auth/helpers';

const app = createApp();
const api = request(app);

const obtainToken = async () => {
  mockGoogleVerifySuccess();
  await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });
  const signin = await api.post('/api/auth/signin').send({ idToken: VALID_ID_TOKEN });
  return signin.body?.data?.token;
};

describe('Unmocked: Catalog APIs', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Input: create catalog payload, Expected status 201', async () => {
    const token = await obtainToken();
    const res = await api
      .post('/api/catalogs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Birds', description: 'Cool birds' });

    expect(res.status).toBe(201);
    expect(res.body?.data?.catalog?.name).toBe('Birds');

    const dbCatalog = await catalogModel.findById(res.body.data.catalog._id);
    expect(dbCatalog?.description).toBe('Cool birds');
  });

  test('Input: list catalogs after creating one, Expected status 200', async () => {
    const token = await obtainToken();
    await api
      .post('/api/catalogs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Birds' });

    const listRes = await api.get('/api/catalogs').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body?.data?.catalogs)).toBe(true);
    expect(listRes.body.data.catalogs[0]?.name).toBe('Birds');
  });

  test('Input: update catalog name, Expected status 200', async () => {
    const token = await obtainToken();
    const created = await api
      .post('/api/catalogs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Birds', description: 'desc' });

    const catalogId = created.body?.data?.catalog?._id;
    const update = await api
      .patch(`/api/catalogs/${catalogId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Rare Birds' });

    expect(update.status).toBe(200);
    expect(update.body?.data?.catalog?.name).toBe('Rare Birds');
  });

  test('Input: delete catalog, Expected status 200', async () => {
    const token = await obtainToken();
    const created = await api
      .post('/api/catalogs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Birds' });

    const catalogId = created.body?.data?.catalog?._id;
    const del = await api
      .delete(`/api/catalogs/${catalogId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(200);
    const dbCatalog = await catalogModel.findById(catalogId);
    expect(dbCatalog).toBeNull();
  });
});
