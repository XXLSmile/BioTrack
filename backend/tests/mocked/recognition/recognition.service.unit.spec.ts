import axios from 'axios';
import crypto from 'crypto';
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

  // API: RecognitionService.recognizeFromUrl
  // Input: Zyla response with success flag and two candidate labels (top=Raccoon)
  // Expected behavior: service normalizes top hit, persists species via repository, and returns structured RecognitionResult
  // Expected output: result.species.commonName === 'Raccoon', confidence 0.94, one alternative
  // Mock behavior: axios.post mocked to return success payload; speciesRepository.findOrCreate observed
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

  test('recognizeFromUrl applies fallbacks when label and scores missing', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        success: true,
        output: [
          { label: '', score: undefined },
          { label: 'Alt species' },
        ],
      },
    } as any);

    speciesFindOrCreateMock.mockResolvedValue({ _id: 'species-id' });

    const result = await recognitionService.recognizeFromUrl('https://example.com/unknown.jpg');

    expect(result.species.scientificName).toBe('Unknown species');
    expect(result.alternatives?.[0]?.confidence).toBe(0);
    expect(speciesFindOrCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scientificName: 'Unknown species',
      })
    );
  });

  // API: RecognitionService.recognizeFromUrl
  // Input: Zyla response with success false and empty output array
  // Expected behavior: service throws generic failure error
  // Expected output: Promise rejection with message "Failed to recognize species from image"
  // Mock behavior: axios.post mocked to return empty output; speciesRepository.not invoked
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

  test('throws when API succeeds but returns empty outputs', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        success: true,
        output: [],
      },
    } as any);

    await expect(
      recognitionService.recognizeFromUrl('https://example.com/empty-success.jpg')
    ).rejects.toThrow('Failed to recognize species from image');
  });

  test('throws when API payload omits output field', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: {
        success: true,
      },
    } as any);

    await expect(
      recognitionService.recognizeFromUrl('https://example.com/missing-output.jpg')
    ).rejects.toThrow('Failed to recognize species from image');
  });

  // API: RecognitionService.recognizeFromUrl
  // Input: axios throws network error (simulated timeout)
  // Expected behavior: service catches axios error, logs, and rethrows standardized message
  // Expected output: Promise rejection "Failed to recognize species from image"
  // Mock behavior: axios.post rejects; axios.isAxiosError returns true to exercise logging branch
  test('wraps axios errors', async () => {
    const error = new Error('timeout');
    jest.spyOn(axios, 'post').mockRejectedValue(error);
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    await expect(
      recognitionService.recognizeFromUrl('https://example.com/timeout.jpg')
    ).rejects.toThrow('Failed to recognize species from image');
  });

  test('logs generic error when rejection is non-Error value', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue('catastrophic failure');
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(false);

    await expect(
      recognitionService.recognizeFromUrl('https://example.com/non-error.jpg')
    ).rejects.toThrow('Failed to recognize species from image');
  });

  // Interface RecognitionService.getStableId
  test('getStableId falls back when primary hash segment is zero', () => {
    const digestSpy = jest.spyOn(crypto, 'createHash').mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockImplementationOnce(() => '0000000000000000ffffffffffffffffffffffffffffffffffffffffffffffff'),
    } as any);

    const stableId = (recognitionService as any).getStableId('zero-hash');

    expect(stableId).toBeGreaterThan(0);
    expect(digestSpy).toHaveBeenCalledWith('sha256');
    digestSpy.mockRestore();
  });

  test('getStableId returns 1 when both hash segments zero', () => {
    const digestSpy = jest.spyOn(crypto, 'createHash').mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockImplementationOnce(() => '00000000000000000000000000000000ffffffffffffffffffffffffffffffff'),
    } as any);

    const stableId = (recognitionService as any).getStableId('double-zero');

    expect(stableId).toBe(1);
    digestSpy.mockRestore();
  });
});
