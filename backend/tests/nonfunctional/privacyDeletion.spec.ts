import { afterAll, afterEach, beforeAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';

import { createApp } from '../../src/core/app';
import { userModel } from '../../src/models/user/user.model';
import { friendshipModel } from '../../src/models/friends/friend.model';
import { catalogModel } from '../../src/models/catalog/catalog.model';
import { CatalogModel as CatalogEntryModel } from '../../src/models/recognition/catalog.model';

const buildTestUserPayload = (index: number) => ({
  googleId: `google-${index}`,
  email: `user${index}@example.com`,
  name: `User ${index}`,
  profilePicture: `https://example.com/u${index}.jpg`,
});

const signToken = (userId: mongoose.Types.ObjectId): string => {
  const secret = process.env.JWT_SECRET ?? 'test-jwt-secret';
  return jwt.sign({ id: userId.toString() }, secret, { expiresIn: '1h' });
};

describe('NFR: Privacy & Data Protection', () => {
  let mongo: MongoMemoryServer | undefined;
  let mongoReady = false;
  const app = createApp();

  beforeAll(async () => {
    try {
      mongo = await MongoMemoryServer.create();
      await mongoose.connect(mongo.getUri());
      mongoReady = true;
    } catch (error) {
      console.warn(
        'MongoMemoryServer unavailable, skipping privacy/deletion NFR tests:',
        error
      );
    }
  });

  afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
      const db = mongoose.connection.db;
      if (db) {
        await db.dropDatabase();
      }
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    if (mongoReady && mongo) {
      await mongo.stop();
    }
  });

  test('catalog endpoints reject unauthenticated access', async () => {
    if (!mongoReady) {
      console.warn('Skipping catalog endpoint NFR test because Mongo is unavailable.');
      return;
    }

    const response = await request(app).get('/api/catalogs');
    expect(response.status).toBe(401);
  });

  test('deleting a profile removes personal data and invalidates the token', async () => {
    if (!mongoReady) {
      console.warn('Skipping profile deletion NFR test because Mongo is unavailable.');
      return;
    }

    const primaryUser = await userModel.create(buildTestUserPayload(1));
    const friendUser = await userModel.create(buildTestUserPayload(2));
    const token = signToken(primaryUser._id);

    const friendship = await friendshipModel.createRequest(primaryUser._id, friendUser._id);
    await friendshipModel.updateRequestStatus(
      friendship._id as mongoose.Types.ObjectId,
      'accepted'
    );
    await userModel.incrementFriendCount(primaryUser._id);
    await userModel.incrementFriendCount(friendUser._id);

    await catalogModel.createCatalog(primaryUser._id, {
      name: 'Field Notes',
      description: 'West Coast wildlife',
    });

    await CatalogEntryModel.create({
      userId: primaryUser._id,
      speciesId: new mongoose.Types.ObjectId(),
      imageUrl: '/uploads/images/test.jpg',
      confidence: 0.96,
      imageHash: `hash-${primaryUser._id.toString()}`,
    });

    const profileBeforeDeletion = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(profileBeforeDeletion.status).toBe(200);

    const deletionResponse = await request(app)
      .delete('/api/user/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(deletionResponse.status).toBe(200);

    const userAfterDeletion = await userModel.findById(primaryUser._id);
    expect(userAfterDeletion).toBeNull();

    const friendships = await friendshipModel.getRelationshipsForUser(primaryUser._id);
    expect(friendships).toHaveLength(0);

    const catalogs = await catalogModel.listCatalogs(primaryUser._id);
    expect(catalogs).toHaveLength(0);

    const entries = await CatalogEntryModel.find({ userId: primaryUser._id });
    expect(entries).toHaveLength(0);

    const profileAfterDeletion = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(profileAfterDeletion.status).toBe(401);
  });
});
