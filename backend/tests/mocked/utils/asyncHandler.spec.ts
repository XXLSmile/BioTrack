import { describe, expect, jest, test } from '@jest/globals';

import { asyncHandler } from '../../../src/utils/asyncHandler';

describe('Mocked: asyncHandler utility', () => {
  // API: asyncHandler
  // Input: wrapped handler that rejects
  // Expected status code: n/a
  // Expected behavior: wrapper catches rejection and forwards via next()
  // Expected output: next called with error
  test('forwards rejected promises to next middleware', async () => {
    const wrapped = asyncHandler(async () => {
      throw new Error('boom');
    });
    const next = jest.fn();

    await wrapped({} as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
