import http from 'http';

import { connectDB } from './database';
import { initializeSocketServer } from './socket/socket.manager';
import { createApp } from './app';

const app = createApp();
const PORT = process.env.PORT ?? 3000;

const server = http.createServer(app);
initializeSocketServer(server);

connectDB();

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
