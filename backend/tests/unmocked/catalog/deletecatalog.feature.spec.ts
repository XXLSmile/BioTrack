import { afterEach, beforeEach, describe, expect, test, jest } from '@jest/globals';
import { api, createCatalogRequest, dropTestDb } from './test.utils';
import { createUserAndToken, createUserAndTokenWithPayload } from '../auth/helpers';

describe('API: catalog deletion flow', () => {
  beforeEach(async () => {
    await dropTestDb();
  });

  afterEach(async () => {
    await dropTestDb();
    jest.restoreAllMocks();
  });

  test('deletes catalog for owner', async () => {
    const token = await createUserAndToken(api);
    const created = await createCatalogRequest(token, { name: 'Birds' });
    const catalogId = created.body?.data?.catalog?._id;

    const deleted = await api
      .delete(`/api/catalogs/${catalogId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleted.status).toBe(200);
    expect(deleted.body?.message).toBe('Catalog deleted successfully');
  });

  test('prevents deletion by non-owners', async () => {
    const ownerToken = await createUserAndToken(api);
    const created = await createCatalogRequest(ownerToken, { name: 'Birds' });
    const catalogId = created.body?.data?.catalog?._id;
    const otherToken = await createUserAndTokenWithPayload(api, {
      sub: 'other-user-id',
      email: 'other@example.com',
      name: 'Other',
    });

    const response = await api
      .delete(`/api/catalogs/${catalogId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(response.status).toBe(403);
    expect(response.body?.message).toBe('Only the owner can delete this catalog');
  });
});
