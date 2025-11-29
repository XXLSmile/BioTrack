import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';


import { recognitionController } from '../../../src/controllers/recognition.controller';
import type {
  RecognitionImageResponse,
  RecognitionResult,
} from '../../../src/types/recognition.types';

jest.mock('../../../src/services/recognition.service', () => ({
  recognitionService: {
    recognizeFromUrl: jest.fn(),
  },
}));

jest.mock('../../../src/models/recognition/species.model', () => ({
  speciesRepository: {
    findOrCreate: jest.fn(),
  },
}));

jest.mock('../../../src/models/recognition/catalog.model', () => ({
  catalogRepository: {
    findByHash: jest.fn(),
    create: jest.fn(),
    findByUserId: jest.fn(),
    findRecentByUserId: jest.fn(),
    deleteById: jest.fn(),
  },
  catalogModel: {
    findById: jest.fn(),
  },
}));

jest.mock('../../../src/models/user/user.model', () => ({
  userModel: {
    incrementObservationCount: jest.fn(),
    addBadge: jest.fn(),
  },
}));

jest.mock('../../../src/models/catalog/catalog.model', () => ({
  catalogModel: {
    findById: jest.fn(),
  },
}));

jest.mock('../../../src/models/catalog/catalogEntryLink.model', () => ({
  catalogEntryLinkModel: {
    isEntryLinked: jest.fn(),
    linkEntry: jest.fn(),
    listEntriesWithDetails: jest.fn(),
    listCatalogIdsForEntry: jest.fn(),
  },
}));

jest.mock('../../../src/models/catalog/catalogShare.model', () => ({
  catalogShareModel: {
    getUserAccess: jest.fn(),
  },
}));

jest.mock('../../../src/infrastructure/socket.manager', () => ({
  emitCatalogEntriesUpdated: jest.fn(),
}));

jest.mock('../../../src/services/location/geocoding.service', () => ({
  geocodingService: {
    reverseGeocode: jest.fn(),
  },
}));

const { recognitionService } = jest.requireMock('../../../src/services/recognition.service') as {
  recognitionService: {
    recognizeFromUrl: jest.Mock;
  };
};

const { speciesRepository } = jest.requireMock('../../../src/models/recognition/species.model') as {
  speciesRepository: {
    findOrCreate: jest.Mock;
  };
};

const { catalogRepository } = jest.requireMock('../../../src/models/recognition/catalog.model') as {
  catalogRepository: {
    findByHash: jest.Mock;
    create: jest.Mock;
    findByUserId: jest.Mock;
    findRecentByUserId: jest.Mock;
    deleteById: jest.Mock;
  };
};

const { catalogEntryLinkModel } = jest.requireMock('../../../src/models/catalog/catalogEntryLink.model') as {
  catalogEntryLinkModel: {
    isEntryLinked: jest.Mock;
    linkEntry: jest.Mock;
    listEntriesWithDetails: jest.Mock;
    listCatalogIdsForEntry: jest.Mock;
  };
};

const { catalogModel } = jest.requireMock('../../../src/models/catalog/catalog.model') as {
  catalogModel: {
    findById: jest.Mock;
  };
};

const { catalogShareModel } = jest.requireMock('../../../src/models/catalog/catalogShare.model') as {
  catalogShareModel: {
    getUserAccess: jest.Mock;
  };
};

const { emitCatalogEntriesUpdated } = jest.requireMock('../../../src/infrastructure/socket.manager') as {
  emitCatalogEntriesUpdated: jest.Mock;
};

const { geocodingService } = jest.requireMock('../../../src/services/location/geocoding.service') as {
  geocodingService: {
    reverseGeocode: jest.Mock;
  };
};

const { userModel } = jest.requireMock('../../../src/models/user/user.model') as {
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
const catalogFindRecentByUserIdMock = catalogRepository.findRecentByUserId as jest.MockedFunction<
  (userId: string, limit: number) => Promise<any>
>;
const catalogDeleteMock = catalogRepository.deleteById as jest.MockedFunction<
  (entryId: string, userId: string) => Promise<'deleted' | 'not_found' | 'forbidden'>
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
const uploadsDir = path.join(backendRoot, 'uploads/images');
const racoonImagePath = path.join(uploadsDir, 'racoon.jpg');
const originalMediaBaseUrl = process.env.MEDIA_BASE_URL;

const createMockResponse = <T = any>(): Response<T> => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  return res as unknown as Response<T>;
};

