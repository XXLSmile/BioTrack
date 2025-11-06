import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

jest.mock('../../../src/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

jest.mock('../../../src/user/user.model', () => ({
  userModel: {
    findById: jest.fn(),
  },
}));

import { authenticateToken } from '../../../src/auth/auth.middleware';
import { userModel } from '../../../src/user/user.model';

const createResponse = (): Response & {
  status: jest.Mock;
  json: jest.Mock;
} => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
};

const createRequest = (token?: string): Request =>
  ({
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as unknown as Request);

const createNext = () => jest.fn() as NextFunction & jest.Mock;

const mockedUserModel = userModel as jest.Mocked<typeof userModel>;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.DISABLE_AUTH = 'false';
});

// Interface authenticateToken
describe('Mocked: authenticateToken', () => {
  // Input: Authorization header with valid token, database returns user
  // Expected status code: n/a (middleware calls next)
  // Expected behavior: middleware attaches user to request and proceeds
  // Expected output: request.user populated and next invoked once
  // Mock behavior: jwt.verify returns decoded id, userModel.findById resolves user
  test('calls next with user attached when token valid', async () => {
    const userId = new mongoose.Types.ObjectId();
    jest.spyOn(jwt, 'verify').mockReturnValueOnce({ id: userId } as any);
    mockedUserModel.findById.mockResolvedValueOnce({ _id: userId } as any);

    const req = createRequest('valid');
    const res = createResponse();
    const next = createNext();

    await authenticateToken(req, res, next);

    expect(mockedUserModel.findById).toHaveBeenCalledWith(userId);
    expect((req as any).user).toEqual({ _id: userId });
    expect(next).toHaveBeenCalledTimes(1);
  });

  // Input: Authorization header with valid token but user missing
  // Expected status code: 401
  // Expected behavior: middleware reports missing user
  // Expected output: JSON error "User not found" and message "Token is valid but user no longer exists"
  // Mock behavior: jwt.verify returns decoded id, userModel.findById resolves null
  test('returns 401 when decoded user not found', async () => {
    const userId = new mongoose.Types.ObjectId();
    jest.spyOn(jwt, 'verify').mockReturnValueOnce({ id: userId } as any);
    mockedUserModel.findById.mockResolvedValueOnce(null);

    const req = createRequest('valid');
    const res = createResponse();
    const next = createNext();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'User not found',
      message: 'Token is valid but user no longer exists',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: Authorization header whose token decodes without id
  // Expected status code: 401
  // Expected behavior: middleware reports verification failure
  // Expected output: JSON error "Invalid token" and message "Token verification failed"
  test('returns 401 when decoded payload missing id', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValueOnce({} as any);

    const req = createRequest('valid');
    const res = createResponse();
    const next = createNext();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
      message: 'Token verification failed',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: Authorization header with malformed token
  // Expected status code: 401
  // Expected behavior: middleware reports invalid token
  // Expected output: JSON error "Invalid token" and message "Token is malformed or expired"
  // Mock behavior: jwt.verify throws JsonWebTokenError
  test('returns 401 when jwt.verify throws JsonWebTokenError', async () => {
    jest.spyOn(jwt, 'verify').mockImplementationOnce(() => {
      throw new jwt.JsonWebTokenError('malformed');
    });

    const req = createRequest('invalid');
    const res = createResponse();
    const next = createNext();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
      message: 'Token is malformed or expired',
    });
  });

  // Input: Authorization header with expired token
  // Expected status code: 401
  // Expected behavior: middleware reports invalid/expired token
  // Expected output: JSON error "Token expired" and message "Please login again"
  // Mock behavior: jwt.verify throws TokenExpiredError
  test('returns 401 when jwt.verify throws TokenExpiredError', async () => {
    jest.spyOn(jwt, 'verify').mockImplementationOnce(() => {
      throw new jwt.TokenExpiredError('expired', new Date());
    });

    const req = createRequest('expired');
    const res = createResponse();
    const next = createNext();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Token expired',
      message: 'Please login again',
    });
  });

  // Input: Authorization header triggering unexpected error
  // Expected status code: n/a (middleware forwards error)
  // Expected behavior: middleware calls next(error)
  // Expected output: next invoked with original error
  test('forwards unexpected errors to next', async () => {
    const boom = new Error('boom');
    jest.spyOn(jwt, 'verify').mockImplementationOnce(() => {
      throw boom;
    });

    const req = createRequest('token');
    const res = createResponse();
    const next = createNext();

    await authenticateToken(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(boom);
  });
});
