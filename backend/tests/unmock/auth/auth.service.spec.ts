import { describe, expect, test ,jest} from '@jest/globals';

jest.mock('../../../src/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

import { authService } from '../../../src/auth/auth.service';

// Interface AuthService.logout
describe('Unmocked: AuthService.logout', () => {
  // Input: none
  // Expected status code: n/a (service resolves promise)
  // Expected behavior: resolves immediately
  // Expected output: undefined
  test('resolves with real implementation', async () => {
    await expect(authService.logout()).resolves.toBeUndefined();
  });
});
