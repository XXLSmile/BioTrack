import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, test } from '@jest/globals';

import { CatalogModel } from '../../../src/catalog/catalog.model';

describe('Unmocked: CatalogModel', () => {
  let mongo: MongoMemoryServer;
  let catalogModel: CatalogModel;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    catalogModel = new CatalogModel();
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

  // Interface CatalogModel.createCatalog / CatalogModel.findCatalogById
  test('creates catalog and enforces owner scoping on lookup', async () => {
    // API: CatalogModel.createCatalog, CatalogModel.findCatalogById
    // Input: owner ObjectId, payload { name, description }
    // Expected status code: n/a (model methods), expectation is persisted catalog document
    // Expected behavior: createCatalog stores document; findCatalogById returns it only for matching owner
    // Expected output: created catalog returned to owner, null for mismatched owner
    const owner = new mongoose.Types.ObjectId();
    const payload = { name: 'Birding Log', description: 'Notebook for sightings' };

    const created = await catalogModel.createCatalog(owner, payload);

    expect(created.owner.toString()).toBe(owner.toString());
    expect(created.name).toBe(payload.name);
    expect(created.description).toBe(payload.description);

    const fetched = await catalogModel.findCatalogById(created._id.toString(), owner);
    const wrongOwnerFetch = await catalogModel.findCatalogById(
      created._id.toString(),
      new mongoose.Types.ObjectId()
    );

    expect(fetched?.name).toBe(payload.name);
    expect(wrongOwnerFetch).toBeNull();
  });

  // Interface CatalogModel.listCatalogs
  test('lists catalogs ordered by most recently updated', async () => {
    // API: CatalogModel.listCatalogs
    // Input: owner ObjectId with two catalogs
    // Expected status code: n/a (model method), expectation is array sorted by updatedAt desc
    // Expected behavior: updateCatalog bumps updatedAt so entry surfaces first in listCatalogs
    // Expected output: array ordered [updated catalog, untouched catalog]
    const owner = new mongoose.Types.ObjectId();

    const first = await catalogModel.createCatalog(owner, { name: 'Early', description: 'First' });
    const second = await catalogModel.createCatalog(owner, { name: 'Later', description: 'Second' });

    await catalogModel.updateCatalog(first._id.toString(), owner, { description: 'Refreshed' });

    const catalogs = await catalogModel.listCatalogs(owner);
    const ids = catalogs.map((catalog) => catalog._id.toString());

    expect(ids).toEqual([first._id.toString(), second._id.toString()]);
    expect(catalogs[0].description).toBe('Refreshed');
  });

  // Interface CatalogModel.updateCatalog / CatalogModel.deleteCatalog / CatalogModel.findById
  test('updates catalog fields and deletes documents with guard rails', async () => {
    // API: CatalogModel.updateCatalog, CatalogModel.deleteCatalog, CatalogModel.findById
    // Input: owner ObjectId and created catalog document
    // Expected status code: n/a (model methods), expectation is successful update followed by deletion
    // Expected behavior: invalid ids return early; valid ids update and delete the record
    // Expected output: updateCatalog returns modified doc, deleteCatalog returns true, subsequent findById null
    const owner = new mongoose.Types.ObjectId();
    const created = await catalogModel.createCatalog(owner, { name: 'Temp', description: 'ToRemove' });

    const invalidUpdate = await catalogModel.updateCatalog('not-valid', owner, { name: 'Nope' });
    expect(invalidUpdate).toBeNull();

    const updated = await catalogModel.updateCatalog(created._id.toString(), owner, {
      name: 'Renamed',
      description: 'Updated',
    });

    expect(updated?.name).toBe('Renamed');
    expect(updated?.description).toBe('Updated');

    const invalidDelete = await catalogModel.deleteCatalog('bad-id', owner);
    expect(invalidDelete).toBe(false);

    const deleted = await catalogModel.deleteCatalog(created._id.toString(), owner);
    expect(deleted).toBe(true);

    const lookup = await catalogModel.findById(created._id.toString());
    expect(lookup).toBeNull();
  });
});
