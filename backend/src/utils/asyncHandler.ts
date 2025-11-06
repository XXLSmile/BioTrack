import type { NextFunction, Request, Response, RequestHandler } from 'express';

type AsyncRouteHandler = (
  req: Request<any, any, any, any>,
  res: Response<any, any>,
  next: NextFunction
) => unknown | Promise<unknown>;

/**
 * Wraps an async route handler so unhandled rejections are forwarded to Express.
 */
export const asyncHandler = (handler: AsyncRouteHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};
