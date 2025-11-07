import { describe, expect, test } from '@jest/globals';

import { updateCatalogSchema } from '../../../src/catalog/catalog.types';

describe('Mocked: catalog.types', () => {
  // API: updateCatalogSchema
  // Input: payload with only name
  // Expected behavior: schema accepts partial updates
  test('updateCatalogSchema accepts single-field updates', () => {
    expect(() =>
      updateCatalogSchema.parse({ name: 'New Name' })
    ).not.toThrow();
  });

  // API: updateCatalogSchema
  // Input: empty payload
  // Expected behavior: schema rejects payload without any fields
  test('updateCatalogSchema requires at least one field', () => {
    expect(() =>
      updateCatalogSchema.parse({})
    ).toThrow(/At least one field must be provided/);
  });
});
