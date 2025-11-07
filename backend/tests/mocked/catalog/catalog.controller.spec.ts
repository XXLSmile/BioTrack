// @ts-nocheck
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import mongoose from 'mongoose';

jest.mock('../../../src/logger.util', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/catalog/catalog.model', () => ({
  catalogModel: {
    createCatalog: jest.fn(),
    listCatalogs: jest.fn(),
    findById: jest.fn(),
    updateCatalog: jest.fn(),
    deleteCatalog: jest.fn(),
  },
}));

jest.mock('../../../src/catalog/catalogShare.model', () => ({
  catalogShareModel: {
    getUserAccess: jest.fn(),
  },
}));

jest.mock('../../../src/catalog/catalogEntryLink.model', () => ({
  catalogEntryLinkModel: {
    listEntriesWithDetails: jest.fn(),
    isEntryLinked: jest.fn(),
    linkEntry: jest.fn(),
    unlinkEntry: jest.fn(),
  },
}));

jest.mock('../../../src/recognition/catalog.model', () => ({
  catalogRepository: {
    findById: jest.fn(),
  },
}));

jest.mock('../../../src/catalog/catalog.helpers', () => ({
  buildCatalogEntriesResponse: jest.fn(),
}));

jest.mock('../../../src/socket/socket.manager', () => ({
  emitCatalogDeleted: jest.fn(),
  emitCatalogEntriesUpdated: jest.fn(),
  emitCatalogMetadataUpdated: jest.fn(),
}));

import { CatalogController } from '../../../src/catalog/catalog.controller';
import { catalogModel } from '../../../src/catalog/catalog.model';
import { catalogShareModel } from '../../../src/catalog/catalogShare.model';
import { catalogEntryLinkModel } from '../../../src/catalog/catalogEntryLink.model';
import { catalogRepository } from '../../../src/recognition/catalog.model';
import { buildCatalogEntriesResponse } from '../../../src/catalog/catalog.helpers';
import {
  emitCatalogDeleted,
  emitCatalogEntriesUpdated,
  emitCatalogMetadataUpdated,
} from '../../../src/socket/socket.manager';

type MockResponse = ReturnType<typeof createMockResponse>;

const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const getJsonPayload = (res: MockResponse) => (res.json as jest.Mock).mock.calls[0]?.[0];

const catalogModelMock = catalogModel as unknown as Record<string, jest.Mock>;
const catalogShareModelMock = catalogShareModel as unknown as Record<string, jest.Mock>;
const catalogEntryLinkModelMock = catalogEntryLinkModel as unknown as Record<string, jest.Mock>;
const catalogRepositoryMock = catalogRepository as unknown as Record<string, jest.Mock>;
const buildCatalogEntriesResponseMock = buildCatalogEntriesResponse as jest.Mock;

