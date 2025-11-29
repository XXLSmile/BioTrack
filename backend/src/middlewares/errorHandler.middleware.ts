import type { ErrorRequestHandler, Request, Response } from 'express';

import logger from '../utils/logger.util';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  logger.error(`Error handling ${req.method} ${req.originalUrl}:`, error);

  return res.status(500).json({
    message: 'Internal server error',
  });
};
