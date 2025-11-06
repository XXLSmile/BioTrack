import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../../src/auth/auth.middleware';

jest.mock('../../src/user/user.model', () => ({
  userModel: {
    findById: jest.fn(),
  },
}));

const { userModel } = jest.requireMock('../../src/user/user.model') as {
  userModel: { findById: jest.Mock };
};

const findByIdMock = userModel.findById;

jest.mock('jsonwebtoken', () => {
  const actual = jest.requireActual('jsonwebtoken');
  return {
    ...actual,
    verify: jest.fn(),
  };
});

const verifyMock = jwt.verify as unknown as jest.Mock;

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
  ({
    headers,
  } as unknown as Request & { user?: unknown });

const createNext = () => jest.fn() as NextFunction & jest.Mock;

describe('Mocked: authenticateToken middleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.DISABLE_AUTH = 'false';
    process.env.TEST_USER_ID = '';
    verifyMock.mockReset();
    findByIdMock.mockReset();
  });

  test('skips authentication when DISABLE_AUTH=true and test user exists', async () => {
    process.env.DISABLE_AUTH = 'true';
    const testUserId = new mongoose.Types.ObjectId();
    process.env.TEST_USER_ID = testUserId.toString();
    const testUser = { _id: testUserId, email: 'test@example.com' };
    findByIdMock.mockResolvedValueOnce(testUser);

    const req = createRequest();
    const res = createResponse();
    const next = createNext();

    await authenticateToken(req, res, next);

    expect(findByIdMock).toHaveBeenCalled();
    expect(req.user).toBe(testUser);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 401 when authorization header is missing', async () => {
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

  test('returns 401 when token verification yields no id', async () => {
    const req = createRequest({ authorization: 'Bearer token' });
    const res = createResponse();
    const next = createNext();

    verifyMock.mockReturnValueOnce({});

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
      message: 'Token verification failed',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when user not found for decoded token', async () => {
    const req = createRequest({ authorization: 'Bearer token' });
    const res = createResponse();
    const next = createNext();
    const userId = new mongoose.Types.ObjectId();

    verifyMock.mockReturnValueOnce({ id: userId });
    findByIdMock.mockResolvedValueOnce(null);

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'User not found',
      message: 'Token is valid but user no longer exists',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next when token and user are valid', async () => {
    const req = createRequest({ authorization: 'Bearer token' });
    const res = createResponse();
    const next = createNext();
    const user = { _id: new mongoose.Types.ObjectId(), email: 'valid@example.com' };

    verifyMock.mockReturnValueOnce({ id: user._id });
    findByIdMock.mockResolvedValueOnce(user);

    await authenticateToken(req, res, next);

    expect(findByIdMock).toHaveBeenCalledWith(user._id);
    expect(req.user).toBe(user);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('returns 401 when jwt.verify throws JsonWebTokenError', async () => {
    const req = createRequest({ authorization: 'Bearer token' });
    const res = createResponse();
    const next = createNext();

    verifyMock.mockImplementationOnce(() => {
      throw new jwt.JsonWebTokenError('malformed');
    });

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
      message: 'Token is malformed or expired',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when jwt.verify throws TokenExpiredError', async () => {
    const req = createRequest({ authorization: 'Bearer token' });
    const res = createResponse();
    const next = createNext();

    verifyMock.mockImplementationOnce(() => {
      throw new jwt.TokenExpiredError('expired', new Date());
    });

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Token expired',
      message: 'Please login again',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
