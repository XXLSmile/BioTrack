import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | undefined;

beforeAll(async () => {
  const testPath = expect.getState().testPath ?? '';
  if (process.env.SKIP_MONGO === 'true' || testPath.endsWith('recognition.service.spec.ts')) {
    return;
  }

  mongoServer = await MongoMemoryServer.create({
    instance: {
      ip: '127.0.0.1',
    },
  });
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;

  const { connectDB } = await import('../../src/database');
  await connectDB();
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map(collection => collection.deleteMany({}))
  );
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    const { disconnectDB } = await import('../../src/database');
    await disconnectDB();
  }

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = undefined;
  }
});
