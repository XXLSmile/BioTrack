import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';


import { recognitionController } from '../../../src/recognition/recognition.controller';
import type {
  RecognitionImageResponse,
  RecognitionResult,
} from '../../../src/recognition/recognition.types';

jest.mock('../../../src/recognition/recognition.service', () => ({
  recognitionService: {
    recognizeFromUrl: jest.fn(),
  },
}));

jest.mock('../../../src/recognition/species.model', () => ({
  speciesRepository: {
    findOrCreate: jest.fn(),
  },
}));

jest.mock('../../../src/recognition/catalog.model', () => ({
  catalogRepository: {
    findByHash: jest.fn(),
    create: jest.fn(),
    findByUserId: jest.fn(),
  },
  catalogModel: {
    findById: jest.fn(),
  },
}));

jest.mock('../../../src/user/user.model', () => ({
  userModel: {
    incrementObservationCount: jest.fn(),
    addBadge: jest.fn(),
  },
}));

jest.mock('../../../src/catalog/catalog.model', () => ({
  catalogModel: {
    findById: jest.fn(),
  },
}));

jest.mock('../../../src/catalog/catalogEntryLink.model', () => ({
  catalogEntryLinkModel: {
    isEntryLinked: jest.fn(),
    linkEntry: jest.fn(),
    listEntriesWithDetails: jest.fn(),
    listCatalogIdsForEntry: jest.fn(),
  },
}));

jest.mock('../../../src/catalog/catalogShare.model', () => ({
  catalogShareModel: {
    getUserAccess: jest.fn(),
  },
}));

jest.mock('../../../src/socket/socket.manager', () => ({
  emitCatalogEntriesUpdated: jest.fn(),
}));

jest.mock('../../../src/location/geocoding.service', () => ({
  geocodingService: {
    reverseGeocode: jest.fn(),
  },
}));

const { recognitionService } = jest.requireMock('../../../src/recognition/recognition.service') as {
  recognitionService: {
    recognizeFromUrl: jest.Mock;
  };
};

const { speciesRepository } = jest.requireMock('../../../src/recognition/species.model') as {
  speciesRepository: {
    findOrCreate: jest.Mock;
  };
};

const { catalogRepository } = jest.requireMock('../../../src/recognition/catalog.model') as {
  catalogRepository: {
    findByHash: jest.Mock;
    create: jest.Mock;
    findByUserId: jest.Mock;
  };
};

const { catalogEntryLinkModel } = jest.requireMock('../../../src/catalog/catalogEntryLink.model') as {
  catalogEntryLinkModel: {
    isEntryLinked: jest.Mock;
    linkEntry: jest.Mock;
    listEntriesWithDetails: jest.Mock;
    listCatalogIdsForEntry: jest.Mock;
  };
};

const { catalogModel } = jest.requireMock('../../../src/catalog/catalog.model') as {
  catalogModel: {
    findById: jest.Mock;
  };
};

const { catalogShareModel } = jest.requireMock('../../../src/catalog/catalogShare.model') as {
  catalogShareModel: {
    getUserAccess: jest.Mock;
  };
};

const { emitCatalogEntriesUpdated } = jest.requireMock('../../../src/socket/socket.manager') as {
  emitCatalogEntriesUpdated: jest.Mock;
};

const { geocodingService } = jest.requireMock('../../../src/location/geocoding.service') as {
  geocodingService: {
    reverseGeocode: jest.Mock;
  };
};

const { userModel } = jest.requireMock('../../../src/user/user.model') as {
  userModel: {
    incrementObservationCount: jest.Mock;
    addBadge: jest.Mock;
  };
};

const recognitionServiceMock = recognitionService.recognizeFromUrl as jest.MockedFunction<
  (imageUrl: string) => Promise<RecognitionResult>
>;
const speciesFindOrCreateMock = speciesRepository.findOrCreate as jest.MockedFunction<
  (data: any) => Promise<any>
>;
const catalogFindByHashMock = catalogRepository.findByHash as jest.MockedFunction<
  (userId: string, hash: string) => Promise<any>
>;
const catalogCreateMock = catalogRepository.create as jest.MockedFunction<
  (data: any) => Promise<any>
>;
const catalogFindByUserIdMock = catalogRepository.findByUserId as jest.MockedFunction<
  (userId: string, limit?: number) => Promise<any>
