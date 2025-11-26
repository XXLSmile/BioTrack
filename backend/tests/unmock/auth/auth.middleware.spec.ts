import { afterEach, beforeEach, describe, expect, test, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

jest.mock('../../../src/config/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

import { authenticateToken } from '../../../src/middlewares/auth.middleware';

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

const createRequest = (headers: Record<string, string | undefined> = {}) =>
  ({ headers } as Request);

const createNext = () => jest.fn() as NextFunction & jest.Mock;

beforeEach(() => {
  process.env.DISABLE_AUTH = 'false';
  delete process.env.TEST_USER_ID;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Interface authenticateToken
describe('Unmocked: authenticateToken', () => {
  // Input: request without Authorization header
  // Expected status code: 401
  // Expected behavior: middleware rejects and sends JSON error
  // Expected output: message "No token provided"
  test('rejects when token missing', async () => {
    const req = createRequest();
    const res = createResponse();
    const next = createNext();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Access denied',
      message: 'No token provided',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: Authorization header with malformed token
  // Expected status code: 401
  // Expected behavior: middleware responds with invalid token message
  // Expected output: message "Token is malformed or expired"
  test('rejects when token cannot be verified', async () => {
    const req = createRequest({ authorization: 'Bearer invalid' });
    const res = createResponse();
    const next = createNext();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
      message: 'Token is malformed or expired',
    });
  });

  // Input: expired JWT signed with same secret
  // Expected status code: 401
  // Expected behavior: middleware identifies expired token
  // Expected output: message "Please login again"
  test('rejects expired token', async () => {
    const expiredToken = jwt.sign({ id: '123' }, process.env.JWT_SECRET!, {
      expiresIn: '-1s',
    });
    const req = createRequest({ authorization: `Bearer ${expiredToken}` });
    const res = createResponse();
    const next = createNext();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Token expired',
      message: 'Please login again',
    });
  });

  // Input: DISABLE_AUTH=true without TEST_USER_ID
  // Expected status code: 401
  // Expected behavior: middleware enforces authentication despite env override
  // Expected output: message "No token provided"
  test('still rejects when DISABLE_AUTH=true and no test user', async () => {
    process.env.DISABLE_AUTH = 'true';
    const req = createRequest();
    const res = createResponse();
    const next = createNext();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Access denied',
      message: 'No token provided',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
