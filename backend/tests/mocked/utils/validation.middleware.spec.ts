import { describe, expect, jest, test } from '@jest/globals';
import { z } from 'zod';

import { validateBody } from '../../../src/middlewares/validation.middleware';

const createResponse = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('Mocked: validateBody middleware', () => {
  test('passes validated data to next when payload valid', async () => {
    const schema = z.object({ name: z.string() });
    const middleware = validateBody(schema);
    const req: any = { body: { name: 'Alice', extra: 'ignored' } };
    const res = createResponse();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'Alice' });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 400 when zod validation fails', async () => {
    const schema = z.object({ name: z.string() });
    const middleware = validateBody(schema);
    const req: any = { body: {} };
    const res = createResponse();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation error',
        details: expect.any(Array),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('responds 500 when schema throws unknown error', async () => {
    const schema: any = { parse: jest.fn(() => { throw new Error('boom'); }) };
    const middleware = validateBody(schema);
    const req: any = { body: {} };
    const res = createResponse();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal server error',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