describe('RecognitionController', () => {
  beforeAll(() => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    if (!fs.existsSync(racoonImagePath)) {
      fs.writeFileSync(racoonImagePath, Buffer.from('racoon fixture image'));
    }
  });

  afterAll(() => {
    if (fs.existsSync(racoonImagePath)) {
      fs.unlinkSync(racoonImagePath);
    }
    if (typeof originalMediaBaseUrl === 'undefined') {
      delete process.env.MEDIA_BASE_URL;
    } else {
      process.env.MEDIA_BASE_URL = originalMediaBaseUrl;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    recognitionServiceMock.mockReset();
    speciesFindOrCreateMock.mockReset();
    catalogFindByHashMock.mockReset();
    catalogCreateMock.mockReset();
    catalogFindByUserIdMock.mockReset();
    catalogFindRecentByUserIdMock.mockReset();
    catalogDeleteMock.mockReset();
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
    process.env.MEDIA_BASE_URL = '';
  });

  // API: POST /api/recognition (recognizeImage)
  // Input: multipart upload with racoon.jpg buffer; no query params
  // Expected status code: 200
  // Expected behavior: controller saves temp file, calls recognitionService, returns recognition payload + temp path
  // Expected output: JSON message with recognition.data.species.commonName === 'racoon'
  // Mock behavior: recognitionService.recognizeFromUrl resolves synthetic RecognitionResult; catalog/user dependencies untouched
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

  // Interface RecognitionController.recognizeImage
  test('recognizeImage treats whitespace coordinates as undefined', async () => {
    const recognitionPayload: RecognitionResult = {
      species: {
        id: 99,
        scientificName: 'Test species',
        commonName: 'Specimen',
        rank: 'species',
      },
      confidence: 0.8,
      alternatives: [],
    };

    recognitionServiceMock.mockResolvedValue(recognitionPayload);

    const req = {
      protocol: 'https',
      get: (header: string) => (header.toLowerCase() === 'host' ? 'example.com' : undefined),
      body: {
        latitude: '   ',
        longitude: '   ',
        imageUrl: 'https://example.com/uploads/images/sample.jpg',
      },
    } as unknown as Request;

    const res = createMockResponse<RecognitionImageResponse>();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeImage(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = (res.json as jest.Mock).mock.calls[0]?.[0] as RecognitionImageResponse;
    expect(payload.data?.latitude).toBeUndefined();
    expect(payload.data?.longitude).toBeUndefined();
  });

  // Interface RecognitionController.recognizeImage
  test('recognizeImage bubbles invalid accessible URL errors', async () => {
    const fileBuffer = Buffer.from('image-bytes');

    const req = {
      protocol: 'http',
      get: jest.fn(() => undefined),
      body: {},
      file: {
        originalname: 'capture.jpg',
        buffer: fileBuffer,
      },
    } as unknown as Request;

    const res = createMockResponse<RecognitionImageResponse>();
    const next = jest.fn() as NextFunction;

    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);

    await recognitionController.recognizeImage(req, res, next);

    expect(recognitionServiceMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Unable to resolve public image URL'),
      })
    );
    expect(res.status).not.toHaveBeenCalled();

    existsSpy.mockRestore();
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
  });

  // API: POST /api/recognition/save (recognizeAndSave)
  // Input: body.imagePath points to existing uploads image; recognition payload contains raccoon species; authenticated user id provided
  // Expected status code: 201
  // Expected behavior: controller creates catalog entry, increments observation count, awards first badge
  // Expected output: JSON with saved entry and echoed recognition payload
  // Mock behavior: speciesRepository.findOrCreate resolves doc; catalogRepository.create invoked; userModel.incrementObservationCount/addBadge called; no geocoding
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

  // API: POST /api/recognition (recognizeImage)
  // Input: request without file and without imageUrl
  // Expected status code: 400
  // Expected behavior: controller rejects missing image payload without calling recognitionService
  // Expected output: JSON message prompting for image file or URL
  // Mock behavior: recognitionService mock should not be invoked
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

  test('recognizeImage revalidates file presence before saving upload', async () => {
    let accessCount = 0;
    const req = {
      protocol: 'https',
      get: () => 'example.com',
      body: {},
    } as unknown as Request;

    Object.defineProperty(req, 'file', {
      configurable: true,
      get() {
        accessCount += 1;
        return accessCount === 1 ? { placeholder: true } : undefined;
      },
    });

    const res = createMockResponse<RecognitionImageResponse>();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeImage(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Provide an image file or an imageUrl to perform recognition.',
      })
    );
    expect(recognitionServiceMock).not.toHaveBeenCalled();
  });

  // API: POST /api/recognition (recognizeImage)
  // Input: body.imageUrl set to https URL; body latitude/longitude as strings
  // Expected status code: 200
  // Expected behavior: controller bypasses file saving, forwards URL to recognitionService, normalizes coordinates
  // Expected output: JSON data with latitude/longitude numbers and no imagePath
  // Mock behavior: recognitionService returns RecognitionResult with confidence 0.88
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

  // API: POST /api/recognition (recognizeImage)
  // Input: file upload; recognitionService throws "No species recognized"
  // Expected status code: 404
  // Expected behavior: controller surfaces not-found message when service signals no hit
  // Expected output: JSON message advising retry
  // Mock behavior: recognitionService mock rejects; fs helpers stubbed to avoid real disk writes
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
        message: 'Could not recognize any species. Try again later or save only.',
      })
    );

    existsSpy.mockRestore();
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
  });

  // API: POST /api/recognition (recognizeImage)
  // Input: file upload; recognitionService throws "Rate limit exceeded"
  // Expected status code: 429
  // Expected behavior: controller converts rate-limit error into 429 response
  // Expected output: JSON body with message "Rate limit exceeded"
  // Mock behavior: recognitionService mock rejects with Error; fs helpers mocked for temp file writes
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

  test('recognizeImage returns 504 when recognition times out', async () => {
    recognitionServiceMock.mockRejectedValue(new Error('Request timed out while contacting upstream'));

    const req = {
      protocol: 'https',
      get: () => 'example.com',
      body: {
        imageUrl: 'https://cdn.example.com/slow.jpg',
      },
    } as unknown as Request;

    const res = createMockResponse<RecognitionImageResponse>();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeImage(req, res, next);

    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Request timed out. Please try again.',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // API: POST /api/recognition (recognizeImage)
  // Input: multipart upload where file buffer missing
  // Expected status code: n/a
  // Expected behavior: controller forwards error to next middleware
  // Expected output: next called with Error('Uploaded file buffer is not available.')
  // Mock behavior: file provided without Buffer instance so helper throws
  test('recognizeImage forwards error when uploaded buffer missing', async () => {
    const req = {
      protocol: 'https',
      get: () => 'example.com',
      body: {},
      file: {
        originalname: 'broken.jpg',
        buffer: 'not-a-buffer',
      },
    } as unknown as Request;

    const res = createMockResponse<RecognitionImageResponse>();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeImage(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.status).not.toHaveBeenCalled();
  });

  // API: POST /api/recognition/save (recognizeAndSave)
  // Input: imagePath provided but recognition payload missing required species fields
  // Expected status code: 400
  // Expected behavior: controller validates payload via schema and rejects early
  // Expected output: JSON message about missing recognition information
  // Mock behavior: no catalog or user mocks invoked because validation fails
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

  test('recognizeAndSave requires imagePath field', async () => {
    const req = {
      body: {
        recognition: {
          species: {
            id: 1,
            scientificName: 'Specimen',
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

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'imagePath is required to save the recognition result.',
      })
    );
  });

  // API: POST /api/recognition/save (recognizeAndSave)
  // Input: request without req.user
  // Expected status code: 401
  // Expected behavior: responds with authentication error before further validation
  // Expected output: message 'Authentication required'
  // Mock behavior: none
  test('recognizeAndSave returns 401 when user missing', async () => {
    const req = {
      body: {
        imagePath: '/uploads/images/any.jpg',
      },
      user: undefined,
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  test('recognizeAndSave requires recognition payload object', async () => {
    const req = {
      body: {
        imagePath: '/uploads/images/racoon.jpg',
        recognition: null,
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
        message: 'recognition payload is required.',
      })
    );
  });

  test.each([
    ['empty path after host', 'https://example.com', 'Invalid image path provided.'],
    ['missing uploads prefix', 'images/animal.jpg', 'Image path must reference the /uploads directory.'],
    ['disallowed traversal', 'https://example.com/uploads/../secret.jpg', 'Image path cannot traverse outside of uploads directory.'],
    ['missing filename', 'https://example.com/uploads/', 'Image path does not contain a valid filename.'],
  ])('recognizeAndSave rejects imagePath when %s', async (_, imagePath, expectedMessage) => {
    const userId = new mongoose.Types.ObjectId();

    const req = {
      protocol: 'http',
      get: (header: string) => (header.toLowerCase() === 'host' ? 'localhost:3000' : undefined),
      body: {
        imagePath,
        recognition: {
          species: {
            id: 1,
            scientificName: 'Specimen',
          },
          confidence: 0.5,
        },
      },
      user: {
        _id: userId,
      },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expectedMessage,
      })
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  // API: POST /api/recognition/save (recognizeAndSave)
  // Input: imagePath referencing non-existent file on disk
  // Expected status code: 404
  // Expected behavior: controller verifies path exists before processing and reports missing upload
  // Expected output: JSON message asking to rerun recognition
  // Mock behavior: fs.existsSync mocked to return false
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

  // API: POST /api/recognition/save (recognizeAndSave)
  // Input: existing catalog entry with temp image path outside /images
  // Expected status code: 201
  // Expected behavior: controller renames file into /uploads/images and reuses existing entry without creating new catalog record
  // Expected output: JSON success payload; userModel.incrementObservationCount not called
  // Mock behavior: catalogFindByHash returns entry; fs.renameSync mocked; reverseGeocode returns undefined
  test('recognizeAndSave renames temp image for existing entry', async () => {
    const userId = new mongoose.Types.ObjectId();
    const existingEntry = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      city: null,
      province: null,
      save: jest.fn(async () => undefined),
    };

    speciesFindOrCreateMock.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      inaturalistId: 3,
      scientificName: 'Species',
      rank: 'species',
    } as any);
    catalogFindByHashMock.mockResolvedValue(existingEntry);
    reverseGeocodeMock.mockResolvedValue(null as any);

    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('image'));
    const renameSpy = jest.spyOn(fs, 'renameSync').mockImplementation(() => undefined);
    const renameExistsSpy = jest.spyOn(fs, 'existsSync').mockImplementation((targetPath: fs.PathLike) => {
      const pathStr = targetPath.toString();
      if (pathStr.includes('tmp/temp.jpg')) {
        return true;
      }
      return false;
    });

    const req = {
      body: {
        imagePath: '/uploads/tmp/temp.jpg',
        recognition: {
          species: {
            id: 3,
            scientificName: 'Species',
            rank: 'species',
          },
          confidence: 0.5,
        },
      },
      user: { _id: userId },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(renameSpy).toHaveBeenCalled();
    expect(catalogCreateMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(incrementObservationCountMock).not.toHaveBeenCalled();

    readSpy.mockRestore();
    renameSpy.mockRestore();
    renameExistsSpy.mockRestore();
  });

  test('recognizeAndSave assigns unique filenames and mime types for png uploads', async () => {
    const userId = new mongoose.Types.ObjectId();
    const speciesDoc = {
      _id: new mongoose.Types.ObjectId(),
      inaturalistId: 88,
      scientificName: 'Testus example',
      commonName: 'Example',
      rank: 'species',
    };

    speciesFindOrCreateMock.mockResolvedValue(speciesDoc as any);
    catalogFindByHashMock.mockResolvedValue(null);
    catalogFindByUserIdMock.mockResolvedValue([]);

    const createdEntryId = new mongoose.Types.ObjectId();
    catalogCreateMock.mockImplementation(async (data: any) => ({
      _id: createdEntryId,
      ...data,
    }));

    const existsSpy = jest.spyOn(fs, 'existsSync').mockImplementation((target: any) => {
      const pathString = target.toString();
      const base = path.basename(pathString);

      if (pathString.includes(`${path.sep}uploads${path.sep}tmp`)) {
        return true;
      }

      if (base === 'images') {
        return true;
      }

      if (base === 'original.png') {
        const alreadyChecked = (existsSpy as any).__uniqueCheck ?? 0;
        (existsSpy as any).__uniqueCheck = alreadyChecked + 1;
        return alreadyChecked === 0;
      }

      if (base === 'original-1.png') {
        return false;
      }

      return true;
    });

    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('image'));
    const renameSpy = jest.spyOn(fs, 'renameSync').mockImplementation(() => undefined);

    const req = {
      protocol: 'http',
      get: (header: string) => (header.toLowerCase() === 'host' ? 'localhost:3000' : undefined),
      body: {
        imagePath: '/uploads/tmp/original.png',
        recognition: {
          species: {
            id: 88,
            scientificName: 'Testus example',
          },
          confidence: 0.9,
        },
      },
      user: {
        _id: userId,
      },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    const createArgs = catalogCreateMock.mock.calls[0][0];
    expect(createArgs.imageMimeType).toBe('image/png');
    expect(createArgs.imageUrl).toContain('original-1.png');
    expect(renameSpy).toHaveBeenCalledWith(
      expect.stringContaining(path.join('uploads', 'tmp', 'original.png')),
      expect.stringContaining('original-1.png')
    );

    readSpy.mockRestore();
    renameSpy.mockRestore();
    existsSpy.mockRestore();
  });

  test.each([
    ['.gif', 'image/gif'],
    ['.webp', 'image/webp'],
    ['.bmp', 'image/bmp'],
    ['.heic', 'image/heic'],
    ['.jpeg', 'image/jpeg'],
  ])('recognizeAndSave infers mime type %s correctly', async (extension, expectedMime) => {
    const userId = new mongoose.Types.ObjectId();
    const speciesDoc = {
      _id: new mongoose.Types.ObjectId(),
      inaturalistId: 55,
      scientificName: 'Species',
      rank: 'species',
    };

    speciesFindOrCreateMock.mockResolvedValue(speciesDoc as any);
    catalogFindByHashMock.mockResolvedValue(null);
    catalogFindByUserIdMock.mockResolvedValue([]);
    catalogCreateMock.mockImplementation(async (data: any) => ({
      _id: new mongoose.Types.ObjectId(),
      ...data,
    }));

    const existsSpy = jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('image'));

    const req = {
      protocol: 'http',
      get: (header: string) => (header.toLowerCase() === 'host' ? 'localhost:3000' : undefined),
      body: {
        imagePath: `/uploads/images/sample${extension}`,
        recognition: {
          species: {
            id: 55,
            scientificName: 'Species',
          },
          confidence: 0.7,
        },
      },
      user: {
        _id: userId,
      },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    const createArgs = catalogCreateMock.mock.calls[0][0];
    expect(createArgs.imageMimeType).toBe(expectedMime);
    expect(createArgs.imageUrl).toMatch(new RegExp(`${extension.replace('.', '\\.')}$`));

    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  test('recognizeAndSave filters malformed alternatives', async () => {
    const userId = new mongoose.Types.ObjectId();
    const speciesDoc = {
      _id: new mongoose.Types.ObjectId(),
      inaturalistId: 99,
      scientificName: 'Species',
      rank: 'species',
    };

    speciesFindOrCreateMock.mockResolvedValue(speciesDoc as any);
    catalogFindByHashMock.mockResolvedValue(null);
    catalogFindByUserIdMock.mockResolvedValue([]);
    catalogCreateMock.mockImplementation(async (data: any) => ({
      _id: new mongoose.Types.ObjectId(),
      ...data,
    }));

    const existsSpy = jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('image'));

    const req = {
      protocol: 'http',
      get: (header: string) => (header.toLowerCase() === 'host' ? 'localhost:3000' : undefined),
      body: {
        imagePath: '/uploads/images/sight.jpg',
        recognition: {
          species: {
            id: 99,
            scientificName: 'Species',
          },
          confidence: 0.8,
          alternatives: [null, { scientificName: 42 }, { scientificName: 'Valid alt' }],
        },
      },
      user: {
        _id: userId,
      },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    const payload = (res.json as jest.Mock).mock.calls[0][0] as {
      data: { recognition: { alternatives?: Array<{ scientificName: string }> } };
    };
    expect(payload.data.recognition.alternatives).toHaveLength(1);
    expect(payload.data.recognition.alternatives?.[0]?.scientificName).toBe('Valid alt');

    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  test('recognizeAndSave forwards unexpected errors to next handler', async () => {
    const userId = new mongoose.Types.ObjectId();
    const failure = new Error('database unavailable');

    catalogFindByHashMock.mockResolvedValue(null);
    speciesFindOrCreateMock.mockRejectedValue(failure);

    const existsSpy = jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('image'));

    const req = {
      protocol: 'http',
      get: (header: string) => (header.toLowerCase() === 'host' ? 'localhost:3000' : undefined),
      body: {
        imagePath: '/uploads/images/existing.jpg',
        recognition: {
          species: {
            id: 7,
            scientificName: 'Error species',
          },
          confidence: 0.8,
        },
      },
      user: {
        _id: userId,
      },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();

    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  // API: POST /api/recognition/save (recognizeAndSave)
  // Input: new entry creation where catalogRepository.create returns null
  // Expected behavior: controller logs error and forwards it to the error handler
  // Expected output: next invoked with Error; response not sent
  // Mock behavior: catalogRepository.create mocked to resolve null causing failure branch
  test('recognizeAndSave forwards errors when catalog creation fails', async () => {
    const userId = new mongoose.Types.ObjectId();
    speciesFindOrCreateMock.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      inaturalistId: 4,
      scientificName: 'Species',
      rank: 'species',
    } as any);
    catalogFindByHashMock.mockResolvedValue(null);
    catalogCreateMock.mockResolvedValue(null);

    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('image'));
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    const req = {
      body: {
        imagePath: '/uploads/images/failure.jpg',
        recognition: {
          species: {
            id: 4,
            scientificName: 'Species',
            rank: 'species',
          },
          confidence: 0.5,
        },
      },
      user: { _id: userId },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(incrementObservationCountMock).toHaveBeenCalled();
    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  // API: POST /api/recognition/save (recognizeAndSave)
  // Input: catalogId not a valid ObjectId string
  // Expected status code: 400
  // Expected behavior: controller validates catalogId format before lookup
  // Expected output: JSON message "Invalid catalog ID"
  // Mock behavior: speciesFindOrCreate resolves user species; catalogFindByHash returns existing entry to reach catalogId branch
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

    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('image'));
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

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
    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  // API: POST /api/recognition/save (recognizeAndSave)
  // Input: well-formed catalogId referencing missing catalog document
  // Expected status code: 404
  // Expected behavior: controller attempts to load catalog, returns not found if absent
  // Expected output: JSON message "Catalog not found"
  // Mock behavior: catalogModel.findById mocked to resolve null
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

    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('image'));
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

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
    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  // API: POST /api/recognition/save (recognizeAndSave)
  // Input: catalog owned by another user with viewer role
  // Expected status code: 403
  // Expected behavior: controller ensures requester is owner/editor before linking entry
  // Expected output: JSON message about lacking permission
  // Mock behavior: catalogShareModel.getUserAccess returns { role: 'viewer' }
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
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('image'));
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

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
    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  // API: POST /api/recognition/save (recognizeAndSave)
  // Input: new entry linked to catalog where broadcast helper throws
  // Expected status code: 201
  // Expected behavior: controller catches broadcast error and still responds success
  // Expected output: JSON success payload; emitCatalogEntriesUpdated not invoked
  // Mock behavior: catalogEntryDetailsMock throws inside broadcast block
  test('recognizeAndSave handles broadcast failures gracefully', async () => {
    const userId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const speciesDoc = {
      _id: new mongoose.Types.ObjectId(),
      inaturalistId: 6,
      scientificName: 'Species',
      rank: 'species',
    };

    speciesFindOrCreateMock.mockResolvedValue(speciesDoc as any);
    catalogFindByHashMock.mockResolvedValue(null);

    const createdEntry = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      speciesId: speciesDoc._id,
      imageUrl: '/uploads/images/species.jpg',
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
    catalogEntryDetailsMock.mockRejectedValue(new Error('broadcast error'));
    reverseGeocodeMock.mockResolvedValue(null as any);
    catalogFindByUserIdMock.mockResolvedValue([]);
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('image'));
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    const req = {
      protocol: 'https',
      get: () => 'example.com',
      body: {
        imagePath: '/uploads/images/species.jpg',
        recognition: {
          species: {
            id: speciesDoc.inaturalistId,
            scientificName: speciesDoc.scientificName,
            rank: 'species',
          },
          confidence: 0.9,
        },
        catalogId: catalogId.toString(),
      },
      user: { _id: userId },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(emitCatalogEntriesUpdatedMock).not.toHaveBeenCalled();
    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  // API: POST /api/recognition/save (recognizeAndSave)
  // Input: new recognition with catalogId, notes, coordinates; no existing entry for hash
  // Expected status code: 201
  // Expected behavior: controller creates catalog entry, links to catalog, broadcasts socket update, updates location via geocoding
  // Expected output: JSON success envelope with linkedCatalogId
  // Mock behavior: species/catalogn mocks simulate creation; reverseGeocode returns city/province; emitCatalogEntriesUpdated observed
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
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('image'));
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

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
    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  // API: POST /api/recognition/save (recognizeAndSave)
  // Input: existing entry missing location fields; request supplies coordinates
  // Expected status code: 201
  // Expected behavior: controller populates city/province via geocoding and saves entry
  // Expected output: JSON success response (implicit)
  // Mock behavior: catalogFindByHash returns stored entry; reverseGeocode returns Partial location; entry.save spy tracks call
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
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('image'));
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

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
    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  // API: POST /api/recognition/save (recognizeAndSave)
  // Input: new entry causing unique species count to reach 50
  // Expected status code: 201
  // Expected behavior: controller awards "Naturalist" badge on milestone
  // Expected output: JSON success response
  // Mock behavior: catalogFindByUserId returns array of 50 pseudo entries to trigger badge logic
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
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('image'));
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

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
    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  // API: POST /api/recognition/save (recognizeAndSave)
  // Input: new entry causing unique species count to reach 10
  // Expected status code: 201
  // Expected behavior: controller awards "Explorer" badge for 10 unique species milestone
  // Expected output: JSON success response
  // Mock behavior: catalogFindByUserId returns array of 10 unique species ids
  test('recognizeAndSave awards explorer badge at 10 species', async () => {
    const userId = new mongoose.Types.ObjectId();

    speciesFindOrCreateMock.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      inaturalistId: 11,
      scientificName: 'Species',
      rank: 'species',
    } as any);
    catalogFindByHashMock.mockResolvedValue(null);
    catalogCreateMock.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      userId,
      speciesId: new mongoose.Types.ObjectId(),
      imageUrl: '/uploads/images/species.jpg',
      save: jest.fn(async () => undefined),
    });
    catalogFindByUserIdMock.mockResolvedValue(
      Array.from({ length: 10 }, () => ({
        speciesId: new mongoose.Types.ObjectId(),
      }))
    );
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('image'));
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    const req = {
      body: {
        imagePath: '/uploads/images/species.jpg',
        recognition: {
          species: {
            id: 11,
            scientificName: 'Species',
            rank: 'species',
          },
          confidence: 0.82,
        },
      },
      user: { _id: userId },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.recognizeAndSave(req, res, next);

    expect(addBadgeMock).toHaveBeenCalledWith(userId, 'Explorer');
    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  // API: GET /api/recognition/catalog (getUserCatalog)
  // Input: missing authenticated user
  // Expected status code: 401
  // Expected behavior: short-circuits before repository access
  // Expected output: { message: 'Authentication required' }
  // Mock behavior: none
  test('getUserCatalog requires authentication', async () => {
    const req = { user: undefined, query: {} } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.getUserCatalog(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: authenticated user with default limit (50)
  // Expected status code: 200
  // Expected behavior: controller returns user's catalog entries
  // Expected output: JSON envelope with entries and count fields
  // Mock behavior: catalogRepository.findByUserId resolves single-entry array
  test('getUserCatalog returns user catalog entries', async () => {
    const userId = new mongoose.Types.ObjectId();
    catalogFindByUserIdMock.mockResolvedValue([
      { _id: new mongoose.Types.ObjectId(), speciesId: new mongoose.Types.ObjectId() },
    ]);

    const req = {
      user: { _id: userId },
      query: {},
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.getUserCatalog(req, res, next);

    expect(catalogFindByUserIdMock).toHaveBeenCalledWith(userId.toString(), 50);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ count: 1 }),
      })
    );
  });

  test('getUserCatalog forwards errors to next middleware', async () => {
    const userId = new mongoose.Types.ObjectId();
    const failure = new Error('catalog lookup failed');
    catalogFindByUserIdMock.mockRejectedValueOnce(failure);

    const req = {
      user: { _id: userId },
      query: {},
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.getUserCatalog(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
  });

  // API: GET /api/recognition/recent (getRecentEntries)
  // Input: missing req.user
  // Expected status code: 401
  // Expected behavior: responds with auth error without repository call
  // Expected output: { message: 'Authentication required' }
  // Mock behavior: none
  test('getRecentEntries requires authentication', async () => {
    const req = { user: undefined, query: {} } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.getRecentEntries(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
  });

  // Input: limit query parameter provided
  // Expected status code: 200
  // Expected behavior: controller returns limited list of recent entries
  // Expected output: JSON envelope with entries count matching limit
  // Mock behavior: catalogRepository.findRecentByUserId spied to assert limit
  test('getRecentEntries returns recent observations with limit', async () => {
    const userId = new mongoose.Types.ObjectId();
    const entries = Array.from({ length: 3 }, () => ({ _id: new mongoose.Types.ObjectId() }));
    catalogFindRecentByUserIdMock.mockResolvedValue(entries as any);

    const req = {
      user: { _id: userId },
      query: { limit: '3' },
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.getRecentEntries(req, res, next);

    expect(catalogFindRecentByUserIdMock).toHaveBeenCalledWith(userId.toString(), 3);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ count: 3 }),
      })
    );
  });

  test('getRecentEntries handles repository errors', async () => {
    const failure = new Error('recent lookup failed');
    const userId = new mongoose.Types.ObjectId();
    catalogFindRecentByUserIdMock.mockRejectedValueOnce(failure);

    const req = {
      user: { _id: userId },
      query: {},
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.getRecentEntries(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
  });

  // API: DELETE /api/recognition/entry/:entryId (deleteEntry)
  // Input: request without authenticated user
  // Expected status code: 401
  // Expected behavior: responds immediately with authentication error
  // Expected output: { message: 'Authentication required' }
  // Mock behavior: none
  test('deleteEntry requires authentication', async () => {
    const req = {
      user: undefined,
      params: { entryId: new mongoose.Types.ObjectId().toString() },
    } as unknown as Request<{ entryId: string }>;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.deleteEntry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
  });

  // Input: request missing entryId parameter
  // Expected status code: 400
  // Expected behavior: controller rejects call before repository invocation
  // Expected output: JSON message "Entry ID is required"
  // Mock behavior: none
  test('deleteEntry requires entry id parameter', async () => {
    const req = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { entryId: '' },
    } as unknown as Request<{ entryId: string }>;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.deleteEntry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Entry ID is required' }));
  });

  // API: DELETE /api/recognition/entry/:entryId (deleteEntry)
  // Input: invalid ObjectId string
  // Expected status code: 400
  // Expected behavior: controller validates entryId format
  // Expected output: JSON message "Invalid entry ID"
  // Mock behavior: none
  test('deleteEntry rejects invalid object id format', async () => {
    const req = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { entryId: 'invalid' },
    } as unknown as Request<{ entryId: string }>;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.deleteEntry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid entry ID' }));
  });

  // API: DELETE /api/recognition/entry/:entryId (deleteEntry)
  // Input: repository signals not_found
  // Expected status code: 404
  // Expected behavior: controller propagates not_found result
  // Expected output: JSON message "Catalog entry not found"
  // Mock behavior: catalogRepository.deleteById mocked to return 'not_found'
  test('deleteEntry returns 404 when entry missing', async () => {
    const entryId = new mongoose.Types.ObjectId();
    const req = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { entryId: entryId.toString() },
    } as unknown as Request<{ entryId: string }>;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    catalogEntryListIdsMock.mockResolvedValue([]);
    catalogDeleteMock.mockResolvedValue('not_found');

    await recognitionController.deleteEntry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: DELETE /api/recognition/entry/:entryId (deleteEntry)
  // Input: repository signals forbidden
  // Expected status code: 403
  // Expected behavior: controller blocks deletion when user lacks permission
  // Expected output: JSON message "You do not have permission to delete this entry"
  // Mock behavior: catalogRepository.deleteById mocked to return 'forbidden'
  test('deleteEntry returns 403 when user lacks permission', async () => {
    const entryId = new mongoose.Types.ObjectId();
    const req = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { entryId: entryId.toString() },
    } as unknown as Request<{ entryId: string }>;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    catalogEntryListIdsMock.mockResolvedValue([]);
    catalogDeleteMock.mockResolvedValue('forbidden');

    await recognitionController.deleteEntry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // API: DELETE /api/recognition/entry/:entryId (deleteEntry)
  // Input: successful deletion with affected catalogs
  // Expected status code: 200
  // Expected behavior: controller emits catalog updates post deletion
  // Expected output: JSON success message
  // Mock behavior: catalogRepository.deleteById returns 'deleted'; catalogEntryLinkModel list/ details invoked; emitCatalogEntriesUpdated called
  test('deleteEntry emits updates after successful deletion', async () => {
    const entryId = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const user = { _id: new mongoose.Types.ObjectId() };
    const req = {
      user,
      params: { entryId: entryId.toString() },
    } as unknown as Request<{ entryId: string }>;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    catalogEntryListIdsMock.mockResolvedValue([catalogId]);
    catalogEntryDetailsMock.mockResolvedValue([]);
    catalogDeleteMock.mockResolvedValue('deleted');

    await recognitionController.deleteEntry(req, res, next);

    expect(emitCatalogEntriesUpdatedMock).toHaveBeenCalledWith(catalogId, expect.anything(), user._id);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('deleteEntry warns when broadcasting catalog updates fails', async () => {
    const userId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId().toString();
    const catalogId = new mongoose.Types.ObjectId();

    catalogEntryListIdsMock.mockResolvedValue([catalogId]);
    catalogDeleteMock.mockResolvedValue('deleted');
    catalogEntryDetailsMock.mockRejectedValueOnce(new Error('emit failure'));

    const req = {
      user: { _id: userId },
      params: { entryId },
    } as unknown as Request<{ entryId: string }>;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.deleteEntry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  test('deleteEntry forwards unexpected errors to next', async () => {
    const userId = new mongoose.Types.ObjectId();
    const entryId = new mongoose.Types.ObjectId().toString();
    const failure = new Error('deletion failed');

    catalogEntryListIdsMock.mockResolvedValue([new mongoose.Types.ObjectId()]);
    catalogDeleteMock.mockRejectedValueOnce(failure);

    const req = {
      user: { _id: userId },
      params: { entryId },
    } as unknown as Request<{ entryId: string }>;

    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await recognitionController.deleteEntry(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
  });
});
