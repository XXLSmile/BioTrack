import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';

jest.mock('../../../src/config/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

import { AuthController } from '../../../src/controllers/auth.controller';
import { authService } from '../../../src/services/auth.service';

const controller = new AuthController();

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
};

const createRequest = (body: unknown = {}): Request =>
  ({ body } as Request);

const createNext = () => jest.fn() as NextFunction & jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// Interface AuthController.signUp
describe('Mocked: AuthController.signUp', () => {
  test('returns 400 when idToken missing', async () => {
    const req = createRequest({});
    const res = createResponse();
    const next = createNext();
    const signUpSpy = jest.spyOn(authService, 'signUpWithGoogle');

    await controller.signUp(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Google token is required',
    });
    expect(signUpSpy).not.toHaveBeenCalled();
    signUpSpy.mockRestore();
  });

  // Input: request body with Google ID token
  // Expected status code: 201
  // Expected behavior: controller returns success payload from mocked service
  // Expected output: JSON response with message "User signed up successfully" and auth data
  // Mock behavior: authService.signUpWithGoogle resolves with fake auth result
  test('returns 201 when service resolves', async () => {
    const req = createRequest({ idToken: 'token' });
    const res = createResponse();
    const next = createNext();

    jest.spyOn(authService, 'signUpWithGoogle').mockResolvedValueOnce({
      token: 'signed',
      user: { email: 'user@example.com' } as any,
    });

    await controller.signUp(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User signed up successfully',
      data: { token: 'signed', user: { email: 'user@example.com' } },
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: request body with invalid Google token
  // Expected status code: 401
  // Expected behavior: controller maps error to 401 response
  // Expected output: JSON response with message "Invalid Google token"
  // Mock behavior: authService.signUpWithGoogle rejects with "Invalid Google token"
  test('returns 401 when service throws invalid token error', async () => {
    const req = createRequest({ idToken: 'bad' });
    const res = createResponse();
    const next = createNext();

    jest
      .spyOn(authService, 'signUpWithGoogle')
      .mockRejectedValueOnce(new Error('Invalid Google token'));

    await controller.signUp(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid Google token',
    });
  });

  // Input: request body with duplicate Google token
  // Expected status code: 409
  // Expected behavior: controller signals conflict
  // Expected output: 409 response with conflict message from controller
  // Mock behavior: authService.signUpWithGoogle rejects with "User already exists"
  test('returns 409 when service throws user exists error', async () => {
    const req = createRequest({ idToken: 'dup' });
    const res = createResponse();
    const next = createNext();

    jest
      .spyOn(authService, 'signUpWithGoogle')
      .mockRejectedValueOnce(new Error('User already exists'));

    await controller.signUp(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User already exists, please sign in instead.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: request body causing processing failure
  // Expected status code: 500
  // Expected behavior: controller returns internal error message
  // Expected output: JSON response with message "Failed to process user information"
  // Mock behavior: authService.signUpWithGoogle rejects with "Failed to process user"
  test('returns 500 when service throws processing error', async () => {
    const req = createRequest({ idToken: 'err' });
    const res = createResponse();
    const next = createNext();

    jest
      .spyOn(authService, 'signUpWithGoogle')
      .mockRejectedValueOnce(new Error('Failed to process user'));

    await controller.signUp(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Failed to process user information',
    });
  });

  // Input: request body with unexpected service error
  // Expected status code: n/a (error forwarded)
  // Expected behavior: controller delegates error to next()
  // Expected output: next invoked with thrown Error
  // Mock behavior: authService.signUpWithGoogle rejects with generic Error
  test('forwards unexpected errors to next', async () => {
    const req = createRequest({ idToken: 'err' });
    const res = createResponse();
    const next = createNext();
    const error = new Error('boom');

    jest.spyOn(authService, 'signUpWithGoogle').mockRejectedValueOnce(error);

    await controller.signUp(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

// Interface AuthController.signIn
describe('Mocked: AuthController.signIn', () => {
  test('returns 400 when idToken missing', async () => {
    const req = createRequest({});
    const res = createResponse();
    const next = createNext();
    const signInSpy = jest.spyOn(authService, 'signInWithGoogle');

    await controller.signIn(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Google token is required',
    });
    expect(signInSpy).not.toHaveBeenCalled();
    signInSpy.mockRestore();
  });

  // Input: request body with valid token
  // Expected status code: 200
  // Expected behavior: controller returns auth payload
  // Expected output: JSON response with message "User signed in successfully" and auth data
  // Mock behavior: authService.signInWithGoogle resolves with fake result
  test('returns 200 when service resolves', async () => {
    const req = createRequest({ idToken: 'token' });
    const res = createResponse();
    const next = createNext();

    jest.spyOn(authService, 'signInWithGoogle').mockResolvedValueOnce({
      token: 'signed',
      user: { email: 'user@example.com' } as any,
    });

    await controller.signIn(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User signed in successfully',
      data: { token: 'signed', user: { email: 'user@example.com' } },
    });
  });

  // Input: request body with invalid token
  // Expected status code: 401
  // Expected behavior: controller responds with invalid token message
  // Expected output: JSON response with message "Invalid Google token"
  // Mock behavior: authService.signInWithGoogle rejects with "Invalid Google token"
  test('returns 401 when service reports invalid token', async () => {
    const req = createRequest({ idToken: 'bad' });
    const res = createResponse();
    const next = createNext();

    jest
      .spyOn(authService, 'signInWithGoogle')
      .mockRejectedValueOnce(new Error('Invalid Google token'));

    await controller.signIn(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid Google token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: request body for non-existent user
  // Expected status code: 404
  // Expected behavior: controller signals not found
  // Expected output: 404 response with message "User not found"
  // Mock behavior: authService.signInWithGoogle rejects with "User not found"
  test('returns 404 when user not found', async () => {
    const req = createRequest({ idToken: 'unknown' });
    const res = createResponse();
    const next = createNext();

    jest
      .spyOn(authService, 'signInWithGoogle')
      .mockRejectedValueOnce(new Error('User not found'));

    await controller.signIn(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User not found, please sign up first.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: request body causing service failure
  // Expected status code: 500
  // Expected behavior: controller returns failure message
  // Expected output: JSON response with message "Failed to process user information"
  // Mock behavior: authService.signInWithGoogle rejects with "Failed to process user"
  test('returns 500 when processing fails', async () => {
    const req = createRequest({ idToken: 'err' });
    const res = createResponse();
    const next = createNext();

    jest
      .spyOn(authService, 'signInWithGoogle')
      .mockRejectedValueOnce(new Error('Failed to process user'));

    await controller.signIn(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Failed to process user information',
    });
  });

  // Input: request body leading to unexpected service error
  // Expected status code: n/a (error forwarded)
  // Expected behavior: controller calls next(error)
  // Expected output: next invoked with thrown Error
  // Mock behavior: authService.signInWithGoogle rejects with generic Error
  test('forwards unexpected errors to next', async () => {
    const req = createRequest({ idToken: 'boom' });
    const res = createResponse();
    const next = createNext();
    const error = new Error('boom');

    jest.spyOn(authService, 'signInWithGoogle').mockRejectedValueOnce(error);

    await controller.signIn(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

// Interface AuthController.logout
describe('Mocked: AuthController.logout', () => {
  // Input: logout request
  // Expected status code: 200
  // Expected behavior: controller returns success message
  // Expected output: JSON response with message "User logged out successfully"
  // Mock behavior: authService.logout resolves
  test('returns 200 when logout succeeds', async () => {
    const req = createRequest();
    const res = createResponse();
    const next = createNext();

    jest.spyOn(authService, 'logout').mockResolvedValueOnce();

    await controller.logout(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User logged out successfully',
    });
  });

  // Input: logout request causing error
  // Expected status code: n/a (error forwarded)
  // Expected behavior: controller invokes next with error
  // Expected output: next invoked with thrown Error
  // Mock behavior: authService.logout rejects with generic Error
  test('calls next when logout fails', async () => {
    const req = createRequest();
    const res = createResponse();
    const next = createNext();
    const error = new Error('boom');

    jest.spyOn(authService, 'logout').mockRejectedValueOnce(error);

    await controller.logout(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
