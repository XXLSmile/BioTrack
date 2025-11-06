import axios from 'axios';

jest.mock('axios');
jest.mock('../../src/logger.util', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../src/recognition/species.model', () => ({
  speciesRepository: {
    findOrCreate: jest.fn(),
  },
}));

import { recognitionService } from '../../src/recognition/recognition.service';
import { speciesRepository } from '../../src/recognition/species.model';

const mockedAxiosPost = axios.post as jest.Mock;
const mockedFindOrCreate = speciesRepository.findOrCreate as jest.Mock;

afterEach(() => {
  jest.clearAllMocks();
});

// Interface RecognitionService.recognizeFromUrl
describe('Mocked: RecognitionService.recognizeFromUrl', () => {
  // Input: valid image URL with API success response
  // Expected status code: N/A (service returns data)
  // Expected behavior: speciesRepository invoked and recognition result returned
  // Expected output: RecognitionResult with species + alternatives
  test('returns recognition result when third-party API succeeds', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: {
        success: true,
        output: [
          { label: 'Bald Eagle', score: 0.97 },
          { label: 'Golden Eagle', score: 0.56 },
        ],
      },
    });

    const result = await recognitionService.recognizeFromUrl(
      'https://example.com/image.jpg'
    );

    expect(result.species.scientificName).toBe('Bald Eagle');
    expect(result.confidence).toBe(0.97);
    expect(result.alternatives?.length).toBe(1);
    expect(mockedFindOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ scientificName: 'Bald Eagle' })
    );
  });

  // Input: API returns success false
  // Expected behavior: service throws "No species recognized from image"
  // Expected output: rejection with specific message
  test('throws when API does not return any species', async () => {
    mockedAxiosPost.mockResolvedValueOnce({
      data: {
        success: false,
        output: [],
      },
    });

    await expect(
      recognitionService.recognizeFromUrl('https://example.com/image.jpg')
    ).rejects.toThrow('Failed to recognize species from image');

    expect(mockedFindOrCreate).not.toHaveBeenCalled();
  });
  // Input: axios throws network error
  // Expected behavior: service wraps error and throws generic failure
  // Expected output: rejection "Failed to recognize species from image"
  // Mock behavior: axios.post rejects with Error
  test('wraps axios errors into generic failure', async () => {
    mockedAxiosPost.mockRejectedValueOnce(new Error('network failure'));

    await expect(
      recognitionService.recognizeFromUrl('https://example.com/image.jpg')
    ).rejects.toThrow('Failed to recognize species from image');

    expect(mockedFindOrCreate).not.toHaveBeenCalled();
  });
});
