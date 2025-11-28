import mongoose from 'mongoose';
import request from 'supertest';

import { createApp } from '../../../src/core/app';

export const app = createApp();
export const api = request(app);

export const payloadFor = (suffix: string) => ({
  sub: `test-google-id-${suffix}-${Math.floor(Math.random() * 1000)}`,
  email: `user-${suffix}@example.com`,
  name: `User ${suffix}`,
});

export const dropTestDb = async () => {
  const db = mongoose.connection.db;
  if (db) {
    await db.dropDatabase();
  }
};

export const createCatalogRequest = (token: string, body: { name: string; description?: string }) =>
  api.post('/api/catalogs').set('Authorization', `Bearer ${token}`).send(body);