describe('Mocked: CatalogController', () => {
  let controller: CatalogController;

  beforeEach(() => {
    controller = new CatalogController();
    jest.clearAllMocks();
  });

  // API: POST /api/catalogs (CatalogController.createCatalog)
  // Input: owner id and payload { name, description }
  // Expected status code: 201
  // Expected behavior: delegates to catalogModel.createCatalog and returns created doc
  // Expected output: JSON payload containing catalog
  test('createCatalog persists catalog for authenticated owner', async () => {
    const userId = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner: userId, name: 'Birds' };
    catalogModelMock.createCatalog.mockResolvedValueOnce(catalog);
    const req: any = { user: { _id: userId }, body: { name: 'Birds', description: 'notes' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.createCatalog(req, res, next);

    expect(catalogModelMock.createCatalog).toHaveBeenCalledWith(userId, req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(getJsonPayload(res)?.data?.catalog).toBe(catalog);
    expect(next).not.toHaveBeenCalled();
  });

  // API: POST /api/catalogs (CatalogController.createCatalog)
  // Input: invalid payload triggering mongoose validation error
  // Expected status code: 400
  // Expected behavior: controller catches ValidationError and returns 400
  // Expected output: JSON error message "Invalid catalog data"
  test('createCatalog maps mongoose validation errors to 400', async () => {
    const error = new mongoose.Error.ValidationError(undefined as any);
    catalogModelMock.createCatalog.mockRejectedValueOnce(error);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, body: { name: '' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.createCatalog(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(getJsonPayload(res)?.message).toBe('Invalid catalog data');
    expect(next).not.toHaveBeenCalled();
  });

  // API: POST /api/catalogs (CatalogController.createCatalog)
  // Input: payload that violates unique index (error.code 11000)
  // Expected status code: 409
  // Expected behavior: controller returns conflict response without calling next
  // Expected output: JSON message about catalog existing
  test('createCatalog returns 409 when duplicate key error occurs', async () => {
    catalogModelMock.createCatalog.mockRejectedValueOnce({ code: 11000 });
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, body: { name: 'Dup' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.createCatalog(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(getJsonPayload(res)?.message).toBe('Catalog with the same name already exists');
  });

  // API: POST /api/catalogs (CatalogController.createCatalog)
  // Input: model throws unexpected error
  // Expected behavior: controller forwards to next
  // Expected output: next called with error
  test('createCatalog forwards unexpected errors to next handler', async () => {
    const error = new Error('boom');
    catalogModelMock.createCatalog.mockRejectedValueOnce(error);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, body: { name: 'Oops' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.createCatalog(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // API: GET /api/catalogs (CatalogController.listCatalogs)
  // Input: authenticated user
  // Expected status code: 200
  // Expected behavior: returns catalogs associated with owner
  // Expected output: JSON payload with catalogs array
  test('listCatalogs returns catalogs for authenticated user', async () => {
    const catalogs = [{ _id: new mongoose.Types.ObjectId() }];
    catalogModelMock.listCatalogs.mockResolvedValueOnce(catalogs);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.listCatalogs(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(getJsonPayload(res)?.data?.catalogs).toBe(catalogs);
  });

  // API: GET /api/catalogs (CatalogController.listCatalogs)
  // Input: model throws
  // Expected behavior: controller logs and forwards error
  // Expected output: next called with error
  test('listCatalogs forwards errors to next', async () => {
    const error = new Error('db down');
    catalogModelMock.listCatalogs.mockRejectedValueOnce(error);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.listCatalogs(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // API: GET /api/catalogs/:catalogId (CatalogController.getCatalogById)
  // Input: catalog id not found
  // Expected status code: 404
  // Expected behavior: returns not found message
  // Expected output: JSON { message: 'Catalog not found' }
  test('getCatalogById returns 404 when catalog missing', async () => {
    catalogModelMock.findById.mockResolvedValueOnce(null);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'abc' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.getCatalogById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(getJsonPayload(res)?.message).toBe('Catalog not found');
  });

  // API: GET /api/catalogs/:catalogId (CatalogController.getCatalogById)
  // Input: user without ownership or share access
  // Expected status code: 403
  // Expected behavior: denies access when catalogShareModel returns null
  // Expected output: JSON access denied message
  test('getCatalogById rejects users without share access', async () => {
    const owner = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({
      _id: new mongoose.Types.ObjectId(),
      owner,
    });
    catalogShareModelMock.getUserAccess.mockResolvedValueOnce(null);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'abc' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.getCatalogById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(getJsonPayload(res)?.message).toBe('You do not have access to this catalog');
  });

  // API: GET /api/catalogs/:catalogId (CatalogController.getCatalogById)
  // Input: share record without role property
  // Expected status code: 200
  // Expected behavior: skip entries when share has no role value
  // Expected output: entries array empty
  test('getCatalogById omits entries when share lacks role', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner };
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogShareModelMock.getUserAccess.mockResolvedValueOnce({ role: undefined });
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'abc' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.getCatalogById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(getJsonPayload(res)?.data?.entries).toEqual([]);
  });

  // API: GET /api/catalogs/:catalogId (CatalogController.getCatalogById)
  // Input: owner requesting catalog
  // Expected status code: 200
  // Expected behavior: loads entries and builds response
  // Expected output: entries array from helper
  test('getCatalogById returns entries for owner', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner };
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogEntryLinkModelMock.listEntriesWithDetails.mockResolvedValueOnce([{ id: 1 }]);
    buildCatalogEntriesResponseMock.mockReturnValueOnce([{ entry: { id: 1 } }]);
    const req: any = { user: { _id: owner }, params: { catalogId: 'abc' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.getCatalogById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(getJsonPayload(res)?.data?.entries).toEqual([{ entry: { id: 1 } }]);
  });

  // API: GET /api/catalogs/:catalogId (CatalogController.getCatalogById)
  // Input: editor share access
  // Expected status code: 200
  // Expected behavior: loads entries after validating share
  // Expected output: entries from helper
  test('getCatalogById allows access for accepted editor share', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner };
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogShareModelMock.getUserAccess.mockResolvedValueOnce({ role: 'editor' });
    catalogEntryLinkModelMock.listEntriesWithDetails.mockResolvedValueOnce([{ id: 1 }]);
    buildCatalogEntriesResponseMock.mockReturnValueOnce([{ entry: { id: 1 } }]);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'abc' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.getCatalogById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(getJsonPayload(res)?.data?.entries?.length).toBe(1);
  });

  // API: GET /api/catalogs/:catalogId (CatalogController.getCatalogById)
  // Input: model throws
  // Expected behavior: controller forwards error
  // Expected output: next called with error
  test('getCatalogById forwards unexpected errors', async () => {
    const error = new Error('lookup fail');
    catalogModelMock.findById.mockRejectedValueOnce(error);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'abc' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.getCatalogById(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // API: PUT /api/catalogs/:catalogId (CatalogController.updateCatalog)
  // Input: missing catalog
  // Expected status code: 404
  // Expected behavior: returns not found
  // Expected output: JSON message
  test('updateCatalog returns 404 when catalog not found', async () => {
    catalogModelMock.findById.mockResolvedValueOnce(null);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'abc' }, body: {} };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.updateCatalog(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: PUT /api/catalogs/:catalogId (CatalogController.updateCatalog)
  // Input: user not owner
  // Expected status code: 403
  // Expected behavior: prohibits update
  // Expected output: JSON error message
  test('updateCatalog enforces ownership', async () => {
    catalogModelMock.findById.mockResolvedValueOnce({
      _id: new mongoose.Types.ObjectId(),
      owner: new mongoose.Types.ObjectId(),
    });
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'abc' }, body: {} };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.updateCatalog(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // API: PUT /api/catalogs/:catalogId (CatalogController.updateCatalog)
  // Input: update returns null indicating missing catalog
  // Expected status code: 404
  // Expected behavior: responds not found
  // Expected output: JSON message
  test('updateCatalog returns 404 when update returns null', async () => {
    const owner = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ owner });
    catalogModelMock.updateCatalog.mockResolvedValueOnce(null);
    const req: any = { user: { _id: owner }, params: { catalogId: 'abc' }, body: { name: 'x' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.updateCatalog(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: PUT /api/catalogs/:catalogId (CatalogController.updateCatalog)
  // Input: duplicate key error (code 11000)
  // Expected status code: 409
  // Expected behavior: returns conflict
  // Expected output: JSON message
  test('updateCatalog maps duplicate key errors to 409', async () => {
    const owner = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ owner });
    catalogModelMock.updateCatalog.mockRejectedValueOnce({ code: 11000 });
    const req: any = { user: { _id: owner }, params: { catalogId: 'abc' }, body: { name: 'dup' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.updateCatalog(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  // API: PUT /api/catalogs/:catalogId (CatalogController.updateCatalog)
  // Input: successful update
  // Expected status code: 200
  // Expected behavior: returns updated catalog and emits socket event
  // Expected output: JSON payload with catalog
  test('updateCatalog updates metadata and emits socket event', async () => {
    const owner = new mongoose.Types.ObjectId();
    const updated = { _id: new mongoose.Types.ObjectId(), owner, name: 'Updated' };
    catalogModelMock.findById.mockResolvedValueOnce({ owner });
    catalogModelMock.updateCatalog.mockResolvedValueOnce(updated);
    const req: any = { user: { _id: owner }, params: { catalogId: 'abc' }, body: { name: 'Updated' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.updateCatalog(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(getJsonPayload(res)?.data?.catalog).toBe(updated);
    expect(emitCatalogMetadataUpdated).toHaveBeenCalledWith(updated, owner);
  });

  // API: PUT /api/catalogs/:catalogId (CatalogController.updateCatalog)
  // Input: unexpected error from updateCatalog
  // Expected behavior: forwards to next
  // Expected output: next called
  test('updateCatalog forwards unexpected errors', async () => {
    const owner = new mongoose.Types.ObjectId();
    const error = new Error('fail');
    catalogModelMock.findById.mockResolvedValueOnce({ owner });
    catalogModelMock.updateCatalog.mockRejectedValueOnce(error);
    const req: any = { user: { _id: owner }, params: { catalogId: 'abc' }, body: {} };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.updateCatalog(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // API: DELETE /api/catalogs/:catalogId (CatalogController.deleteCatalog)
  // Input: missing catalog
  // Expected status code: 404
  // Expected behavior: returns not found
  test('deleteCatalog returns 404 when catalog missing', async () => {
    catalogModelMock.findById.mockResolvedValueOnce(null);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'abc' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.deleteCatalog(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: DELETE /api/catalogs/:catalogId (CatalogController.deleteCatalog)
  // Input: non-owner
  // Expected status code: 403
  // Expected behavior: denies deletion
  test('deleteCatalog enforces ownership guard', async () => {
    catalogModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), owner: new mongoose.Types.ObjectId() });
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'abc' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.deleteCatalog(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // API: DELETE /api/catalogs/:catalogId (CatalogController.deleteCatalog)
  // Input: deleteCatalog returns false
  // Expected status code: 404
  // Expected behavior: indicates record not found
  test('deleteCatalog returns 404 when delete operation affects no documents', async () => {
    const owner = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ owner });
    catalogModelMock.deleteCatalog.mockResolvedValueOnce(false);
    const req: any = { user: { _id: owner }, params: { catalogId: 'abc' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.deleteCatalog(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: DELETE /api/catalogs/:catalogId (CatalogController.deleteCatalog)
  // Input: successful deletion
  // Expected status code: 200
  // Expected behavior: emits socket event after responding
  test('deleteCatalog deletes record and emits socket event', async () => {
    const owner = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ owner });
    catalogModelMock.deleteCatalog.mockResolvedValueOnce(true);
    const req: any = { user: { _id: owner }, params: { catalogId: 'abc' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.deleteCatalog(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(emitCatalogDeleted).toHaveBeenCalledWith('abc', owner);
  });

  // API: DELETE /api/catalogs/:catalogId (CatalogController.deleteCatalog)
  // Input: deleteCatalog throws
  // Expected behavior: forwards error
  test('deleteCatalog forwards unexpected errors', async () => {
    const owner = new mongoose.Types.ObjectId();
    const error = new Error('db');
    catalogModelMock.findById.mockResolvedValueOnce({ owner });
    catalogModelMock.deleteCatalog.mockRejectedValueOnce(error);
    const req: any = { user: { _id: owner }, params: { catalogId: 'abc' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.deleteCatalog(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // API: POST /api/catalogs/:catalogId/entries/:entryId (CatalogController.linkCatalogEntry)
  // Input: missing catalog
  // Expected status code: 404
  test('linkCatalogEntry returns 404 when catalog missing', async () => {
    catalogModelMock.findById.mockResolvedValueOnce(null);
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { catalogId: 'c', entryId: new mongoose.Types.ObjectId().toString() },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.linkCatalogEntry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: POST /api/catalogs/:catalogId/entries/:entryId (CatalogController.linkCatalogEntry)
  // Input: viewer share lacking edit rights
  // Expected status code: 403
  test('linkCatalogEntry enforces editor role for shared collaborators', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner };
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogShareModelMock.getUserAccess.mockResolvedValueOnce({ role: 'viewer' });
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { catalogId: 'c', entryId: new mongoose.Types.ObjectId().toString() },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.linkCatalogEntry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // API: POST /api/catalogs/:catalogId/entries/:entryId (CatalogController.linkCatalogEntry)
  // Input: entry not found
  // Expected status code: 404
  test('linkCatalogEntry returns 404 when entry missing', async () => {
    const owner = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), owner });
    catalogShareModelMock.getUserAccess.mockResolvedValueOnce({ role: 'editor' });
    catalogRepositoryMock.findById.mockResolvedValueOnce(null);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'c', entryId: 'e' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.linkCatalogEntry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(getJsonPayload(res)?.message).toBe('Observation entry not found');
  });

  // API: POST /api/catalogs/:catalogId/entries/:entryId (CatalogController.linkCatalogEntry)
  // Input: entry owned by different user
  // Expected status code: 403
  test('linkCatalogEntry restricts linking to entries owned by caller', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner };
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogShareModelMock.getUserAccess.mockResolvedValueOnce({ role: 'editor' });
    catalogRepositoryMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), userId: owner });
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'c', entryId: 'e' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.linkCatalogEntry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(getJsonPayload(res)?.message).toBe('You can only link entries that you created');
  });

  // API: POST /api/catalogs/:catalogId/entries/:entryId (CatalogController.linkCatalogEntry)
  // Input: entry already linked
  // Expected status code: 409
  test('linkCatalogEntry detects already linked entries', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner };
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogShareModelMock.getUserAccess.mockResolvedValueOnce({ role: 'editor' });
    catalogRepositoryMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), userId: owner });
    catalogEntryLinkModelMock.isEntryLinked.mockResolvedValueOnce(true);
    const req: any = { user: { _id: owner }, params: { catalogId: 'c', entryId: 'e' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.linkCatalogEntry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  // API: POST /api/catalogs/:catalogId/entries/:entryId (CatalogController.linkCatalogEntry)
  // Input: valid owner linking entry
  // Expected status code: 200
  // Expected behavior: links entry, rebuilds entries, emits socket update
  // Expected output: entries response and emit invocation
  test('linkCatalogEntry links entry and emits update event', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner };
    const entry = { _id: new mongoose.Types.ObjectId(), userId: owner };
    const entries = [{ entry: { id: 1 } }];
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogRepositoryMock.findById.mockResolvedValueOnce(entry);
    catalogEntryLinkModelMock.isEntryLinked.mockResolvedValueOnce(false);
    catalogEntryLinkModelMock.listEntriesWithDetails.mockResolvedValueOnce(entries);
    buildCatalogEntriesResponseMock.mockReturnValueOnce(entries);
    const req: any = { user: { _id: owner }, params: { catalogId: 'c', entryId: 'e' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.linkCatalogEntry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(emitCatalogEntriesUpdated).toHaveBeenCalledWith(catalog._id, entries, owner);
  });

  // API: POST /api/catalogs/:catalogId/entries/:entryId (CatalogController.linkCatalogEntry)
  // Input: unexpected error while linking
  // Expected behavior: forwards to next
  test('linkCatalogEntry forwards unexpected errors', async () => {
    const owner = new mongoose.Types.ObjectId();
    const error = new Error('link fail');
    catalogModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), owner });
    catalogRepositoryMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), userId: owner });
    catalogEntryLinkModelMock.isEntryLinked.mockResolvedValueOnce(false);
    catalogEntryLinkModelMock.linkEntry.mockRejectedValueOnce(error);
    const req: any = { user: { _id: owner }, params: { catalogId: 'c', entryId: 'e' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.linkCatalogEntry(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // API: DELETE /api/catalogs/:catalogId/entries/:entryId (CatalogController.unlinkCatalogEntry)
  // Input: missing catalog
  // Expected status code: 404
  test('unlinkCatalogEntry returns 404 when catalog missing', async () => {
    catalogModelMock.findById.mockResolvedValueOnce(null);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'c', entryId: 'e' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.unlinkCatalogEntry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: DELETE /api/catalogs/:catalogId/entries/:entryId (CatalogController.unlinkCatalogEntry)
  // Input: user with viewer role
  // Expected status code: 403
  test('unlinkCatalogEntry requires edit permissions', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner };
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogShareModelMock.getUserAccess.mockResolvedValueOnce({ role: 'viewer' });
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'c', entryId: 'e' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.unlinkCatalogEntry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // API: DELETE /api/catalogs/:catalogId/entries/:entryId (CatalogController.unlinkCatalogEntry)
  // Input: valid owner removing entry
  // Expected status code: 200
  // Expected behavior: unlinks entry, rebuilds entries, emits update
  test('unlinkCatalogEntry unlinks entry and emits notification', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner };
    const entries = [{ entry: { id: 1 } }];
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogEntryLinkModelMock.listEntriesWithDetails.mockResolvedValueOnce(entries);
    buildCatalogEntriesResponseMock.mockReturnValueOnce(entries);
    const req: any = { user: { _id: owner }, params: { catalogId: 'c', entryId: new mongoose.Types.ObjectId().toString() } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.unlinkCatalogEntry(req, res, next);

    expect(catalogEntryLinkModelMock.unlinkEntry).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(emitCatalogEntriesUpdated).toHaveBeenCalledWith(catalog._id, entries, owner);
  });

  // API: DELETE /api/catalogs/:catalogId/entries/:entryId (CatalogController.unlinkCatalogEntry)
  // Input: unlink operation throws
  // Expected behavior: forwards to next
  test('unlinkCatalogEntry forwards unexpected errors', async () => {
    const owner = new mongoose.Types.ObjectId();
    const error = new Error('unlink fail');
    catalogModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), owner });
    catalogEntryLinkModelMock.unlinkEntry.mockRejectedValueOnce(error);
    const req: any = { user: { _id: owner }, params: { catalogId: 'c', entryId: 'e' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.unlinkCatalogEntry(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
