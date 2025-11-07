// @ts-nocheck
import mongoose from 'mongoose';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../../../src/logger.util', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

import logger from '../../../src/logger.util';
import { CatalogEntryLinkModel } from '../../../src/catalog/catalogEntryLink.model';

const getLoggerError = () => (logger.error as jest.Mock);

describe('Mocked: CatalogEntryLinkModel', () => {
  let model: CatalogEntryLinkModel;
  let linkMock: {
    create: jest.Mock;
    deleteOne: jest.Mock;
    deleteMany: jest.Mock;
    exists: jest.Mock;
    find: jest.Mock;
    distinct: jest.Mock;
  };

  beforeEach(() => {
    model = new CatalogEntryLinkModel();
    linkMock = {
      create: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
      exists: jest.fn(),
      find: jest.fn(),
      distinct: jest.fn(),
    };
    (model as any).link = linkMock;
    getLoggerError().mockReset();
  });

  // API: CatalogEntryLinkModel.linkEntry
  // Input: catalogId, entryId, addedBy ObjectIds
  // Expected behavior: forwards to mongoose create
  // Expected output: created link document
  test('linkEntry persists link via mongoose model', async () => {
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    const addedBy = new mongoose.Types.ObjectId();
    const linkDoc = { _id: new mongoose.Types.ObjectId(), catalog: catalogId, entry: entryId };
    linkMock.create.mockResolvedValueOnce(linkDoc);

    const result = await model.linkEntry(catalogId, entryId, addedBy);

    expect(linkMock.create).toHaveBeenCalledWith({
      catalog: catalogId,
      entry: entryId,
      addedBy,
    });
    expect(result).toBe(linkDoc);
  });

  // API: CatalogEntryLinkModel.linkEntry
  // Input: create throws
  // Expected behavior: logs error and rethrows friendly message
  // Expected output: rejected promise with descriptive Error
  test('linkEntry logs and rethrows when persistence fails', async () => {
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    const addedBy = new mongoose.Types.ObjectId();
    const error = new Error('duplicate');
    linkMock.create.mockRejectedValueOnce(error);

    await expect(model.linkEntry(catalogId, entryId, addedBy)).rejects.toThrow(
      'Failed to add entry to catalog'
    );
    expect(getLoggerError()).toHaveBeenCalledWith('Failed to link entry to catalog:', error);
  });

  // API: CatalogEntryLinkModel.unlinkEntry
  // Input: catalogId and entryId
  // Expected behavior: issues deleteOne
  // Expected output: resolved promise without throwing
  test('unlinkEntry removes catalog link', async () => {
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    linkMock.deleteOne.mockResolvedValueOnce(undefined);

    await model.unlinkEntry(catalogId, entryId);

    expect(linkMock.deleteOne).toHaveBeenCalledWith({ catalog: catalogId, entry: entryId });
  });

  // API: CatalogEntryLinkModel.unlinkEntry
  // Input: deleteOne throws
  // Expected behavior: logs error and rethrows friendly message
  // Expected output: rejected Error("Failed to remove entry from catalog")
  test('unlinkEntry logs and rethrows on delete failure', async () => {
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    const error = new Error('db down');
    linkMock.deleteOne.mockRejectedValueOnce(error);

    await expect(model.unlinkEntry(catalogId, entryId)).rejects.toThrow(
      'Failed to remove entry from catalog'
    );
    expect(getLoggerError()).toHaveBeenCalledWith('Failed to unlink entry from catalog:', error);
  });

  // API: CatalogEntryLinkModel.removeEntryFromAllCatalogs
  // Input: entryId
  // Expected behavior: deleteMany invoked
  // Expected output: resolved promise
  test('removeEntryFromAllCatalogs deletes all occurrences', async () => {
    const entryId = new mongoose.Types.ObjectId();
    await model.removeEntryFromAllCatalogs(entryId);

    expect(linkMock.deleteMany).toHaveBeenCalledWith({ entry: entryId });
  });

  // API: CatalogEntryLinkModel.removeEntryFromAllCatalogs
  // Input: deleteMany throws
  // Expected behavior: logs error and rethrows
  // Expected output: Error("Failed to remove entry from catalogs")
  test('removeEntryFromAllCatalogs logs errors from deleteMany', async () => {
    const entryId = new mongoose.Types.ObjectId();
    const error = new Error('network');
    linkMock.deleteMany.mockRejectedValueOnce(error);

    await expect(model.removeEntryFromAllCatalogs(entryId)).rejects.toThrow(
      'Failed to remove entry from catalogs'
    );
    expect(getLoggerError()).toHaveBeenCalledWith('Failed to remove entry from catalogs:', error);
  });

  // API: CatalogEntryLinkModel.isEntryLinked
  // Input: exists returns truthy/falsy
  // Expected behavior: booleanized result
  // Expected output: true when exists returns object, false when null
  test('isEntryLinked coerces result from exists', async () => {
    const catalogId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    linkMock.exists
      .mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId() })
      .mockResolvedValueOnce(null);

    await expect(model.isEntryLinked(catalogId, entryId)).resolves.toBe(true);
    await expect(model.isEntryLinked(catalogId, entryId)).resolves.toBe(false);
  });

  // API: CatalogEntryLinkModel.listEntriesWithDetails
  // Input: catalogId
  // Expected behavior: chains populate calls for entry/species and addedBy
  // Expected output: populated array from final populate
  test('listEntriesWithDetails populates entry species and addedBy fields', async () => {
    const catalogId = new mongoose.Types.ObjectId();
    const populated = [{ _id: new mongoose.Types.ObjectId() }];
    const secondPopulate = jest.fn().mockResolvedValue(populated);
    const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });
    linkMock.find.mockReturnValue({ populate: firstPopulate });

    const result = await model.listEntriesWithDetails(catalogId);

    expect(linkMock.find).toHaveBeenCalledWith({ catalog: catalogId });
    expect(firstPopulate).toHaveBeenCalledWith({
      path: 'entry',
      populate: { path: 'speciesId' },
    });
    expect(secondPopulate).toHaveBeenCalledWith('addedBy', 'name username profilePicture');
    expect(result).toBe(populated);
  });

  // API: CatalogEntryLinkModel.listCatalogIdsForEntry
  // Input: mixed array from distinct
  // Expected behavior: converts string ids to ObjectIds and filters invalid entries
  // Expected output: array of ObjectIds only
  test('listCatalogIdsForEntry normalizes distinct values', async () => {
    const objectId = new mongoose.Types.ObjectId();
    linkMock.distinct.mockResolvedValueOnce([objectId, objectId.toString(), 123]);

    const result = await model.listCatalogIdsForEntry(new mongoose.Types.ObjectId());

    expect(result).toHaveLength(2);
    expect(result.every(id => id instanceof mongoose.Types.ObjectId)).toBe(true);
  });
});
