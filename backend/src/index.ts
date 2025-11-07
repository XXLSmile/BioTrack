import http from 'http';

import { connectDB } from './database';
import { initializeSocketServer } from './socket/socket.manager';
import { createApp } from './app';
import logger from './logger.util';

const app = createApp();
const PORT = process.env.PORT ?? 3000;

const server = http.createServer(app);
initializeSocketServer(server);

connectDB().catch((error: unknown) => {
  logger.error('Failed to initialize MongoDB connection:', error);
});

server.listen(PORT, () => {
  logger.info('🚀 Server running on port', String(PORT));
});
