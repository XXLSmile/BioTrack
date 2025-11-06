import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, test } from '@jest/globals';

import { SpeciesModel, SpeciesRepository } from '../../../src/recognition/species.model';

describe('Unmocked: SpeciesRepository', () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
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
    await mongoose.disconnect();
    await mongo.stop();
  });

  // Interface SpeciesRepository.findOrCreate
  test('creates species document when absent', async () => {
    // API: SpeciesRepository.findOrCreate
    // Input: payload with unique inaturalistId 1001
    // Expected status code: n/a (repository method), expectation is new species inserted
    // Expected behavior: repository writes document and returns hydrated instance
    // Expected output: species record with matching scientific and common names
    const repository = new SpeciesRepository();
    const payload = {
      inaturalistId: 1001,
      scientificName: 'Corvus brachyrhynchos',
      commonName: 'American Crow',
      rank: 'species',
      wikipediaUrl: 'https://example.com/crow',
      imageUrl: 'https://example.com/crow.jpg',
    };

    const created = await repository.findOrCreate(payload);
    const persisted = await SpeciesModel.findOne({ inaturalistId: payload.inaturalistId });

    expect(created.scientificName).toBe(payload.scientificName);
    expect(persisted?.commonName).toBe(payload.commonName);
    expect(persisted?._id.toString()).toBe(created._id.toString());
  });

  // Interface SpeciesRepository.findOrCreate
  test('reuses previously created species without duplication', async () => {
    // API: SpeciesRepository.findOrCreate
    // Input: same payload invoked twice
    // Expected status code: n/a (repository method), expectation is identical _id returned
    // Expected behavior: second call finds existing document and skips creation
    // Expected output: total collection count remains 1, both calls return same id
    const repository = new SpeciesRepository();
    const payload = {
      inaturalistId: 2020,
      scientificName: 'Ursus arctos',
      commonName: 'Brown Bear',
      rank: 'species',
    };

    const first = await repository.findOrCreate(payload);
    const second = await repository.findOrCreate(payload);
    const count = await SpeciesModel.countDocuments({ inaturalistId: payload.inaturalistId });

    expect(first._id.toString()).toBe(second._id.toString());
    expect(count).toBe(1);
  });

  // Interface SpeciesRepository.findById
  test('looks up species by id and returns null when missing', async () => {
    // API: SpeciesRepository.findById
    // Input: existing species id and random ObjectId
    // Expected status code: n/a (repository method), expectation is matching doc and null fallback
    // Expected behavior: repository returns stored species for known id and null for unknown id
    // Expected output: hydrated species document, null for second lookup
    const repository = new SpeciesRepository();
    const payload = {
      inaturalistId: 3030,
      scientificName: 'Haliaeetus leucocephalus',
      commonName: 'Bald Eagle',
      rank: 'species',
    };

    const created = await repository.findOrCreate(payload);
    const found = await repository.findById(created._id.toString());
    const missing = await repository.findById(new mongoose.Types.ObjectId().toString());

    expect(found?._id.toString()).toBe(created._id.toString());
    expect(missing).toBeNull();
  });
});
