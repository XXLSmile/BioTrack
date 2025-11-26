import { describe, expect, test, jest } from '@jest/globals';

jest.mock('../../../src/config/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

import { UserController } from '../../../src/controllers/user.controller';

const controller = new UserController();

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as {
    status: jest.Mock;
    json: jest.Mock;
  };
};

// Interface UserController.getProfile
describe('Unmocked: UserController.getProfile', () => {
  // Input: request with authenticated user payload
  // Expected status code: 200
  // Expected behavior: controller responds with profile data and success message
  // Expected output: JSON containing current user
  test('returns profile for authenticated user', () => {
    const req = { user: { _id: 'user-id', name: 'Sam' } } as any;
    const res = createResponse();

    controller.getProfile(req, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Profile fetched successfully',
      data: { user: req.user },
    });
  });
});
