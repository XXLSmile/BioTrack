import mongoose from 'mongoose';
import path from 'path';
import { afterEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../../../src/utils/pathSafe', () => ({
  __esModule: true,
  ensurePathWithinRoot: jest.fn((_root: string, filePath: string) => filePath),
  resolveWithinRoot: jest.fn(() => '/uploads/images'),
}));

jest.mock('../../../src/utils/safeFs', () => ({
  __esModule: true,
  unlinkSync: jest.fn(),
}));

jest.mock('../../../src/catalog/catalogEntryLink.model', () => ({
  catalogEntryLinkModel: {
    removeEntryFromAllCatalogs: jest.fn(),
  },
}));

jest.mock('../../../src/user/user.model', () => ({
  userModel: {
    recomputeObservationCount: jest.fn(),
  },
}));

jest.mock('../../../src/logger.util', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

import { CatalogModel, catalogRepository } from '../../../src/recognition/catalog.model';
import { catalogEntryLinkModel } from '../../../src/catalog/catalogEntryLink.model';
import { userModel } from '../../../src/user/user.model';
import logger from '../../../src/logger.util';
import * as pathSafe from '../../../src/utils/pathSafe';
import * as safeFs from '../../../src/utils/safeFs';

const catalogEntryLinkModelMock = catalogEntryLinkModel as jest.Mocked<typeof catalogEntryLinkModel>;
const userModelMock = userModel as jest.Mocked<typeof userModel>;
const loggerMock = logger as unknown as { error: jest.Mock };
const pathSafeMock = pathSafe as jest.Mocked<typeof pathSafe>;
const safeFsMock = safeFs as jest.Mocked<typeof safeFs>;

describe('Mocked: CatalogRepository core methods', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // Interface CatalogRepository.create
  test('creates catalog entry via CatalogModel', async () => {
    // API: CatalogRepository.create
    // Input: minimal payload with required fields
    // Expected status code: n/a, expectation is created document returned
    // Expected behavior: delegates to CatalogModel.create with same data
    // Expected output: mocked catalog entry
    const payload = {
      userId: new mongoose.Types.ObjectId().toString(),
      speciesId: new mongoose.Types.ObjectId().toString(),
      imageUrl: 'http://example.com/image.jpg',
      confidence: 0.9,
      imageHash: 'hash',
    };
    const created = { ...payload, _id: new mongoose.Types.ObjectId() };
    jest.spyOn(CatalogModel, 'create').mockResolvedValueOnce(created as any);

    const result = await catalogRepository.create(payload);

    expect(CatalogModel.create).toHaveBeenCalledWith(payload);
    expect(result).toBe(created);
  });

  // Interface CatalogRepository.findByHash
  test('findByHash delegates to CatalogModel.findOne', async () => {
    // API: CatalogRepository.findByHash
    // Input: userId string and imageHash string
    // Expected status code: n/a, expectation is filtered lookup
    // Expected behavior: calls CatalogModel.findOne with userId and imageHash
    // Expected output: mocked catalog entry
    const userId = new mongoose.Types.ObjectId().toString();
    const imageHash = 'hash';
    const entry = { _id: new mongoose.Types.ObjectId() };
    jest.spyOn(CatalogModel, 'findOne').mockResolvedValueOnce(entry as any);

    const result = await catalogRepository.findByHash(userId, imageHash);

    expect(CatalogModel.findOne).toHaveBeenCalledWith({ userId, imageHash });
    expect(result).toBe(entry);
  });

  // Interface CatalogRepository.findById
  test('findById returns null when id invalid', async () => {
    // API: CatalogRepository.findById
    // Input: entryId 'bad-id'
    // Expected status code: n/a, expectation is null result
    // Expected behavior: guard returns early without hitting CatalogModel.findById
    // Expected output: null
    const findSpy = jest.spyOn(CatalogModel, 'findById');

    const result = await catalogRepository.findById('bad-id');

    expect(result).toBeNull();
    expect(findSpy).not.toHaveBeenCalled();
  });

  // Interface CatalogRepository.findById
  test('findById populates species when id valid', async () => {
    // API: CatalogRepository.findById
    // Input: entryId valid ObjectId string
    // Expected status code: n/a, expectation is populated document returned
    // Expected behavior: calls CatalogModel.findById then populate with speciesId
    // Expected output: mocked populated entry
    const entryId = new mongoose.Types.ObjectId().toString();
    const populated = { _id: entryId, speciesId: {} };
    const populate = jest.fn(async () => populated);
    jest.spyOn(CatalogModel, 'findById').mockReturnValueOnce({ populate } as any);

    const result = await catalogRepository.findById(entryId);

    expect(CatalogModel.findById).toHaveBeenCalledWith(entryId);
    expect(populate).toHaveBeenCalledWith('speciesId');
    expect(result).toBe(populated);
  });

  // Interface CatalogRepository.findByUserId
  test('findByUserId sorts, limits, and populates', async () => {
    // API: CatalogRepository.findByUserId
    // Input: userId string and limit 25
    // Expected status code: n/a, expectation is query chain executed
    // Expected behavior: find -> sort -> limit -> populate('speciesId')
    // Expected output: mocked entries array
    const userId = new mongoose.Types.ObjectId().toString();
    const entries = [{ _id: new mongoose.Types.ObjectId() }];
    const populate = jest.fn(async () => entries);
    const limit = jest.fn().mockReturnValue({ populate });
    const sort = jest.fn().mockReturnValue({ limit });
    jest.spyOn(CatalogModel, 'find').mockReturnValueOnce({ sort } as any);

    const result = await catalogRepository.findByUserId(userId, 25);

    expect(CatalogModel.find).toHaveBeenCalledWith({ userId });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(limit).toHaveBeenCalledWith(25);
    expect(populate).toHaveBeenCalledWith('speciesId');
    expect(result).toBe(entries);
  });

  // Interface CatalogRepository.findByUserId
  test('findByUserId applies default limit when omitted', async () => {
    // API: CatalogRepository.findByUserId
    // Input: userId string without explicit limit
    // Expected status code: n/a, expectation is default limit of 50 used
    // Expected behavior: limit invoked with 50 when second argument missing
    // Expected output: mocked entries returned
    const userId = new mongoose.Types.ObjectId().toString();
    const entries = [{ _id: new mongoose.Types.ObjectId() }];
    const populate = jest.fn(async () => entries);
    const limit = jest.fn().mockReturnValue({ populate });
    const sort = jest.fn().mockReturnValue({ limit });
    jest.spyOn(CatalogModel, 'find').mockReturnValueOnce({ sort } as any);

    const result = await catalogRepository.findByUserId(userId);

    expect(limit).toHaveBeenCalledWith(50);
    expect(result).toBe(entries);
  });

  // Interface CatalogRepository.findRecentByUserId
  test('findRecentByUserId sorts, limits, and populates', async () => {
    // API: CatalogRepository.findRecentByUserId
    // Input: userId string and limit 5
    // Expected status code: n/a, expectation is query chain executed
    // Expected behavior: find -> sort -> limit -> populate('speciesId')
    // Expected output: mocked recent entries
    const userId = new mongoose.Types.ObjectId().toString();
    const entries = [{ _id: new mongoose.Types.ObjectId() }];
    const populate = jest.fn(async () => entries);
    const limit = jest.fn().mockReturnValue({ populate });
    const sort = jest.fn().mockReturnValue({ limit });
    jest.spyOn(CatalogModel, 'find').mockReturnValueOnce({ sort } as any);

    const result = await catalogRepository.findRecentByUserId(userId, 5);

    expect(CatalogModel.find).toHaveBeenCalledWith({ userId });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(limit).toHaveBeenCalledWith(5);
    expect(populate).toHaveBeenCalledWith('speciesId');
    expect(result).toBe(entries);
  });

  // Interface CatalogRepository.findRecentByUserId
  test('findRecentByUserId uses default limit when missing', async () => {
    // API: CatalogRepository.findRecentByUserId
    // Input: userId string without limit argument
    // Expected status code: n/a, expectation is default limit 10 used
    // Expected behavior: limit called with 10
    // Expected output: mocked entries returned
    const userId = new mongoose.Types.ObjectId().toString();
    const entries = [{ _id: new mongoose.Types.ObjectId() }];
    const populate = jest.fn(async () => entries);
    const limit = jest.fn().mockReturnValue({ populate });
    const sort = jest.fn().mockReturnValue({ limit });
    jest.spyOn(CatalogModel, 'find').mockReturnValueOnce({ sort } as any);

    const result = await catalogRepository.findRecentByUserId(userId);

    expect(limit).toHaveBeenCalledWith(10);
    expect(result).toBe(entries);
  });

  // Interface CatalogRepository.countByUserId
  test('countByUserId delegates to countDocuments', async () => {
    // API: CatalogRepository.countByUserId
    // Input: userId string
    // Expected status code: n/a, expectation is numeric count returned
    // Expected behavior: calls CatalogModel.countDocuments once
    // Expected output: number 3
    const userId = new mongoose.Types.ObjectId().toString();
    jest.spyOn(CatalogModel, 'countDocuments').mockResolvedValueOnce(3 as any);

    const result = await catalogRepository.countByUserId(userId);

    expect(CatalogModel.countDocuments).toHaveBeenCalledWith({ userId });
    expect(result).toBe(3);
  });

  // Interface CatalogRepository.countUniqueSpeciesByUserId
  test('countUniqueSpeciesByUserId returns distinct species count', async () => {
    // API: CatalogRepository.countUniqueSpeciesByUserId
    // Input: userId string
    // Expected status code: n/a, expectation is length of distinct array
    // Expected behavior: CatalogModel.distinct invoked with speciesId field
    // Expected output: number 2
    const userId = new mongoose.Types.ObjectId().toString();
    const speciesIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    jest.spyOn(CatalogModel, 'distinct').mockResolvedValueOnce(speciesIds as any);

    const result = await catalogRepository.countUniqueSpeciesByUserId(userId);

    expect(CatalogModel.distinct).toHaveBeenCalledWith('speciesId', { userId });
    expect(result).toBe(2);
  });

  // Interface CatalogRepository.deleteById
  test('returns not_found for invalid entry id', async () => {
    // API: CatalogRepository.deleteById
    // Input: entryId 'invalid-entry', userId valid ObjectId string
    // Expected status code: n/a (repository method), expectation is short-circuit with not_found
    // Expected behavior: CatalogModel.findById not invoked because entry id fails validation
    // Expected output: string 'not_found'
    const userId = new mongoose.Types.ObjectId().toString();
    const findSpy = jest.spyOn(CatalogModel, 'findById');

    const result = await catalogRepository.deleteById('invalid-entry', userId);

    expect(result).toBe('not_found');
    expect(findSpy).not.toHaveBeenCalled();
  });

  // Interface CatalogRepository.deleteById
  test('returns not_found for invalid user id', async () => {
    // API: CatalogRepository.deleteById
    // Input: entryId valid ObjectId, userId 'bad-user'
    // Expected status code: n/a (repository method), expectation is not_found due to invalid userId
    // Expected behavior: CatalogModel.findById skipped
    // Expected output: string 'not_found'
    const entryId = new mongoose.Types.ObjectId().toString();
    const findSpy = jest.spyOn(CatalogModel, 'findById');

    const result = await catalogRepository.deleteById(entryId, 'bad-user');

    expect(result).toBe('not_found');
    expect(findSpy).not.toHaveBeenCalled();
  });

  // Interface CatalogRepository.deleteById
  test('returns not_found when entry missing', async () => {
    // API: CatalogRepository.deleteById
    // Input: entryId valid object id, userId valid object id, but db lookup returns null
    // Expected status code: n/a, expectation is not_found
    // Expected behavior: CatalogModel.findById invoked once and resolves null
    // Expected output: string 'not_found'
    const entryId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId().toString();
    jest.spyOn(CatalogModel, 'findById').mockResolvedValueOnce(null);

    const result = await catalogRepository.deleteById(entryId, userId);

    expect(result).toBe('not_found');
    expect(CatalogModel.findById).toHaveBeenCalledWith(entryId);
  });

  // Interface CatalogRepository.deleteById
  test('returns forbidden when entry owned by different user', async () => {
    // API: CatalogRepository.deleteById
    // Input: entryId valid, userId valid but not owner, entry.userId stored as string
    // Expected status code: n/a, expectation is forbidden
    // Expected behavior: method detects non-matching owner and exits before deletion
    // Expected output: string 'forbidden'
    const entryId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId().toString();
    const entry = {
      _id: entryId,
      userId: ownerId.toString(),
    };

    jest.spyOn(CatalogModel, 'findById').mockResolvedValueOnce(entry as any);

    const result = await catalogRepository.deleteById(entryId.toString(), otherUserId);

    expect(result).toBe('forbidden');
    expect(catalogEntryLinkModelMock.removeEntryFromAllCatalogs).not.toHaveBeenCalled();
  });

  // Interface CatalogRepository.deleteById
  test('deletes entry, removes links, and unlinks file when owner matches', async () => {
    // API: CatalogRepository.deleteById
    // Input: entryId owned by userId, entry has imageUrl whose file exists
    // Expected status code: n/a, expectation is successful deletion
    // Expected behavior: removes catalog links, deletes image, recomputes observation count
    // Expected output: string 'deleted'
    const ownerId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    const deleteOne = jest.fn(async () => undefined);
    const entry = {
      _id: entryId,
      userId: ownerId,
      imageUrl: 'http://example.com/uploads/images/bird.jpg',
      deleteOne,
    };

    jest.spyOn(CatalogModel, 'findById').mockResolvedValueOnce(entry as any);
    catalogEntryLinkModelMock.removeEntryFromAllCatalogs.mockResolvedValueOnce(undefined);
    safeFsMock.unlinkSync.mockClear();
    pathSafeMock.ensurePathWithinRoot.mockClear();

    const result = await catalogRepository.deleteById(entryId.toString(), ownerId.toString());

    expect(result).toBe('deleted');
    expect(catalogEntryLinkModelMock.removeEntryFromAllCatalogs).toHaveBeenCalledWith(entryId);
    expect(deleteOne).toHaveBeenCalledTimes(1);
    expect(userModelMock.recomputeObservationCount).toHaveBeenCalledWith(ownerId);
    expect(pathSafeMock.ensurePathWithinRoot).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining(path.basename(entry.imageUrl))
    );
    expect(safeFsMock.unlinkSync).toHaveBeenCalledWith(expect.stringContaining(path.basename(entry.imageUrl)));
  });

  // Interface CatalogRepository.deleteById
  test('skips unlink when file missing but still deletes entry', async () => {
    // API: CatalogRepository.deleteById
    // Input: entryId owned by userId, image file absent on disk
    // Expected status code: n/a, expectation is deletion succeeds without fs.unlinkSync
    // Expected behavior: existsSync false prevents unlinkSync invocation
    // Expected output: string 'deleted'
    const ownerId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    const deleteOne = jest.fn(async () => undefined);
    const entry = {
      _id: entryId,
      userId: ownerId,
      imageUrl: 'http://example.com/uploads/images/missing.jpg',
      deleteOne,
    };

    jest.spyOn(CatalogModel, 'findById').mockResolvedValueOnce(entry as any);
    catalogEntryLinkModelMock.removeEntryFromAllCatalogs.mockResolvedValueOnce(undefined);
    safeFsMock.unlinkSync.mockImplementationOnce(() => {
      const err = new Error('not found') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });

    const result = await catalogRepository.deleteById(entryId.toString(), ownerId.toString());

    expect(result).toBe('deleted');
    expect(safeFsMock.unlinkSync).toHaveBeenCalledTimes(1);
  });

  // Interface CatalogRepository.deleteById
  test('rethrows when unlink fails with unexpected error', async () => {
    // API: CatalogRepository.deleteById
    // Input: entryId owned by userId where unlinkSync throws EPERM
    // Expected status code: n/a, expectation is error propagates after logger call
    // Expected behavior: logger.error invoked with context before rejection
    // Expected output: promise rejects with original error
    const ownerId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    const deleteOne = jest.fn();
    const entry = {
      _id: entryId,
      userId: ownerId,
      imageUrl: 'http://example.com/uploads/images/protected.jpg',
      deleteOne,
    };
    const fsError = Object.assign(new Error('permission denied'), { code: 'EPERM' });

    jest.spyOn(CatalogModel, 'findById').mockResolvedValueOnce(entry as any);
    catalogEntryLinkModelMock.removeEntryFromAllCatalogs.mockResolvedValueOnce(undefined);
    safeFsMock.unlinkSync.mockImplementationOnce(() => {
      throw fsError;
    });

    await expect(
      catalogRepository.deleteById(entryId.toString(), ownerId.toString())
    ).rejects.toThrow('permission denied');

    expect(loggerMock.error).toHaveBeenCalledWith('Failed to delete catalog entry', {
      entryId: entryId.toString(),
      error: fsError,
    });
    expect(deleteOne).not.toHaveBeenCalled();
  });

  // Interface CatalogRepository.deleteById
  test('logs and rethrows when removing links fails', async () => {
    // API: CatalogRepository.deleteById
    // Input: entryId owned by userId, removeEntryFromAllCatalogs rejects
    // Expected status code: n/a, expectation is method propagates error
    // Expected behavior: logger.error invoked with context before error rethrow
    // Expected output: promise rejects with original error
    const ownerId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId();
    const deleteOne = jest.fn();
    const entry = {
      _id: entryId,
      userId: ownerId,
      imageUrl: 'http://example.com/uploads/images/failure.jpg',
      deleteOne,
    };
    const failure = new Error('link removal failed');

    jest.spyOn(CatalogModel, 'findById').mockResolvedValueOnce(entry as any);
    catalogEntryLinkModelMock.removeEntryFromAllCatalogs.mockRejectedValueOnce(failure);
    safeFsMock.unlinkSync.mockReset();

    await expect(
      catalogRepository.deleteById(entryId.toString(), ownerId.toString())
    ).rejects.toThrow(failure);

    expect(loggerMock.error).toHaveBeenCalledWith('Failed to delete catalog entry', {
      entryId: entryId.toString(),
      error: failure,
    });
    expect(deleteOne).not.toHaveBeenCalled();
    expect(userModelMock.recomputeObservationCount).not.toHaveBeenCalled();
  });
});
