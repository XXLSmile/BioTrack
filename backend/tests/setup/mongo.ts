import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { beforeAll, afterEach, afterAll } from '@jest/globals';

import { connectDB, disconnectDB } from '../../src/core/database';

let mongoServer: MongoMemoryServer | null = null;

beforeAll(async () => {
  const mongoOptions = {
    instance: {
      ip: '127.0.0.1',
    },
  };
  mongoServer = await MongoMemoryServer.create(mongoOptions);
  process.env.MONGODB_URI = mongoServer.getUri();
  await connectDB();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await disconnectDB();
  if (mongoServer) {
    await mongoServer.stop();
  }
});
