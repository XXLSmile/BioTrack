import mongoose from 'mongoose';
import { beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { CatalogModel } from '../../../src/catalog/catalog.model';

describe('Mocked: CatalogModel', () => {
  let model: CatalogModel;
  let collectionMock: {
    findById: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    findOneAndUpdate: jest.Mock;
    deleteOne: jest.Mock;
    deleteMany: jest.Mock;
  };

  beforeAll(() => {
    model = new CatalogModel();
  });

  beforeEach(() => {
    collectionMock = {
      findById: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
    };

    (model as any).catalog = collectionMock;
  });

  // Interface CatalogModel.findById
  test('returns null without hitting database when catalog id invalid', async () => {
    // API: CatalogModel.findById
    // Input: catalogId 'invalid-id'
    // Expected status code: n/a (model method), expectation is null result
    // Expected behavior: exits early and skips collection.findById
    // Expected output: null
    const result = await model.findById('invalid-id');

    expect(result).toBeNull();
    expect(collectionMock.findById).not.toHaveBeenCalled();
  });

  // Interface CatalogModel.findById
  test('delegates to collection.findById when catalog id valid', async () => {
    // API: CatalogModel.findById
    // Input: catalogId valid ObjectId string
    // Expected status code: n/a (model method), expectation is resolved catalog document
    // Expected behavior: calls collection.findById once with provided id
    // Expected output: mocked catalog document
    const catalogId = new mongoose.Types.ObjectId().toString();
    const mockedCatalog = { _id: catalogId };

    collectionMock.findById.mockImplementationOnce(async () => mockedCatalog);

    const result = await model.findById(catalogId);

    expect(collectionMock.findById).toHaveBeenCalledWith(catalogId);
    expect(result).toBe(mockedCatalog);
  });

  // Interface CatalogModel.createCatalog
  test('creates catalog with owner and payload', async () => {
    // API: CatalogModel.createCatalog
    // Input: owner ObjectId and payload with name/description
    // Expected status code: n/a (model method), expectation is created catalog document
    // Expected behavior: forwards payload and owner to collection.create
    // Expected output: mocked created catalog document
    const owner = new mongoose.Types.ObjectId();
    const payload = { name: 'My Catalog', description: 'Birds only' };
    const createdCatalog = { _id: new mongoose.Types.ObjectId(), owner, ...payload };

    collectionMock.create.mockImplementationOnce(async () => createdCatalog);

    const result = await model.createCatalog(owner, payload);

    expect(collectionMock.create).toHaveBeenCalledWith({
      owner,
      name: payload.name,
      description: payload.description,
    });
    expect(result).toBe(createdCatalog);
  });

  // Interface CatalogModel.findCatalogById
  test('returns null and skips query when findCatalogById receives invalid id', async () => {
    // API: CatalogModel.findCatalogById
    // Input: catalogId 'invalid', owner ObjectId
    // Expected status code: n/a (model method), expectation is null result
    // Expected behavior: guard returns early without touching collection
    // Expected output: null
    const owner = new mongoose.Types.ObjectId();

    const result = await model.findCatalogById('invalid', owner);

    expect(result).toBeNull();
    expect(collectionMock.findOne).not.toHaveBeenCalled();
  });

  // Interface CatalogModel.findCatalogById
  test('invokes findOne with owner filter when catalog id valid', async () => {
    // API: CatalogModel.findCatalogById
    // Input: catalogId string of valid ObjectId, owner mongoose ObjectId
    // Expected status code: n/a (model method), expectation is resolved catalog document
    // Expected behavior: delegates to collection.findOne with _id and owner
    // Expected output: catalog document returned from mock
    // Mock behavior: collection.findOne resolves mockedCatalog
    const catalogId = new mongoose.Types.ObjectId().toString();
    const owner = new mongoose.Types.ObjectId();
    const mockedCatalog = { _id: catalogId, owner };

    collectionMock.findOne.mockImplementationOnce(async () => mockedCatalog);

    const result = await model.findCatalogById(catalogId, owner);

    expect(collectionMock.findOne).toHaveBeenCalledWith({ _id: catalogId, owner });
    expect(result).toBe(mockedCatalog);
  });

  // Interface CatalogModel.updateCatalog
  test('returns null and skips update when catalog id invalid', async () => {
    // API: CatalogModel.updateCatalog
    // Input: catalogId 'bad', owner ObjectId, payload { name: 'New name' }
    // Expected status code: n/a (model method), expectation is null result
    // Expected behavior: guard stops before findOneAndUpdate
    // Expected output: null
    const owner = new mongoose.Types.ObjectId();
    const result = await model.updateCatalog('bad', owner, { name: 'New name' });

    expect(result).toBeNull();
    expect(collectionMock.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // Interface CatalogModel.updateCatalog
  test('updates catalog name when id valid', async () => {
    // API: CatalogModel.updateCatalog
    // Input: catalogId valid string, owner ObjectId, payload { name: 'Updated' }
    // Expected status code: n/a (model method), expectation is updated catalog document
    // Expected behavior: issues findOneAndUpdate with $set payload and returns updated doc
    // Expected output: mocked updated catalog returned
    // Mock behavior: collection.findOneAndUpdate resolves updatedCatalog
    const catalogId = new mongoose.Types.ObjectId().toString();
    const owner = new mongoose.Types.ObjectId();
    const updatedCatalog = { _id: catalogId, owner, name: 'Updated' };

    collectionMock.findOneAndUpdate.mockImplementationOnce(async () => updatedCatalog);

    const result = await model.updateCatalog(catalogId, owner, { name: 'Updated' });

    expect(collectionMock.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: catalogId, owner },
      { $set: { name: 'Updated' } },
      { new: true }
    );
    expect(result).toBe(updatedCatalog);
  });

  // Interface CatalogModel.deleteCatalog
  test('returns false without calling deleteOne when id invalid', async () => {
    // API: CatalogModel.deleteCatalog
    // Input: catalogId 'nope', owner ObjectId
    // Expected status code: n/a (model method), expectation is boolean false
    // Expected behavior: guard prevents deleteOne invocation
    // Expected output: false
    const owner = new mongoose.Types.ObjectId();
    const result = await model.deleteCatalog('nope', owner);

    expect(result).toBe(false);
    expect(collectionMock.deleteOne).not.toHaveBeenCalled();
  });

  // Interface CatalogModel.deleteCatalog
  test('returns boolean based on deleteOne deletedCount', async () => {
    // API: CatalogModel.deleteCatalog
    // Input: catalogId valid string, owner ObjectId
    // Expected status code: n/a (model method), expectation is true when deletedCount === 1
    // Expected behavior: delegates to deleteOne with _id and owner filter
    // Expected output: true on first invocation, false on second
    // Mock behavior: deleteOne resolves to objects with deletedCount 1 then 0
    const catalogId = new mongoose.Types.ObjectId().toString();
    const owner = new mongoose.Types.ObjectId();

    collectionMock.deleteOne
      .mockImplementationOnce(async () => ({ deletedCount: 1 }))
      .mockImplementationOnce(async () => ({ deletedCount: 0 }));

    const resultSuccess = await model.deleteCatalog(catalogId, owner);
    const resultFail = await model.deleteCatalog(catalogId, owner);

    expect(collectionMock.deleteOne).toHaveBeenCalledWith({ _id: catalogId, owner });
    expect(collectionMock.deleteOne).toHaveBeenCalledTimes(2);
    expect(resultSuccess).toBe(true);
    expect(resultFail).toBe(false);
  });

  // Interface CatalogModel.listCatalogs
  test('lists catalogs ordered by updatedAt and createdAt descending', async () => {
    // API: CatalogModel.listCatalogs
    // Input: owner ObjectId
    // Expected status code: n/a (model method), expectation is array of catalogs
    // Expected behavior: executes find -> sort -> exec chain with ordering fields
    // Expected output: mocked catalog array returned from exec
    const owner = new mongoose.Types.ObjectId();
    const execResult: any[] = [{ _id: new mongoose.Types.ObjectId() }];
    const exec = jest.fn(async () => execResult);
    const sort = jest.fn().mockReturnValue({ exec });

    collectionMock.find.mockReturnValue({ sort });

    const result = await model.listCatalogs(owner);

    expect(collectionMock.find).toHaveBeenCalledWith({ owner });
    expect(sort).toHaveBeenCalledWith({ updatedAt: -1, createdAt: -1 });
    expect(exec).toHaveBeenCalled();
    expect(result).toBe(execResult);
  });

  // Interface CatalogModel.deleteAllOwnedByUser
  test('deleteAllOwnedByUser returns deleted count fallback', async () => {
    const owner = new mongoose.Types.ObjectId();
    collectionMock.deleteMany.mockImplementationOnce(async () => ({ deletedCount: 3 }));
    collectionMock.deleteMany.mockImplementationOnce(async () => ({}));

    const first = await model.deleteAllOwnedByUser(owner);
    const second = await model.deleteAllOwnedByUser(owner);

    expect(collectionMock.deleteMany).toHaveBeenCalledWith({ owner });
    expect(first).toBe(3);
    expect(second).toBe(0);
  });
});
