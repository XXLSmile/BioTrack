import { describe, expect, test } from '@jest/globals';

import { ensurePathWithinRoot } from '../../../src/utils/pathSafe';

describe('Mocked: pathSafe utilities', () => {
  // API: ensurePathWithinRoot
  // Input: path attempting to traverse outside root via ../
  // Expected status code: n/a
  // Expected behavior: throws Error indicating traversal detection
  // Expected output: Error with message containing "Path traversal detected"
  test('throws when path attempts traversal outside root', () => {
    const root = '/tmp/uploads';

    expect(() =>
      ensurePathWithinRoot(root, '/tmp/uploads/../secrets.txt')
    ).toThrow(/Path traversal detected/);
  });
});
