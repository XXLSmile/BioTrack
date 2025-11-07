import mongoose from 'mongoose';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../../../src/logger.util', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
  },
}));

import logger from '../../../src/logger.util';
import { buildCatalogEntriesResponse, resolveImageUrl } from '../../../src/catalog/catalog.helpers';
import { ICatalogEntry } from '../../../src/recognition/catalog.model';
import { ICatalogEntryLink } from '../../../src/catalog/catalogEntryLink.model';

const getLoggerWarn = () => (logger.warn as jest.Mock);

describe('Mocked: catalog.helpers', () => {
  const originalEnv = process.env.MEDIA_BASE_URL;

  beforeEach(() => {
    getLoggerWarn().mockReset();
    process.env.MEDIA_BASE_URL = originalEnv;
  });

  // API: resolveImageUrl
  // Input: relative img path with MEDIA_BASE_URL configured
  // Expected behavior: trims env var and prefixes path
  // Expected output: absolute URL composed from MEDIA_BASE_URL
  test('resolveImageUrl honors MEDIA_BASE_URL override', () => {
    process.env.MEDIA_BASE_URL = ' https://cdn.example.com ';

    const result = resolveImageUrl('/images/foo.jpg');

    expect(result).toBe('https://cdn.example.com/images/foo.jpg');
  });

  // API: resolveImageUrl
  // Input: relative path, context containing protocol/host
  // Expected behavior: builds base URL from context when env unset
  // Expected output: absolute URL derived from context
  test('resolveImageUrl builds URL from request context when env unset', () => {
    process.env.MEDIA_BASE_URL = '';
    const context = { protocol: 'https', host: 'app.local' };

    const result = resolveImageUrl('media/picture.png', context);

    expect(result).toBe('https://app.local/media/picture.png');
  });

  // API: resolveImageUrl
  // Input: malformed base segment that breaks URL constructor
  // Expected behavior: logs warning and returns original value
  // Expected output: original string
  test('resolveImageUrl warns and returns original when URL resolution fails', () => {
    process.env.MEDIA_BASE_URL = '://bad-base';

    const result = resolveImageUrl('%%%');

    expect(result).toBe('%%%');
    expect(getLoggerWarn()).toHaveBeenCalled();
  });

  // API: buildCatalogEntriesResponse
  // Input: catalog links with duplicate entry+timestamp combinations
  // Expected behavior: deduplicates entries, normalizes species/image fields, resolves image URL via request context
  // Expected output: array with single normalized entry including resolved imageUrl and species text
  test('buildCatalogEntriesResponse deduplicates links and normalizes species fields', () => {
    process.env.MEDIA_BASE_URL = '';
    const entryId = new mongoose.Types.ObjectId();
    const speciesId = new mongoose.Types.ObjectId();
    const addedAt = new Date('2024-01-01T00:00:00.000Z');
    const fallbackUserId = new mongoose.Types.ObjectId();

    const entryDoc = {
      _id: entryId,
      imageUrl: undefined,
      speciesId: {
        _id: speciesId,
        commonName: 'Snowy Owl',
        imageUrl: '/species/snowy-owl.jpg',
      },
      toObject: jest.fn().mockReturnValue({
        _id: entryId,
        speciesId: {
          _id: speciesId,
          commonName: 'Snowy Owl',
          imageUrl: '/species/snowy-owl.jpg',
        },
      }),
    } as unknown as ICatalogEntry;

    const links: ICatalogEntryLink[] = [
      {
        _id: new mongoose.Types.ObjectId(),
        catalog: new mongoose.Types.ObjectId(),
        entry: entryDoc as any,
        addedBy: { _id: fallbackUserId },
        addedAt,
      } as unknown as ICatalogEntryLink,
      {
        _id: new mongoose.Types.ObjectId(),
        catalog: new mongoose.Types.ObjectId(),
        entry: entryDoc as any,
        addedBy: fallbackUserId,
        addedAt,
      } as unknown as ICatalogEntryLink,
    ];

    const responses = buildCatalogEntriesResponse(
      links,
      fallbackUserId,
      { protocol: 'https', host: 'example.org' }
    );

    expect(responses).toHaveLength(1);
    expect(responses[0].entry.speciesId?.toString()).toBe(speciesId.toString());
    expect(responses[0].entry.imageUrl).toBe('https://example.org/species/snowy-owl.jpg');
    expect(responses[0].linkedAt).toBe(addedAt);
    expect(responses[0].addedBy.toString()).toBe(fallbackUserId.toString());
  });

  // API: buildCatalogEntriesResponse
  // Input: link lacking entry document and addedBy metadata
  // Expected behavior: skips missing entries and falls back to provided user id
  // Expected output: empty array since entry undefined
  test('buildCatalogEntriesResponse skips missing entry docs and falls back to provided user id', () => {
    const fallbackUserId = new mongoose.Types.ObjectId();
    const links: ICatalogEntryLink[] = [
      {
        _id: new mongoose.Types.ObjectId(),
        catalog: new mongoose.Types.ObjectId(),
        entry: undefined as any,
        addedBy: undefined as any,
        addedAt: new Date(),
      } as unknown as ICatalogEntryLink,
    ];

    const responses = buildCatalogEntriesResponse(links, fallbackUserId);

    expect(responses).toEqual([]);
  });
});
