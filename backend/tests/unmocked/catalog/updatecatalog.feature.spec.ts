import { afterEach, beforeEach, describe, expect, test, jest } from '@jest/globals';
import { api, createCatalogRequest, dropTestDb } from './test.utils';
import { createUserAndToken } from '../auth/helpers';

describe('API: catalog update flow', () => {
  beforeEach(async () => {
    await dropTestDb();
  });

  afterEach(async () => {
    await dropTestDb();
    jest.restoreAllMocks();
  });

  test('updates catalog metadata', async () => {
    const token = await createUserAndToken(api);
    const created = await createCatalogRequest(token, { name: 'Birds', description: 'desc' });
    const catalogId = created.body?.data?.catalog?._id;

    const response = await api
      .patch(`/api/catalogs/${catalogId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Rare Birds' });

    expect(response.status).toBe(200);
    expect(response.body?.data?.catalog?.name).toBe('Rare Birds');
  });

  test('rejects duplicate names on update', async () => {
    const token = await createUserAndToken(api);
    const first = await createCatalogRequest(token, { name: 'Birds' });
    const second = await createCatalogRequest(token, { name: 'Mammals' });
    const secondId = second.body?.data?.catalog?._id;

    const conflict = await api
      .patch(`/api/catalogs/${secondId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Birds' });

    expect(conflict.status).toBe(409);
    expect(conflict.body?.message).toBe('Catalog with the same name already exists');
  });
});