>;
const catalogModelFindByIdMock = catalogModel.findById as jest.MockedFunction<(catalogId: string) => Promise<any>>;
const catalogEntryIsLinkedMock = catalogEntryLinkModel.isEntryLinked as jest.MockedFunction<
  (catalogId: mongoose.Types.ObjectId, entryId: mongoose.Types.ObjectId) => Promise<boolean>
>;
const catalogEntryLinkMock = catalogEntryLinkModel.linkEntry as jest.MockedFunction<
  (catalogId: mongoose.Types.ObjectId, entryId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) => Promise<void>
>;
const catalogEntryDetailsMock = catalogEntryLinkModel.listEntriesWithDetails as jest.MockedFunction<
  (catalogId: mongoose.Types.ObjectId) => Promise<any[]>
>;
const catalogEntryListIdsMock = catalogEntryLinkModel.listCatalogIdsForEntry as jest.MockedFunction<
  (entryId: mongoose.Types.ObjectId) => Promise<mongoose.Types.ObjectId[]>
>;
const catalogShareAccessMock = catalogShareModel.getUserAccess as jest.MockedFunction<
  (catalogId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) => Promise<{ role: string } | null>
>;
const emitCatalogEntriesUpdatedMock = emitCatalogEntriesUpdated as jest.MockedFunction<
  (catalogId: mongoose.Types.ObjectId, entries: any, userId?: mongoose.Types.ObjectId) => void
>;
const reverseGeocodeMock = geocodingService.reverseGeocode as jest.MockedFunction<
  (lat: number, lng: number) => Promise<{ city?: string; province?: string }>
>;
const incrementObservationCountMock = userModel.incrementObservationCount as jest.MockedFunction<
  (userId: mongoose.Types.ObjectId) => Promise<void>
>;
const addBadgeMock = userModel.addBadge as jest.MockedFunction<
  (userId: mongoose.Types.ObjectId, badge: string) => Promise<void>
>;

const backendRoot = path.join(__dirname, '../../..');
const racoonImagePath = path.join(backendRoot, 'uploads/images/racoon.jpg');

const createMockResponse = <T = any>(): Response<T> => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  return res as unknown as Response<T>;
};

