import { describe, expect, jest, test } from '@jest/globals';

jest.mock('../../../src/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

import { AuthController } from '../../../src/auth/auth.controller';

const controller = new AuthController();

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as any;
};

// Interface AuthController.logout
describe('Unmocked: AuthController.logout', () => {
  // Input: Express request with no body
  // Expected status code: 200
  // Expected behavior: controller delegates to real authService.logout()
  // Expected output: message "User logged out successfully"
  test('returns success with real authService', async () => {
    const req = {} as any;
    const res = createResponse();
    const next = jest.fn();

    await controller.logout(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User logged out successfully',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
