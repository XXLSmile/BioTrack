import type { NextFunction, Request, Response, RequestHandler } from 'express';
type HandlerResult = Response<any, any> | void;

type AsyncRouteHandler = (
  req: Request<any, any, any, any>,
  res: Response<any, any>,
  next: NextFunction
) => HandlerResult | Promise<HandlerResult>;

/**
 * Wraps an async route handler so unhandled rejections are forwarded to Express.
 */
export const asyncHandler = (handler: AsyncRouteHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(
      handler(req, res, next)
    ).catch(next);
  };
};
