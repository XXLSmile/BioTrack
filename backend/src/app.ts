import dotenv from 'dotenv';
import express from 'express';
import path from 'path';

import router from './routes';
import { errorHandler, notFoundHandler } from './errorHandler.middleware';

dotenv.config();

export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use('/api', router);
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
  app.use('*', notFoundHandler);
  app.use(errorHandler);

  return app;
};

export type AppInstance = ReturnType<typeof createApp>;
