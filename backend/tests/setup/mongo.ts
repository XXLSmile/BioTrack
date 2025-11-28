import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { beforeAll, afterEach, afterAll } from '@jest/globals';

import { connectDB, disconnectDB } from '../../src/core/database';

let mongoServer: MongoMemoryServer | null = null;
const SKIP_MONGO = process.env.SKIP_MONGO_MEMORY === '1';

beforeAll(async () => {
  // In sandbox / fully mocked runs, do not start MongoMemoryServer at all
  if (SKIP_MONGO) {
    // Optionally log for debugging:
    // console.warn('[tests/setup/mongo] SKIP_MONGO_MEMORY=1 → not starting MongoMemoryServer');
    return;
  }

  const mongoOptions = {
    instance: {
      // binding to localhost is usually safer; you can even omit 'instance' entirely
      ip: '127.0.0.1',
    },
  };

  mongoServer = await MongoMemoryServer.create(mongoOptions);
  process.env.MONGODB_URI = mongoServer.getUri();
  await connectDB();
});

afterEach(async () => {
  if (SKIP_MONGO) {
    return;
  }

  // Only try to clean collections if we actually have a live connection
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (SKIP_MONGO) {
    return;
  }

  await disconnectDB();
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
});
