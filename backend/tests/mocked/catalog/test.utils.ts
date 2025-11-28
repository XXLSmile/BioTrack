// @ts-nocheck
import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../../../src/core/app';
import { catalogModel } from '../../../src/models/catalog/catalog.model';
import { catalogShareModel } from '../../../src/models/catalog/catalogShare.model';
import { catalogEntryLinkModel } from '../../../src/models/catalog/catalogEntryLink.model';
import { catalogRepository } from '../../../src/models/recognition/catalog.model';
import { buildCatalogEntriesResponse } from '../../../src/helpers/catalog.helpers';
import {
  emitCatalogDeleted,
  emitCatalogEntriesUpdated,
  emitCatalogMetadataUpdated,
} from '../../../src/infrastructure/socket.manager';

export const app = createApp();
export const api = request(app);

// Mock external dependencies
jest.mock('../../../src/utils/logger.util', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/models/catalog/catalog.model', () => {
  const actual = jest.requireActual('../../../src/models/catalog/catalog.model');
  return {
    ...actual,
    catalogModel: {
      createCatalog: jest.fn(),
      listCatalogs: jest.fn(),
      findById: jest.fn(),
      updateCatalog: jest.fn(),
      deleteCatalog: jest.fn(),
    },
  };
});

jest.mock('../../../src/models/catalog/catalogShare.model', () => ({
  catalogShareModel: {
    getUserAccess: jest.fn(),
  },
}));

jest.mock('../../../src/models/catalog/catalogEntryLink.model', () => ({
  catalogEntryLinkModel: {
    listEntriesWithDetails: jest.fn(),
    isEntryLinked: jest.fn(),
    linkEntry: jest.fn(),
    unlinkEntry: jest.fn(),
  },
}));

jest.mock('../../../src/models/recognition/catalog.model', () => ({
  catalogRepository: {
    findById: jest.fn(),
  },
}));

jest.mock('../../../src/helpers/catalog.helpers', () => ({
  buildCatalogEntriesResponse: jest.fn(),
}));

jest.mock('../../../src/infrastructure/socket.manager', () => ({
  emitCatalogDeleted: jest.fn(),
  emitCatalogEntriesUpdated: jest.fn(),
  emitCatalogMetadataUpdated: jest.fn(),
}));

// Mock auth middleware module
let mockUserId: mongoose.Types.ObjectId | undefined;
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  authenticateToken: jest.fn((req: any, res: any, next: any) => {
    if (!mockUserId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    req.user = { _id: mockUserId };
    next();
  }),
}));

export const mockAuthMiddleware = (userId: mongoose.Types.ObjectId | undefined) => {
  mockUserId = userId;
};

export const catalogModelMock = catalogModel as unknown as Record<string, jest.Mock>;
export const catalogShareModelMock = catalogShareModel as unknown as Record<string, jest.Mock>;
export const catalogEntryLinkModelMock = catalogEntryLinkModel as unknown as Record<string, jest.Mock>;
export const catalogRepositoryMock = catalogRepository as unknown as Record<string, jest.Mock>;
export const buildCatalogEntriesResponseMock = buildCatalogEntriesResponse as jest.Mock;
export { emitCatalogDeleted, emitCatalogEntriesUpdated, emitCatalogMetadataUpdated };

export const resetAllMocks = () => {
  jest.clearAllMocks();
  Object.values(catalogModelMock).forEach(mock => mock.mockReset?.());
  Object.values(catalogShareModelMock).forEach(mock => mock.mockReset?.());
  Object.values(catalogEntryLinkModelMock).forEach(mock => mock.mockReset?.());
  Object.values(catalogRepositoryMock).forEach(mock => mock.mockReset?.());
  buildCatalogEntriesResponseMock.mockReset();
  mockUserId = undefined;
};

