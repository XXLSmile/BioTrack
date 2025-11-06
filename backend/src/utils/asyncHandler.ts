import type { NextFunction, Request, Response, RequestHandler } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';

type AsyncRouteHandler<
  P extends ParamsDictionary = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, unknown>,
  Locals extends Record<string, unknown> = Record<string, unknown>
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
  res: Response<ResBody, Locals>,
  next: NextFunction
) => unknown | Promise<unknown>;

/**
 * Wraps an async route handler so unhandled rejections are forwarded to Express.
 */
export const asyncHandler = <
  P extends ParamsDictionary = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, unknown>,
  Locals extends Record<string, unknown> = Record<string, unknown>
>(
  handler: AsyncRouteHandler<P, ResBody, ReqBody, ReqQuery, Locals>
): RequestHandler<P, ResBody, ReqBody, ReqQuery, Locals> => {
  return (req, res, next) => {
    Promise.resolve(handler(req as Request<P, ResBody, ReqBody, ReqQuery, Locals>, res as Response<ResBody, Locals>, next)).catch(next);
  };
};
