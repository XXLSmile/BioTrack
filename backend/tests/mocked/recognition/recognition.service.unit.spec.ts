import axios from 'axios';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { recognitionService } from '../../../src/recognition/recognition.service';
import { speciesRepository } from '../../../src/recognition/species.model';

jest.mock('../../../src/recognition/species.model', () => ({
  speciesRepository: {
    findOrCreate: jest.fn(),
  },
}));

jest.mock('../../../src/logger.util', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const speciesFindOrCreateMock = speciesRepository.findOrCreate as jest.MockedFunction<
  (data: Record<string, unknown>) => Promise<any>
>;

describe('RecognitionService (unit)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    speciesFindOrCreateMock.mockReset();
  });

  test('maps Zyla response to recognition result', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        success: true,
        output: [
          { label: 'Raccoon', score: 0.94 },
          { label: 'Cat', score: 0.03 },
        ],
      },
    } as any);

    speciesFindOrCreateMock.mockResolvedValue({
      _id: 'species-id',
      inaturalistId: 123,
      scientificName: 'Raccoon',
    });

    const result = await recognitionService.recognizeFromUrl('https://example.com/raccoon.jpg');

    expect(result.species.commonName).toBe('Raccoon');
    expect(result.confidence).toBeCloseTo(0.94);
    expect(result.alternatives).toHaveLength(1);
    expect(speciesFindOrCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scientificName: 'Raccoon',
        commonName: 'Raccoon',
      })
    );
  });

  test('throws when API returns no results', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        success: false,
        output: [],
      },
    } as any);

    await expect(
      recognitionService.recognizeFromUrl('https://example.com/empty.jpg')
    ).rejects.toThrow('Failed to recognize species from image');
  });

  test('wraps axios errors', async () => {
    const error = new Error('timeout');
    jest.spyOn(axios, 'post').mockRejectedValue(error);
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    await expect(
      recognitionService.recognizeFromUrl('https://example.com/timeout.jpg')
    ).rejects.toThrow('Failed to recognize species from image');
  });
});
