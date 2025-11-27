import { describe, expect, jest, test } from '@jest/globals';
import type { Request, Response } from 'express';

jest.mock('../../../src/utils/logger.util', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

import { errorHandler, notFoundHandler } from '../../../src/middlewares/errorHandler.middleware';
import logger from '../../../src/utils/logger.util';

const mockLogger = logger as unknown as { error: jest.Mock };

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

describe('Mocked: error handlers', () => {
  // API: notFoundHandler
  // Input: request with method/URL
  // Expected status code: 404
  // Expected behavior: responds with contextual JSON describing missing route
  // Expected output: body containing method, path, and error message
  test('notFoundHandler returns structured 404 payload', () => {
    const req = {
      method: 'GET',
      originalUrl: '/unknown',
    } as unknown as Request;
    const res = createResponse();

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Route not found',
        message: 'Cannot GET /unknown',
        path: '/unknown',
        method: 'GET',
      })
    );
  });

  // API: errorHandler
  // Input: Error thrown from route handler
  // Expected status code: 500
  // Expected behavior: logs the error and responds with generic message
  // Expected output: { message: 'Internal server error' }
  test('errorHandler logs and responds with 500 payload', () => {
    const req = {} as Request;
    const res = createResponse();
    const err = new Error('boom');

    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(mockLogger.error).toHaveBeenCalledWith('Error:', err);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Internal server error',
    });
  });
});
