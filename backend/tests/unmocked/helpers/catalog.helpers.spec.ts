import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { Request } from 'express';
import {
  buildCatalogEntriesResponse,
  resolveImageUrl,
} from '../../../src/helpers/catalog.helpers';
import { ICatalogEntryLink } from '../../../src/models/catalog/catalogEntryLink.model';
import { ICatalogEntry } from '../../../src/models/recognition/catalog.model';
import { ISpecies } from '../../../src/models/recognition/species.model';

describe('catalog.helpers', () => {
  describe('resolveImageUrl', () => {
    test('returns undefined when url is falsy', () => {
      expect(resolveImageUrl(null)).toBeUndefined();
      expect(resolveImageUrl(undefined)).toBeUndefined();
      expect(resolveImageUrl('')).toBeUndefined();
      expect(resolveImageUrl(0)).toBeUndefined();
      expect(resolveImageUrl(false)).toBeUndefined();
    });

    test('returns undefined when url string is empty after trim', () => {
      expect(resolveImageUrl('   ')).toBeUndefined();
      expect(resolveImageUrl('\t\n')).toBeUndefined();
    });

    test('returns original url when it is already absolute (http)', () => {
      const url = 'http://example.com/image.jpg';
      expect(resolveImageUrl(url)).toBe(url);
    });

    test('returns original url when it is already absolute (https)', () => {
      const url = 'https://example.com/image.jpg';
      expect(resolveImageUrl(url)).toBe(url);
    });

    test('returns original url when baseUrl is not provided', () => {
      const originalEnv = process.env.MEDIA_BASE_URL;
      delete process.env.MEDIA_BASE_URL;
      
      const url = '/relative/path/image.jpg';
      const result = resolveImageUrl(url);
      
      // Should return original if no MEDIA_BASE_URL and no context
      expect(result).toBe(url);
      
      if (originalEnv) {
        process.env.MEDIA_BASE_URL = originalEnv;
      }
    });

    test('resolves relative url with MEDIA_BASE_URL from env', () => {
      const originalEnv = process.env.MEDIA_BASE_URL;
      process.env.MEDIA_BASE_URL = 'https://media.example.com';
      
      const url = '/images/photo.jpg';
      const result = resolveImageUrl(url);
      
      expect(result).toBe('https://media.example.com/images/photo.jpg');
      
      if (originalEnv) {
        process.env.MEDIA_BASE_URL = originalEnv;
      } else {
        delete process.env.MEDIA_BASE_URL;
      }
    });

    test('resolves relative url with context protocol and host', () => {
      const originalEnv = process.env.MEDIA_BASE_URL;
      delete process.env.MEDIA_BASE_URL;
      
      const url = '/images/photo.jpg';
      const context = {
        protocol: 'https',
        host: 'api.example.com',
      };
      const result = resolveImageUrl(url, context);
      
      expect(result).toBe('https://api.example.com/images/photo.jpg');
      
      if (originalEnv) {
        process.env.MEDIA_BASE_URL = originalEnv;
      }
    });

    test('prefers MEDIA_BASE_URL over context', () => {
      const originalEnv = process.env.MEDIA_BASE_URL;
      process.env.MEDIA_BASE_URL = 'https://media.example.com';
      
      const url = '/images/photo.jpg';
      const context = {
        protocol: 'http',
        host: 'api.example.com',
      };
      const result = resolveImageUrl(url, context);
      
      expect(result).toBe('https://media.example.com/images/photo.jpg');
      
      if (originalEnv) {
        process.env.MEDIA_BASE_URL = originalEnv;
      } else {
        delete process.env.MEDIA_BASE_URL;
      }
    });

    test('handles URL construction errors gracefully', () => {
      const originalEnv = process.env.MEDIA_BASE_URL;
      delete process.env.MEDIA_BASE_URL;
      
      const url = '/images/photo.jpg';
      // Use a baseUrl that will cause URL construction to fail
      const context = {
        protocol: 'https',
        host: '',
      };
      const result = resolveImageUrl(url, context);
      
      // When host is empty, should return original url
      expect(result).toBe(url);
      
      if (originalEnv) {
        process.env.MEDIA_BASE_URL = originalEnv;
      }
    });

    test('handles empty MEDIA_BASE_URL', () => {
      const originalEnv = process.env.MEDIA_BASE_URL;
      process.env.MEDIA_BASE_URL = '   ';
      
      const url = '/images/photo.jpg';
      const result = resolveImageUrl(url);
      
      expect(result).toBe(url);
      
      if (originalEnv) {
        process.env.MEDIA_BASE_URL = originalEnv;
      } else {
        delete process.env.MEDIA_BASE_URL;
      }
    });

    test('handles context without protocol', () => {
      const originalEnv = process.env.MEDIA_BASE_URL;
      delete process.env.MEDIA_BASE_URL;
      
      const url = '/images/photo.jpg';
      const context = {
        host: 'api.example.com',
      };
      const result = resolveImageUrl(url, context);
      
      expect(result).toBe(url);
      
      if (originalEnv) {
        process.env.MEDIA_BASE_URL = originalEnv;
      }
    });

    test('handles context without host', () => {
      const originalEnv = process.env.MEDIA_BASE_URL;
      delete process.env.MEDIA_BASE_URL;
      
      const url = '/images/photo.jpg';
      const context = {
        protocol: 'https',
      };
      const result = resolveImageUrl(url, context);
      
      expect(result).toBe(url);
      
      if (originalEnv) {
        process.env.MEDIA_BASE_URL = originalEnv;
      }
    });
  });

  describe('buildCatalogEntriesResponse', () => {
    const createMockLink = (
      entryId: mongoose.Types.ObjectId,
      speciesId?: mongoose.Types.ObjectId | ISpecies,
      addedBy?: mongoose.Types.ObjectId,
      addedAt?: Date,
      imageUrl?: string
    ): ICatalogEntryLink => {
      const entry = {
        _id: entryId,
        userId: new mongoose.Types.ObjectId(),
        speciesId: (speciesId || new mongoose.Types.ObjectId()) as any,
        imageUrl: imageUrl || '/images/test.jpg',
        latitude: 0,
        longitude: 0,
        confidence: 0.9,
        imageHash: 'test-hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: 'Test entry',
      } as any;

      return {
        _id: new mongoose.Types.ObjectId(),
        catalog: new mongoose.Types.ObjectId(),
        entry: entry,
        addedBy: addedBy || new mongoose.Types.ObjectId(),
        addedAt: addedAt || new Date(),
      } as ICatalogEntryLink;
    };

    test('filters out links with null entry', () => {
      const fallbackUserId = new mongoose.Types.ObjectId();
      const links: ICatalogEntryLink[] = [
        createMockLink(new mongoose.Types.ObjectId()),
        {
          _id: new mongoose.Types.ObjectId(),
          catalog: new mongoose.Types.ObjectId(),
          entry: null as any,
          addedBy: new mongoose.Types.ObjectId(),
          addedAt: new Date(),
        } as ICatalogEntryLink,
        createMockLink(new mongoose.Types.ObjectId()),
      ];

      const result = buildCatalogEntriesResponse(links, fallbackUserId);
      
      expect(result).toHaveLength(2);
    });

    test('handles entry with toObject method', () => {
      const fallbackUserId = new mongoose.Types.ObjectId();
      const entryId = new mongoose.Types.ObjectId();
      const entry = {
        _id: entryId,
        userId: new mongoose.Types.ObjectId(),
        speciesId: new mongoose.Types.ObjectId(),
        imageUrl: '/images/test.jpg',
        location: { latitude: 0, longitude: 0 },
        timestamp: new Date(),
        notes: 'Test',
        toObject: () => ({
          _id: entryId,
          userId: new mongoose.Types.ObjectId(),
          speciesId: new mongoose.Types.ObjectId(),
          imageUrl: '/images/test.jpg',
          location: { latitude: 0, longitude: 0 },
          timestamp: new Date(),
          notes: 'Test',
        }),
      };

      const links: ICatalogEntryLink[] = [
        {
          _id: new mongoose.Types.ObjectId(),
          catalog: new mongoose.Types.ObjectId(),
          entry: entry as any,
          addedBy: new mongoose.Types.ObjectId(),
          addedAt: new Date(),
        } as ICatalogEntryLink,
      ];

      const result = buildCatalogEntriesResponse(links, fallbackUserId);
      
      expect(result).toHaveLength(1);
      expect(result[0].entry._id).toEqual(entryId);
    });

    test('handles species with toObject method', () => {
      const fallbackUserId = new mongoose.Types.ObjectId();
      const speciesId = new mongoose.Types.ObjectId();
      const species = {
        _id: speciesId,
        commonName: 'Test Species',
        scientificName: 'Testus species',
        imageUrl: '/species/test.jpg',
        toObject: () => ({
          _id: speciesId,
          commonName: 'Test Species',
          scientificName: 'Testus species',
          imageUrl: '/species/test.jpg',
        }),
      };

      const entryId = new mongoose.Types.ObjectId();
      const entry = {
        _id: entryId,
        userId: new mongoose.Types.ObjectId(),
        speciesId: species,
        imageUrl: '',
        latitude: 0,
        longitude: 0,
        confidence: 0.9,
        imageHash: 'test-hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: 'Test',
      } as any;

      const links: ICatalogEntryLink[] = [
        {
          _id: new mongoose.Types.ObjectId(),
          catalog: new mongoose.Types.ObjectId(),
          entry: entry as any,
          addedBy: new mongoose.Types.ObjectId(),
          addedAt: new Date(),
        } as ICatalogEntryLink,
      ];

      const result = buildCatalogEntriesResponse(links, fallbackUserId);
      
      expect(result).toHaveLength(1);
      expect(result[0].entry.speciesId).toEqual(speciesId);
    });

    test('handles species as ObjectId', () => {
      const fallbackUserId = new mongoose.Types.ObjectId();
      const speciesId = new mongoose.Types.ObjectId();
      const entryId = new mongoose.Types.ObjectId();
      const entry = {
        _id: entryId,
        userId: new mongoose.Types.ObjectId(),
        speciesId: speciesId,
        imageUrl: '/images/test.jpg',
        latitude: 0,
        longitude: 0,
        confidence: 0.9,
        imageHash: 'test-hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: 'Test',
      } as any;

      const links: ICatalogEntryLink[] = [
        {
          _id: new mongoose.Types.ObjectId(),
          catalog: new mongoose.Types.ObjectId(),
          entry: entry as any,
          addedBy: new mongoose.Types.ObjectId(),
          addedAt: new Date(),
        } as ICatalogEntryLink,
      ];

      const result = buildCatalogEntriesResponse(links, fallbackUserId);
      
      expect(result).toHaveLength(1);
      expect(result[0].entry.speciesId).toEqual(speciesId);
    });

    test('uses species imageUrl when entry imageUrl is empty', () => {
      const originalEnv = process.env.MEDIA_BASE_URL;
      delete process.env.MEDIA_BASE_URL;
      
      const fallbackUserId = new mongoose.Types.ObjectId();
      const speciesId = new mongoose.Types.ObjectId();
      const species = {
        _id: speciesId,
        commonName: 'Test Species',
        imageUrl: '/species/test.jpg',
      };

      const entryId = new mongoose.Types.ObjectId();
      const entry = {
        _id: entryId,
        userId: new mongoose.Types.ObjectId(),
        speciesId: species,
        imageUrl: '',
        latitude: 0,
        longitude: 0,
        confidence: 0.9,
        imageHash: 'test-hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: 'Test',
      } as any;

      const links: ICatalogEntryLink[] = [
        {
          _id: new mongoose.Types.ObjectId(),
          catalog: new mongoose.Types.ObjectId(),
          entry: entry as any,
          addedBy: new mongoose.Types.ObjectId(),
          addedAt: new Date(),
        } as ICatalogEntryLink,
      ];

      const result = buildCatalogEntriesResponse(links, fallbackUserId);
      
      expect(result).toHaveLength(1);
      // imageUrl will be resolved, so check it contains the species image path
      expect(result[0].entry.imageUrl).toContain('/species/test.jpg');
      
      if (originalEnv) {
        process.env.MEDIA_BASE_URL = originalEnv;
      }
    });

    test('deduplicates entries with same id and addedAt', () => {
      const fallbackUserId = new mongoose.Types.ObjectId();
      const entryId = new mongoose.Types.ObjectId();
      const addedAt = new Date('2024-01-01T00:00:00Z');

      const links: ICatalogEntryLink[] = [
        createMockLink(entryId, undefined, undefined, addedAt),
        createMockLink(entryId, undefined, undefined, addedAt),
        createMockLink(new mongoose.Types.ObjectId()),
      ];

      const result = buildCatalogEntriesResponse(links, fallbackUserId);
      
      expect(result).toHaveLength(2);
    });

    test('handles addedBy as ObjectId', () => {
      const fallbackUserId = new mongoose.Types.ObjectId();
      const addedById = new mongoose.Types.ObjectId();
      const links: ICatalogEntryLink[] = [
        createMockLink(new mongoose.Types.ObjectId(), undefined, addedById),
      ];

      const result = buildCatalogEntriesResponse(links, fallbackUserId);
      
      expect(result).toHaveLength(1);
      expect(result[0].addedBy).toEqual(addedById);
    });

    test('handles addedBy as object with _id', () => {
      const fallbackUserId = new mongoose.Types.ObjectId();
      const addedById = new mongoose.Types.ObjectId();
      const addedByDoc = { _id: addedById };
      const baseLink = createMockLink(new mongoose.Types.ObjectId());

      const links: ICatalogEntryLink[] = [
        {
          ...baseLink,
          addedBy: addedByDoc as any,
        } as ICatalogEntryLink,
      ];

      const result = buildCatalogEntriesResponse(links, fallbackUserId);
      
      expect(result).toHaveLength(1);
      expect(result[0].addedBy).toEqual(addedById);
    });

    test('uses fallbackUserId when addedBy is invalid', () => {
      const fallbackUserId = new mongoose.Types.ObjectId();
      const baseLink = createMockLink(new mongoose.Types.ObjectId());
      const links: ICatalogEntryLink[] = [
        {
          ...baseLink,
          addedBy: {} as any,
        } as ICatalogEntryLink,
      ];

      const result = buildCatalogEntriesResponse(links, fallbackUserId);
      
      expect(result).toHaveLength(1);
      expect(result[0].addedBy).toEqual(fallbackUserId);
    });

    test('handles Request object as context', () => {
      const fallbackUserId = new mongoose.Types.ObjectId();
      const mockRequest = {
        protocol: 'https',
        get: jest.fn((header: string) => {
          if (header === 'host') return 'api.example.com';
          return null;
        }),
      } as unknown as Request;

      const links: ICatalogEntryLink[] = [
        createMockLink(new mongoose.Types.ObjectId(), undefined, undefined, undefined, '/images/test.jpg'),
      ];

      const result = buildCatalogEntriesResponse(links, fallbackUserId, mockRequest);
      
      expect(result).toHaveLength(1);
      expect(mockRequest.get).toHaveBeenCalledWith('host');
    });

    test('handles ImageContext object', () => {
      const originalEnv = process.env.MEDIA_BASE_URL;
      delete process.env.MEDIA_BASE_URL;
      
      const fallbackUserId = new mongoose.Types.ObjectId();
      const context = {
        protocol: 'https',
        host: 'api.example.com',
      };

      const links: ICatalogEntryLink[] = [
        createMockLink(new mongoose.Types.ObjectId(), undefined, undefined, undefined, '/images/test.jpg'),
      ];

      const result = buildCatalogEntriesResponse(links, fallbackUserId, context);
      
      expect(result).toHaveLength(1);
      expect(result[0].entry.imageUrl).toBe('https://api.example.com/images/test.jpg');
      
      if (originalEnv) {
        process.env.MEDIA_BASE_URL = originalEnv;
      }
    });

    test('handles species with scientificName but no commonName', () => {
      const fallbackUserId = new mongoose.Types.ObjectId();
      const speciesId = new mongoose.Types.ObjectId();
      const species = {
        _id: speciesId,
        scientificName: 'Testus species',
        imageUrl: '/species/test.jpg',
      };

      const entryId = new mongoose.Types.ObjectId();
      const entry = {
        _id: entryId,
        userId: new mongoose.Types.ObjectId(),
        speciesId: species,
        imageUrl: '',
        latitude: 0,
        longitude: 0,
        confidence: 0.9,
        imageHash: 'test-hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: 'Test',
      } as any;

      const links: ICatalogEntryLink[] = [
        {
          _id: new mongoose.Types.ObjectId(),
          catalog: new mongoose.Types.ObjectId(),
          entry: entry as any,
          addedBy: new mongoose.Types.ObjectId(),
          addedAt: new Date(),
        } as ICatalogEntryLink,
      ];

      const result = buildCatalogEntriesResponse(links, fallbackUserId);
      
      expect(result).toHaveLength(1);
      // Should normalize speciesId to ObjectId when species has _id
      const resultSpeciesId = result[0].entry.speciesId;
      expect(resultSpeciesId).toBeDefined();
      // The species object should be normalized to just the _id
      if (resultSpeciesId instanceof mongoose.Types.ObjectId) {
        expect(resultSpeciesId).toEqual(speciesId);
      } else if (resultSpeciesId && typeof resultSpeciesId === 'object' && '_id' in resultSpeciesId) {
        expect((resultSpeciesId as any)._id).toEqual(speciesId);
      }
    });

    test('handles addedAt as Date object', () => {
      const fallbackUserId = new mongoose.Types.ObjectId();
      const addedAt = new Date('2024-01-01T00:00:00Z');
      const links: ICatalogEntryLink[] = [
        createMockLink(new mongoose.Types.ObjectId(), undefined, undefined, addedAt),
      ];

      const result = buildCatalogEntriesResponse(links, fallbackUserId);
      
      expect(result).toHaveLength(1);
      expect(result[0].linkedAt).toEqual(addedAt);
    });

    test('handles addedAt as string', () => {
      const fallbackUserId = new mongoose.Types.ObjectId();
      const addedAt = '2024-01-01T00:00:00Z';
      const baseLink = createMockLink(new mongoose.Types.ObjectId());
      const links: ICatalogEntryLink[] = [
        {
          ...baseLink,
          addedAt: addedAt as any,
        } as ICatalogEntryLink,
      ];

      const result = buildCatalogEntriesResponse(links, fallbackUserId);
      
      expect(result).toHaveLength(1);
      // The function converts string to Date internally
      expect(result[0].linkedAt).toBeDefined();
      // Check it's a valid date (either Date object or can be converted)
      const dateValue = result[0].linkedAt instanceof Date ? result[0].linkedAt : new Date(result[0].linkedAt);
      expect(dateValue.getTime()).toBeGreaterThan(0);
    });
  });
});