describe('RecognitionController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recognitionServiceMock.mockReset();
    speciesFindOrCreateMock.mockReset();
    catalogFindByHashMock.mockReset();
    catalogCreateMock.mockReset();
    catalogFindByUserIdMock.mockReset();
    catalogModelFindByIdMock.mockReset();
    catalogEntryIsLinkedMock.mockReset();
    catalogEntryLinkMock.mockReset();
    catalogEntryDetailsMock.mockReset();
    catalogEntryListIdsMock.mockReset();
    catalogShareAccessMock.mockReset();
    emitCatalogEntriesUpdatedMock.mockReset();
    reverseGeocodeMock.mockReset();
    incrementObservationCountMock.mockReset();
    addBadgeMock.mockReset();
  });

  test('recognizeImage returns recognition result for racoon image', async () => {
    const fileBuffer = fs.readFileSync(racoonImagePath);

    const recognitionPayload: RecognitionResult = {
      species: {
        id: 42,
        scientificName: 'Procyon lotor',
        commonName: 'racoon',
        rank: 'species',
      },
      confidence: 0.97,
      alternatives: [],
    };

    recognitionServiceMock.mockResolvedValue(recognitionPayload);

    const req = {
      protocol: 'http',
      get: (header: string) => (header.toLowerCase() === 'host' ? 'localhost:3000' : undefined),
      body: {},
      file: {
        originalname: 'racoon.jpg',
        buffer: fileBuffer,
      },
    } as unknown as Request;

    const res = createMockResponse<RecognitionImageResponse>();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeImage(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recognition: expect.objectContaining({
            species: expect.objectContaining({
              commonName: 'racoon',
            }),
          }),
        }),
      })
    );

    const payload = (res.json as jest.Mock).mock.calls[0][0] as RecognitionImageResponse;
    const savedPath = payload.data?.imagePath
      ? path.join(backendRoot, payload.data.imagePath.replace(/^\//, ''))
      : undefined;

    if (savedPath && fs.existsSync(savedPath)) {
      fs.rmSync(savedPath, { force: true });
    }
  });

  test('recognizeAndSave persists racoon recognition payload', async () => {
    const userId = new mongoose.Types.ObjectId();
    const speciesDoc = {
      _id: new mongoose.Types.ObjectId(),
      inaturalistId: 42,
      scientificName: 'Procyon lotor',
      commonName: 'racoon',
      rank: 'species',
    };

    speciesFindOrCreateMock.mockResolvedValue(speciesDoc as any);
    catalogFindByHashMock.mockResolvedValue(null);

    const createdEntryId = new mongoose.Types.ObjectId();
    catalogCreateMock.mockImplementation(async (data: any) => ({
      _id: createdEntryId,
      ...data,
    }));

    catalogFindByUserIdMock.mockResolvedValue([
      {
        speciesId: speciesDoc._id,
      },
    ]);

    const req = {
      protocol: 'http',
      get: (header: string) => (header.toLowerCase() === 'host' ? 'localhost:3000' : undefined),
      body: {
        imagePath: '/uploads/images/racoon.jpg',
        recognition: {
          species: {
            id: 42,
            scientificName: 'Procyon lotor',
            commonName: 'racoon',
            rank: 'species',
          },
          confidence: 0.97,
        },
      },
      user: {
        _id: userId,
      },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(catalogFindByHashMock).toHaveBeenCalled();
    expect(catalogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: userId.toString(),
        imageUrl: '/uploads/images/racoon.jpg',
      })
    );

    expect(incrementObservationCountMock).toHaveBeenCalledWith(userId);
    expect(addBadgeMock).toHaveBeenCalledWith(userId, 'First Sighting');

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recognition: expect.objectContaining({
            species: expect.objectContaining({
              commonName: 'racoon',
            }),
          }),
        }),
      })
    );
  });

  test('recognizeImage responds 400 when no image provided', async () => {
    const req = {
      protocol: 'https',
      get: () => 'example.com',
      body: {},
      file: undefined,
    } as unknown as Request;

    const res = createMockResponse<RecognitionImageResponse>();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeImage(req, res, next);

    expect(recognitionServiceMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Provide an image file or an imageUrl to perform recognition.',
      })
    );
  });

  test('recognizeImage accepts hosted imageUrl', async () => {
    const recognitionPayload: RecognitionResult = {
      species: {
        id: 7,
        scientificName: 'Procyon lotor',
        commonName: 'Raccoon',
        rank: 'species',
      },
      confidence: 0.88,
    };

    recognitionServiceMock.mockResolvedValue(recognitionPayload);

    const req = {
      protocol: 'https',
      get: () => 'example.com',
      body: {
        imageUrl: 'https://cdn.example.com/raccoon.jpg',
        latitude: '49.25',
        longitude: '-123.1',
      },
    } as unknown as Request;

    const res = createMockResponse<RecognitionImageResponse>();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeImage(req, res, next);

    expect(recognitionServiceMock).toHaveBeenCalledWith('https://cdn.example.com/raccoon.jpg');
    expect(res.status).toHaveBeenCalledWith(200);

    const payload = (res.json as jest.Mock).mock.calls[0][0] as RecognitionImageResponse;
    expect(payload.data?.latitude).toBeCloseTo(49.25);
    expect(payload.data?.longitude).toBeCloseTo(-123.1);
    expect(payload.data?.imagePath).toBeUndefined();
  });

  test('recognizeImage returns 404 when recognition finds no species', async () => {
    const fileBuffer = fs.readFileSync(racoonImagePath);
    recognitionServiceMock.mockRejectedValue(new Error('No species recognized from image'));

    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);

    const req = {
      protocol: 'https',
      get: () => 'example.com',
      body: {},
      file: {
        originalname: 'racoon.jpg',
        buffer: fileBuffer,
      },
    } as unknown as Request;

    const res = createMockResponse<RecognitionImageResponse>();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeImage(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Could not recognize any species from the image. Try a clearer photo.',
      })
    );

    existsSpy.mockRestore();
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
  });

  test('recognizeImage surfaces rate limit errors', async () => {
    const fileBuffer = fs.readFileSync(racoonImagePath);
    recognitionServiceMock.mockRejectedValue(new Error('Rate limit exceeded'));

    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);

    const req = {
      protocol: 'https',
      get: () => 'example.com',
      body: {},
      file: {
        originalname: 'racoon.jpg',
        buffer: fileBuffer,
      },
    } as unknown as Request;

    const res = createMockResponse<RecognitionImageResponse>();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeImage(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Rate limit exceeded',
      })
    );

    existsSpy.mockRestore();
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
  });

  test('recognizeAndSave validates recognition payload', async () => {
    const req = {
      body: {
        imagePath: '/uploads/images/racoon.jpg',
        recognition: {},
      },
      user: {
        _id: new mongoose.Types.ObjectId(),
      },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'recognition payload is missing required species information.',
      })
    );
  });

  test('recognizeAndSave returns 404 when image not found', async () => {
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const req = {
      body: {
        imagePath: '/uploads/images/missing.jpg',
        recognition: {
          species: {
            id: 1,
            scientificName: 'Missing species',
            rank: 'species',
          },
          confidence: 0.5,
        },
      },
      user: {
        _id: new mongoose.Types.ObjectId(),
      },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Uploaded image could not be found. Please run recognition again.',
      })
    );

    existsSpy.mockRestore();
  });

  test('recognizeAndSave rejects invalid catalog id', async () => {
    const userId = new mongoose.Types.ObjectId();
    const speciesDoc = {
      _id: new mongoose.Types.ObjectId(),
      inaturalistId: 1,
      scientificName: 'Species',
      commonName: 'Species',
      rank: 'species',
    };

    speciesFindOrCreateMock.mockResolvedValue(speciesDoc as any);
    const existingEntry = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      imageUrl: '/uploads/images/racoon.jpg',
      city: undefined,
      province: undefined,
      save: jest.fn(async () => undefined),
    };
    catalogFindByHashMock.mockResolvedValue(existingEntry);

    const req = {
      body: {
        imagePath: '/uploads/images/racoon.jpg',
        recognition: {
          species: {
            id: 1,
            scientificName: 'Species',
            commonName: 'Species',
            rank: 'species',
          },
          confidence: 0.5,
        },
        catalogId: 'bad-id',
      },
      user: { _id: userId },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid catalog ID',
      })
    );
    expect(catalogModelFindByIdMock).not.toHaveBeenCalled();
  });

  test('recognizeAndSave returns 404 when catalog missing', async () => {
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const speciesDoc = {
      _id: new mongoose.Types.ObjectId(),
      inaturalistId: 2,
      scientificName: 'Species',
      rank: 'species',
    };

    speciesFindOrCreateMock.mockResolvedValue(speciesDoc as any);
    const existingEntry = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      imageUrl: '/uploads/images/racoon.jpg',
      city: undefined,
      province: undefined,
      save: jest.fn(async () => undefined),
    };
    catalogFindByHashMock.mockResolvedValue(existingEntry);
    catalogModelFindByIdMock.mockResolvedValue(null);

    const req = {
      body: {
        imagePath: '/uploads/images/racoon.jpg',
        recognition: {
          species: {
            id: 2,
            scientificName: 'Species',
            rank: 'species',
          },
          confidence: 0.8,
        },
        catalogId: catalogId.toString(),
      },
      user: { _id: userId },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(catalogModelFindByIdMock).toHaveBeenCalledWith(catalogId.toString());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Catalog not found',
      })
    );
  });

  test('recognizeAndSave forbids catalog updates without permission', async () => {
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();

    speciesFindOrCreateMock.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      scientificName: 'Species',
      rank: 'species',
      inaturalistId: 1,
    } as any);

    catalogFindByHashMock.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      userId,
      imageUrl: '/uploads/images/racoon.jpg',
      city: undefined,
      province: undefined,
      save: jest.fn(async () => undefined),
    });

    catalogModelFindByIdMock.mockResolvedValue({
      _id: catalogId,
      owner: ownerId,
    });

    catalogShareAccessMock.mockResolvedValue({ role: 'viewer' });

    const req = {
      body: {
        imagePath: '/uploads/images/racoon.jpg',
        recognition: {
          species: {
            id: 2,
            scientificName: 'Species',
            rank: 'species',
          },
          confidence: 0.5,
        },
        catalogId: catalogId.toString(),
      },
      user: { _id: userId },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'You do not have permission to modify this catalog',
      })
    );
  });

  test('recognizeAndSave links catalog entry and emits updates', async () => {
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const speciesDoc = {
      _id: new mongoose.Types.ObjectId(),
      inaturalistId: 5,
      scientificName: 'Procyon lotor',
      commonName: 'raccoon',
      rank: 'species',
    };

    speciesFindOrCreateMock.mockResolvedValue(speciesDoc as any);
    catalogFindByHashMock.mockResolvedValue(null);

    const createdEntry = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      speciesId: speciesDoc._id,
      imageUrl: '/uploads/images/racoon.jpg',
      city: undefined,
      province: undefined,
      save: jest.fn(async () => undefined),
    };
    catalogCreateMock.mockResolvedValue(createdEntry);
    catalogModelFindByIdMock.mockResolvedValue({
      _id: catalogId,
      owner: userId,
    });
    catalogEntryIsLinkedMock.mockResolvedValue(false);
    catalogEntryLinkMock.mockResolvedValue(undefined);
    catalogEntryDetailsMock.mockResolvedValue([]);
    emitCatalogEntriesUpdatedMock.mockImplementation(() => undefined);
    reverseGeocodeMock.mockResolvedValue({
      city: 'Vancouver',
      province: 'BC',
    });
    catalogFindByUserIdMock.mockResolvedValue(
      Array.from({ length: 10 }, () => ({
        speciesId: new mongoose.Types.ObjectId(),
      }))
    );

    const req = {
      protocol: 'https',
      get: () => 'example.com',
      body: {
        imagePath: '/uploads/images/racoon.jpg',
        recognition: {
          species: {
            id: speciesDoc.inaturalistId,
            scientificName: speciesDoc.scientificName,
            commonName: speciesDoc.commonName,
            rank: 'species',
          },
          confidence: 0.96,
          alternatives: [
            {
              scientificName: 'Procyon lotor lotor',
              commonName: 'Common raccoon',
              confidence: 0.5,
            },
          ],
        },
        catalogId: catalogId.toString(),
        notes: 'Seen near the park',
        latitude: 49.25,
        longitude: -123.1,
      },
      user: { _id: userId },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(catalogCreateMock).toHaveBeenCalled();
    expect(reverseGeocodeMock).toHaveBeenCalledWith(49.25, -123.1);
    expect(catalogEntryLinkMock).toHaveBeenCalledWith(catalogId, createdEntry._id, userId);
    expect(emitCatalogEntriesUpdatedMock).toHaveBeenCalled();
    expect(addBadgeMock).toHaveBeenCalledWith(userId, 'Explorer');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('recognizeAndSave updates missing location metadata when available', async () => {
    const userId = new mongoose.Types.ObjectId();
    const entrySave = jest.fn(async () => undefined);
    const existingEntry = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      imageUrl: '/uploads/images/racoon.jpg',
      city: undefined,
      province: undefined,
      save: entrySave,
    };

    speciesFindOrCreateMock.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      inaturalistId: 9,
      scientificName: 'Species',
      rank: 'species',
    } as any);
    catalogFindByHashMock.mockResolvedValue(existingEntry);
    reverseGeocodeMock.mockResolvedValue({ city: 'Burnaby', province: 'BC' });

    const req = {
      body: {
        imagePath: '/uploads/images/racoon.jpg',
        recognition: {
          species: {
            id: 9,
            scientificName: 'Species',
            rank: 'species',
          },
          confidence: 0.75,
        },
        latitude: 49.23,
        longitude: -123.0,
      },
      user: { _id: userId },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(entrySave).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('recognizeAndSave awards naturalist badge at 50 species', async () => {
    const userId = new mongoose.Types.ObjectId();

    speciesFindOrCreateMock.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      inaturalistId: 10,
      scientificName: 'Species',
      rank: 'species',
    } as any);
    catalogFindByHashMock.mockResolvedValue(null);
    catalogCreateMock.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      userId,
      speciesId: new mongoose.Types.ObjectId(),
      imageUrl: '/uploads/images/racoon.jpg',
      save: jest.fn(async () => undefined),
    });
    catalogFindByUserIdMock.mockResolvedValue(
      Array.from({ length: 50 }, () => ({
        speciesId: new mongoose.Types.ObjectId(),
      }))
    );

    const req = {
      body: {
        imagePath: '/uploads/images/racoon.jpg',
        recognition: {
          species: {
            id: 10,
            scientificName: 'Species',
            rank: 'species',
          },
          confidence: 0.81,
        },
      },
      user: { _id: userId },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(addBadgeMock).toHaveBeenCalledWith(userId, 'Naturalist');
  });
});
