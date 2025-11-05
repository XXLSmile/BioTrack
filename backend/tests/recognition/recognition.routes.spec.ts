import path from 'path';
import fs from 'fs';
import request from 'supertest';
import mongoose from 'mongoose';

jest.mock('../../src/socket/socket.manager', () => ({
  emitCatalogEntriesUpdated: jest.fn(),
  emitCatalogMetadataUpdated: jest.fn(),
  emitCatalogDeleted: jest.fn(),
  initializeSocketServer: jest.fn(),
}));

jest.mock('../../src/firebase', () => ({
  __esModule: true,
  messaging: {
    send: jest.fn().mockResolvedValue(undefined),
  },
  default: {
    messaging: {
      send: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

jest.mock('../../src/location/geocoding.service', () => ({
  geocodingService: {
    reverseGeocode: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/recognition/recognition.service', () => ({
  recognitionService: {
    recognizeFromUrl: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { recognitionService } from '../../src/recognition/recognition.service';
import { catalogRepository } from '../../src/recognition/catalog.model';
import { speciesRepository } from '../../src/recognition/species.model';
import { catalogEntryLinkModel } from '../../src/catalog/catalogEntryLink.model';
import { createTestUser, authHeaderForUser } from '../utils/testHelpers';

const app = createApp();

const createSpecies = async () =>
  speciesRepository.findOrCreate({
    inaturalistId: Math.floor(Math.random() * 100000) + 1,
    scientificName: `Test Species ${Date.now()}`,
    commonName: 'Test Species',
    rank: 'species',
  });

const createCatalogEntry = async (userId: mongoose.Types.ObjectId) => {
  const species = await createSpecies();
  return catalogRepository.create({
    userId: userId.toString(),
    speciesId: species._id.toString(),
    imageUrl: '/uploads/images/test.jpg',
    imageMimeType: 'image/jpeg',
    confidence: 0.9,
    imageHash: `${Date.now()}-${Math.random()}`,
    notes: 'Test entry',
  });
};

// Interface POST /recognition
describe('Unmocked: POST /recognition', () => {
  // Input: no file or imageUrl
  // Expected status code: 400
  // Expected behavior: validation rejects
  // Expected output: message requesting image
  test('returns 400 when no image provided', async () => {
    const response = await request(app).post('/api/recognition');
    expect(response.status).toBe(400);
  });
});

describe('Mocked: POST /recognition', () => {
  // Input: imageUrl provided in body
  // Expected status code: 200
  // Expected behavior: returns recognition result
  // Expected output: data with recognition payload
  // Mock behavior: recognitionService.recognizeFromUrl resolves to test data
  test('recognizes species from URL when service succeeds', async () => {
    (recognitionService.recognizeFromUrl as jest.Mock).mockResolvedValueOnce({
      species: {
        id: 1,
        scientificName: 'Testus Species',
        commonName: 'Test Species',
      },
      confidence: 0.95,
    });

    const response = await request(app)
      .post('/api/recognition')
      .field('imageUrl', 'https://example.com/image.jpg');

    expect(response.status).toBe(200);
    expect(response.body?.data?.recognition?.species?.scientificName).toBe(
      'Testus Species'
    );
  });
});

// Interface POST /recognition/save
describe('Unmocked: POST /recognition/save', () => {
  // Input: missing imagePath
  // Expected status code: 400
  // Expected behavior: request rejected
  // Expected output: message requiring imagePath
  test('returns 400 when imagePath missing', async () => {
    const user = await createTestUser();

    const response = await request(app)
      .post('/api/recognition/save')
      .set(authHeaderForUser(user))
      .send({ recognition: {}, catalogId: new mongoose.Types.ObjectId().toString() });

    expect(response.status).toBe(400);
  });
});

describe('Mocked: POST /recognition/save', () => {
  // Input: valid payload with imagePath and recognition
  // Expected status code: 200
  // Expected behavior: returns saved entry data
  // Expected output: data.entry present
  // Mock behavior: underlying repositories mocked to simulate success
  test('saves recognition successfully when dependencies succeed', async () => {
    const user = await createTestUser();
    const tempDir = path.join(__dirname, '..', '..', 'tmp-tests');
    fs.mkdirSync(tempDir, { recursive: true });
    const tempFilePath = path.join(tempDir, 'image.jpg');
    fs.writeFileSync(tempFilePath, 'fake-image');

    const recognitionPayload = {
      species: {
        id: 1,
        scientificName: 'Mock Species',
        commonName: 'Mock',
      },
      confidence: 0.9,
      alternatives: [],
    };

    const existsSpy = jest
      .spyOn(fs, 'existsSync')
      .mockImplementationOnce(() => true);
    const readSpy = jest
      .spyOn(fs, 'readFileSync')
      .mockImplementationOnce(() => Buffer.from('fake-image'));
    const renameSpy = jest
      .spyOn(fs, 'renameSync')
      .mockImplementationOnce(() => undefined);
    const mkdirSpy = jest
      .spyOn(fs, 'mkdirSync')
      .mockImplementation(() => undefined);

    const findByHashSpy = jest
      .spyOn(catalogRepository, 'findByHash')
      .mockResolvedValueOnce(null);
    const createSpy = jest
      .spyOn(catalogRepository, 'create')
      .mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        userId: user._id,
        speciesId: new mongoose.Types.ObjectId(),
        imageUrl: '/uploads/images/test.jpg',
      } as any);
    const speciesSpy = jest
      .spyOn(speciesRepository, 'findOrCreate')
      .mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        scientificName: 'Mock Species',
      } as any);
    const linkSpy = jest
      .spyOn(catalogEntryLinkModel, 'linkEntry')
      .mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        catalog: new mongoose.Types.ObjectId(),
        entry: new mongoose.Types.ObjectId(),
        addedBy: user._id,
        addedAt: new Date(),
      } as any);
    const listSpy = jest
      .spyOn(catalogEntryLinkModel, 'listEntriesWithDetails')
      .mockResolvedValueOnce([]);

    try {
      const response = await request(app)
        .post('/api/recognition/save')
        .set(authHeaderForUser(user))
        .send({
          imagePath: '/uploads/tmp/image.jpg',
          recognition: recognitionPayload,
        });

      expect(response.status).toBe(201);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
      existsSpy.mockRestore();
      readSpy.mockRestore();
      renameSpy.mockRestore();
      mkdirSpy.mockRestore();
      findByHashSpy.mockRestore();
      createSpy.mockRestore();
      speciesSpy.mockRestore();
      linkSpy.mockRestore();
      listSpy.mockRestore();
    }
  });
});

// Interface GET /recognition/catalog
describe('Unmocked: GET /recognition/catalog', () => {
  // Input: user with catalog entry
  // Expected status code: 200
  // Expected behavior: returns entries array
  // Expected output: data.count >= 1
  test('returns catalog entries for user', async () => {
    const user = await createTestUser();
    await createCatalogEntry(user._id);

    const response = await request(app)
      .get('/api/recognition/catalog')
      .set(authHeaderForUser(user));

    expect(response.status).toBe(200);
    expect(response.body?.data?.count).toBeGreaterThanOrEqual(1);
  });
});

describe('Mocked: GET /recognition/catalog', () => {
  // Input: authenticated request
  // Expected status code: 500
  // Expected behavior: forwards repository error
  // Expected output: internal server error
  // Mock behavior: catalogRepository.findByUserId throws
  test('returns 500 when retrieval fails', async () => {
    const user = await createTestUser();
    const spy = jest
      .spyOn(catalogRepository, 'findByUserId')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .get('/api/recognition/catalog')
        .set(authHeaderForUser(user));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /recognition/recent
describe('Unmocked: GET /recognition/recent', () => {
  // Input: user with catalog entry
  // Expected status code: 200
  // Expected behavior: returns recent entries
  // Expected output: array with count
  test('returns recent entries for user', async () => {
    const user = await createTestUser();
    await createCatalogEntry(user._id);

    const response = await request(app)
      .get('/api/recognition/recent')
      .set(authHeaderForUser(user));

    expect(response.status).toBe(200);
  });
});

describe('Mocked: GET /recognition/recent', () => {
  // Input: authenticated request
  // Expected status code: 500
  // Expected behavior: surfaces errors
  // Expected output: 500
  // Mock behavior: catalogRepository.findRecentByUserId throws
  test('returns 500 when recent lookup fails', async () => {
    const user = await createTestUser();
    const spy = jest
      .spyOn(catalogRepository, 'findRecentByUserId')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .get('/api/recognition/recent')
        .set(authHeaderForUser(user));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /recognition/image/:entryId
describe('Unmocked: GET /recognition/image/:entryId', () => {
  // Input: invalid entry id
  // Expected status code: 404
  // Expected behavior: entry missing
  // Expected output: message 'Catalog entry not found'
  test('returns 404 for unknown entry', async () => {
    const response = await request(app).get(
      `/api/recognition/image/${new mongoose.Types.ObjectId().toString()}`
    );

    expect(response.status).toBe(404);
  });
});

describe('Mocked: GET /recognition/image/:entryId', () => {
  // Input: entry with image data
  // Expected status code: 200
  // Expected behavior: streams image data
  // Expected output: response body equals buffer
  // Mock behavior: catalogRepository.findById returns entry with image data
  test('returns stored image data', async () => {
    const buffer = Buffer.from('mock-image');
    const spy = jest
      .spyOn(catalogRepository, 'findById')
      .mockResolvedValueOnce({
        imageData: buffer,
        imageMimeType: 'image/jpeg',
      } as any);

    try {
      const response = await request(app).get(
        `/api/recognition/image/${new mongoose.Types.ObjectId().toString()}`
      );

      expect(response.status).toBe(200);
      expect(Buffer.from(response.body).equals(buffer)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface DELETE /recognition/entry/:entryId
describe('Unmocked: DELETE /recognition/entry/:entryId', () => {
  // Input: invalid entry id format
  // Expected status code: 400
  // Expected behavior: validation error
  // Expected output: message 'Invalid entry ID'
  test('rejects invalid entry id format', async () => {
    const user = await createTestUser();

    const response = await request(app)
      .delete('/api/recognition/entry/not-a-valid-id')
      .set(authHeaderForUser(user));

    expect(response.status).toBe(400);
  });
});

describe('Mocked: DELETE /recognition/entry/:entryId', () => {
  // Input: valid entry id
  // Expected status code: 200
  // Expected behavior: deletion success message
  // Expected output: message 'Catalog entry deleted successfully'
  // Mock behavior: catalogRepository.deleteById returns 'deleted'
  test('deletes entry successfully when repository returns deleted', async () => {
    const user = await createTestUser();
    const entryId = new mongoose.Types.ObjectId().toString();

    const deleteSpy = jest
      .spyOn(catalogRepository, 'deleteById')
      .mockResolvedValueOnce('deleted');
    const listSpy = jest
      .spyOn(catalogEntryLinkModel, 'listCatalogIdsForEntry')
      .mockResolvedValueOnce([]);

    try {
      const response = await request(app)
        .delete(`/api/recognition/entry/${entryId}`)
        .set(authHeaderForUser(user));

      expect(response.status).toBe(200);
      expect(response.body?.message).toBe(
        'Catalog entry deleted successfully'
      );
    } finally {
      deleteSpy.mockRestore();
      listSpy.mockRestore();
    }
  });
});
