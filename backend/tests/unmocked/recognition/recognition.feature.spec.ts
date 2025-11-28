import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../../../src/services/recognition.service', () => ({
  recognitionService: {
    recognizeFromUrl: jest.fn(),
  },
}));

jest.mock('../../../src/config/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

import { createApp } from '../../../src/core/app';
import { catalogModel } from '../../../src/models/catalog/catalog.model';
import { catalogEntryLinkModel } from '../../../src/models/catalog/catalogEntryLink.model';
import { catalogRepository } from '../../../src/models/recognition/catalog.model';
import { speciesRepository } from '../../../src/models/recognition/species.model';
import { recognitionService } from '../../../src/services/recognition.service';
import { userModel } from '../../../src/models/user/user.model';
import { createUserAndToken, createUserAndTokenWithPayload } from '../auth/helpers';

const app = createApp();
const api = request(app);

const mockedRecognitionService = recognitionService as jest.Mocked<typeof recognitionService>;
const uploadsDir = path.join(__dirname, '../../..', 'uploads/images');
const fixtureImage = path.join(uploadsDir, 'racoon.jpg');

if (!fs.existsSync(fixtureImage)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(fixtureImage, Buffer.from('racoon fixture image'));
}

const dropTestDbIfReady = async () => {
  const db = mongoose.connection.db;
  if (db) {
    await db.dropDatabase();
  }
};

describe('API: /api/recognition endpoints', () => {
  beforeEach(async () => {
    mockedRecognitionService.recognizeFromUrl.mockReset();
    await dropTestDbIfReady();
  });

  afterEach(async () => {
    await dropTestDbIfReady();
    mockedRecognitionService.recognizeFromUrl.mockReset();
    jest.restoreAllMocks();
  });

  const baselineResult = {
    species: { id: 111, scientificName: 'Procyon lotor', rank: 'species' },
    confidence: 0.8,
  };

  test('POST /api/recognition succeeds using imageUrl', async () => {
    mockedRecognitionService.recognizeFromUrl.mockResolvedValueOnce(baselineResult);

    const response = await api.post('/api/recognition').send({ imageUrl: 'https://example.org/racoon.jpg' });

    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('Species recognized successfully');
    expect(response.body?.data?.recognition?.confidence).toBeCloseTo(0.8);
  });

  test('POST /api/recognition accepts file uploads', async () => {
    mockedRecognitionService.recognizeFromUrl.mockResolvedValueOnce(baselineResult);

    const response = await api.post('/api/recognition').attach('image', fixtureImage);

    expect(response.status).toBe(200);
    expect(response.body?.data?.imagePath).toContain('/uploads/tmp');
  });

  test('POST /api/recognition rejects missing payload', async () => {
    const response = await api.post('/api/recognition').send({});

    expect(response.status).toBe(400);
    expect(response.body?.message).toBe('Provide an image file or an imageUrl to perform recognition.');
  });

  test('POST /api/recognition surfaces recognition errors', async () => {
    mockedRecognitionService.recognizeFromUrl.mockRejectedValueOnce(new Error('No species recognized'));

    const response = await api.post('/api/recognition').send({ imageUrl: 'https://example.org/missing.jpg' });

    expect(response.status).toBe(404);
    expect(response.body?.message).toContain('Could not recognize any species');
  });

  test('POST /api/recognition handles rate limit errors', async () => {
    mockedRecognitionService.recognizeFromUrl.mockRejectedValueOnce(new Error('Rate limit exceeded'));

    const response = await api.post('/api/recognition').send({ imageUrl: 'https://example.org/limit.jpg' });

    expect(response.status).toBe(429);
    expect(response.body?.message).toContain('Rate limit');
  });

  test('POST /api/recognition surfaces timeout responses', async () => {
    mockedRecognitionService.recognizeFromUrl.mockRejectedValueOnce(new Error('Request timed out while calling Zyla'));

    const response = await api.post('/api/recognition').send({ imageUrl: 'https://example.org/timeout.jpg' });

    expect(response.status).toBe(504);
    expect(response.body?.message).toBe('Request timed out. Please try again.');
  });

  test('POST /api/recognition/save requires authentication and orbit', async () => {
    const response = await api.post('/api/recognition/save').send({});
    expect(response.status).toBe(401);

    const token = await createUserAndToken(api);
    const missingImagePath = await api
      .post('/api/recognition/save')
      .set('Authorization', `Bearer ${token}`)
      .send({
        recognition: {
          species: { id: 2, scientificName: 'Test', rank: 'species' },
          confidence: 0.3,
        },
      });
    expect(missingImagePath.status).toBe(400);
    expect(missingImagePath.body?.message).toContain('imagePath is required');

    const missingRecognition = await api
      .post('/api/recognition/save')
      .set('Authorization', `Bearer ${token}`)
      .send({ imagePath: '/uploads/images/racoon.jpg' });
    expect(missingRecognition.status).toBe(400);
    expect(missingRecognition.body?.message).toContain('recognition payload is required');
  });

  test('POST /api/recognition/save handles image relocation when original path not found', async () => {
    const token = await createUserAndToken(api);
    const user = await userModel.findByGoogleId('test-google-id');
    if (!user) throw new Error('User not found');

    // Create a test image in the relocated location
    const relocatedPath = path.join(uploadsDir, 'relocated-test.jpg');
    fs.writeFileSync(relocatedPath, Buffer.from('relocated image data'));

    // Mock safeExistsSync to return false for original path but true for relocated
    const safeFs = require('../../../src/utils/safeFs');
    const originalExists = safeFs.safeExistsSync;
    let callCount = 0;
    jest.spyOn(safeFs, 'safeExistsSync').mockImplementation((filePath: string) => {
      callCount++;
      // First call (original path) returns false, second call (relocated) returns true
      if (callCount === 1) return false;
      if (callCount === 2) return filePath === relocatedPath;
      return originalExists(filePath);
    });

    const response = await api
      .post('/api/recognition/save')
      .set('Authorization', `Bearer ${token}`)
      .send({
        imagePath: '/uploads/tmp/original-test.jpg', // Original path that doesn't exist
        recognition: {
          species: { id: 999, scientificName: 'Relocated test', rank: 'species' },
          confidence: 0.9,
        },
      });

    // Should successfully use relocated path
    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('Recognition saved successfully');

    // Cleanup
    if (fs.existsSync(relocatedPath)) {
      fs.unlinkSync(relocatedPath);
    }
    jest.restoreAllMocks();
  });

  const createEntryForUser = async (userId: mongoose.Types.ObjectId, catalogName?: string) => {
    const species = await speciesRepository.findOrCreate({
      inaturalistId: Date.now() + Math.floor(Math.random() * 10000),
      scientificName: 'Testus examplea',
      rank: 'species',
    });
    const entry = await catalogRepository.create({
      userId: userId.toString(),
      speciesId: species._id.toString(),
      imageUrl: 'https://example.org/test.jpg',
      confidence: 0.6,
      imageHash: new mongoose.Types.ObjectId().toString(),
    });
    const catalog = await catalogModel.createCatalog(userId, {
      name: catalogName ?? `My Catalog ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
    await catalogEntryLinkModel.linkEntry(catalog._id, entry._id, userId);
    return { entry, catalog };
  };

  test('GET /api/recognition/catalog and /recent return saved entries', async () => {
    const token = await createUserAndToken(api);
    const user = await userModel.findByGoogleId('test-google-id');
    if (!user) {
      throw new Error('test user not persisted');
    }
    await createEntryForUser(user._id);

    const catalogRes = await api.get('/api/recognition/catalog').set('Authorization', `Bearer ${token}`);
    expect(catalogRes.status).toBe(200);
    expect(Array.isArray(catalogRes.body?.data?.entries)).toBe(true);

    const recentRes = await api.get('/api/recognition/recent').set('Authorization', `Bearer ${token}`);
    expect(recentRes.status).toBe(200);
    expect(recentRes.body?.data?.count).toBeGreaterThanOrEqual(1);
  });

  test('DELETE /api/recognition/entry/:entryId controls authorization flows', async () => {
    const ownerToken = await createUserAndToken(api);
    const owner = await userModel.findByGoogleId('test-google-id');
    if (!owner) throw new Error('Missing owner');
    const { entry } = await createEntryForUser(owner._id);

    const deleteResponse = await api
      .delete(`/api/recognition/entry/${entry._id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body?.message).toBe('Catalog entry deleted successfully');

    const missingResponse = await api.delete(`/api/recognition/entry/${entry._id}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(missingResponse.status).toBe(404);

    const secondPayload = { sub: 'other-user', email: 'other@example.com', name: 'Other' };
    const otherToken = await createUserAndTokenWithPayload(api, secondPayload);
    const otherUser = await userModel.findByGoogleId(secondPayload.sub);
    if (!otherUser) throw new Error('Missing other user');
    const newEntry = await createEntryForUser(owner._id);
    const forbidden = await api
      .delete(`/api/recognition/entry/${newEntry.entry._id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body?.message).toBe('You do not have permission to delete this entry');
  });
});
