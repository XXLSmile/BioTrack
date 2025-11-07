import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

type AsyncRouteHandler<
  P extends ParamsDictionary = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => Response<ResBody> | Promise<Response<ResBody> | void> | void;

/**
 * Wraps an async route handler so unhandled rejections are forwarded to Express.
 */
export const asyncHandler = <
  P extends ParamsDictionary = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs
>(
  handler: AsyncRouteHandler<P, ResBody, ReqBody, ReqQuery>
): RequestHandler<P, ResBody, ReqBody, ReqQuery> => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((error: unknown) => {
      next(error);
    });
  };
};
