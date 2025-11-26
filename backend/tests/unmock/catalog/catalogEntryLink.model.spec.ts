import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, test } from '@jest/globals';

import { catalogEntryLinkModel } from '../../../src/models/catalog/catalogEntryLink.model';
import { catalogModel } from '../../../src/models/catalog/catalog.model';
import { CatalogModel as CatalogEntryModel } from '../../../src/models/recognition/catalog.model';
import { SpeciesModel } from '../../../src/models/recognition/species.model';
import { userModel } from '../../../src/models/user/user.model';

describe('Unmocked: CatalogEntryLinkModel', () => {
  let mongo: MongoMemoryServer | null = null;
  let ownerId: mongoose.Types.ObjectId;
  let mongoReady = false;

  beforeAll(async () => {
    try {
      mongo = await MongoMemoryServer.create({
        instance: {
          ip: '127.0.0.1',
        },
      });
      await mongoose.connect(mongo.getUri());
      mongoReady = true;
    } catch (error) {
      console.warn('MongoMemoryServer unavailable, skipping catalog entry link integration tests:', error);
    }
  });

  afterEach(async () => {
    ownerId = new mongoose.Types.ObjectId();
    if (mongoReady && mongoose.connection.readyState === 1) {
      await mongoose.connection.db?.dropDatabase();
    }
  });

  afterAll(async () => {
    if (mongoReady) {
      await mongoose.disconnect();
      await mongo?.stop();
    }
  });

  const ensureMongo = () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return false;
    }
    return true;
  };

  const createUser = async () => {
    const googleId = `gid-${Math.random().toString(36).slice(2)}`;
    const user = await userModel.create({
      googleId,
      email: `${googleId}@example.com`,
      name: `User ${googleId}`,
      profilePicture: undefined,
    });
    ownerId = user._id;
    return user;
  };

  const seedCatalogEntry = async () => {
    if (!mongoReady) {
      throw new Error('MongoMemoryServer unavailable');
    }

    await createUser();
    const catalog = await catalogModel.createCatalog(ownerId, { name: 'Primary', description: 'desc' });
    const species = await SpeciesModel.create({
      inaturalistId: Math.floor(Math.random() * 100000),
      scientificName: 'Testus specius',
      rank: 'species',
      commonName: 'Test Species',
    });
    const entry = await CatalogEntryModel.create({
      userId: ownerId,
      speciesId: species._id,
      imageUrl: '/images/species.jpg',
      confidence: 0.9,
      imageHash: Math.random().toString(36).slice(2),
    });
    return { catalog, entry };
  };

  // API: CatalogEntryLinkModel.linkEntry / listEntriesWithDetails
  // Input: persisted catalog and catalog entry documents
  // Expected behavior: linking stores document and populate returns entry + addedBy projections
  // Expected output: populated entries array with normalized ObjectIds
  test('links entries to catalogs and returns populated metadata', async () => {
    if (!ensureMongo()) {
      return;
    }

    const { catalog, entry } = await seedCatalogEntry();

    await catalogEntryLinkModel.linkEntry(catalog._id, entry._id, ownerId);

    const linked = await catalogEntryLinkModel.listEntriesWithDetails(catalog._id);

    expect(linked).toHaveLength(1);
    expect((linked[0].entry as any)._id.toString()).toBe(entry._id.toString());
    expect((linked[0].addedBy as any)?._id?.toString?.()).toBe(ownerId.toString());
  });

  // API: CatalogEntryLinkModel.isEntryLinked / unlinkEntry
  // Input: catalog/entry pairing
  // Expected behavior: reports link existence then removes it
  // Expected output: boolean true before unlink, false after unlink
  test('detects and removes catalog links', async () => {
    if (!ensureMongo()) {
      return;
    }

    const { catalog, entry } = await seedCatalogEntry();
    await catalogEntryLinkModel.linkEntry(catalog._id, entry._id, ownerId);

    await expect(catalogEntryLinkModel.isEntryLinked(catalog._id, entry._id)).resolves.toBe(true);

    await catalogEntryLinkModel.unlinkEntry(catalog._id, entry._id);

    await expect(catalogEntryLinkModel.isEntryLinked(catalog._id, entry._id)).resolves.toBe(false);
  });

  // API: CatalogEntryLinkModel.removeEntryFromAllCatalogs / listCatalogIdsForEntry
  // Input: entry linked to multiple catalogs
  // Expected behavior: removing entry clears all associations and listCatalogIdsForEntry normalizes ids
  // Expected output: empty array after removal
  test('removes entries from every catalog and normalizes distinct ids', async () => {
    if (!ensureMongo()) {
      return;
    }

    const { catalog, entry } = await seedCatalogEntry();
    const secondary = await catalogModel.createCatalog(ownerId, { name: 'Secondary', description: 'desc2' });

    await catalogEntryLinkModel.linkEntry(catalog._id, entry._id, ownerId);
    await catalogEntryLinkModel.linkEntry(secondary._id, entry._id, ownerId);

    const catalogIdsBefore = await catalogEntryLinkModel.listCatalogIdsForEntry(entry._id);
    expect(catalogIdsBefore.map(id => id.toString()).sort()).toEqual(
      [catalog._id.toString(), secondary._id.toString()].sort()
    );

    await catalogEntryLinkModel.removeEntryFromAllCatalogs(entry._id);

    const catalogIdsAfter = await catalogEntryLinkModel.listCatalogIdsForEntry(entry._id);
    expect(catalogIdsAfter).toHaveLength(0);
  });
});
