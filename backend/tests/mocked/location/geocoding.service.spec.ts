import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../../../src/utils/logger.util', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedLogger = require('../../../src/utils/logger.util').default as {
  warn: jest.Mock;
  error: jest.Mock;
};

jest.mock('axios');
import axios from 'axios';
import { geocodingService } from '../../../src/services/location/geocoding.service';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const originalEnv = { ...process.env };

describe('Mocked: geocodingService', () => {
  beforeEach(() => {
    Object.assign(process.env, originalEnv);
    process.env.GOOGLE_GEOCODING_API_KEY = 'test-key';
    mockedAxios.get.mockReset();
    Object.defineProperty(mockedAxios, 'isAxiosError', {
      value: (error: unknown): error is any => Boolean((error as any)?.isAxiosError),
      configurable: true,
    });
    mockedLogger.warn.mockReset();
    mockedLogger.error.mockReset();
    (geocodingService as any).apiKey = undefined;
    (geocodingService as any).envChecked = false;
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  // API: GeocodingService.reverseGeocode
  // Input: valid latitude/longitude with API returning OK and detailed components
  // Expected status code: n/a (service returns object)
  // Expected behavior: extracts locality and province from address components
  // Expected output: { city: 'Vancouver', province: 'British Columbia' }
  test('reverseGeocode normalizes city and province on successful lookup', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'OK',
        results: [
          {
            address_components: [
              { long_name: 'Vancouver', types: ['locality'] },
              { long_name: 'Greater Vancouver', types: ['administrative_area_level_2'] },
              { long_name: 'British Columbia', types: ['administrative_area_level_1'] },
            ],
          },
        ],
      },
    } as any);

    const result = await geocodingService.reverseGeocode(49.2827, -123.1207);

    expect(mockedAxios.get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      params: expect.objectContaining({ latlng: '49.2827,-123.1207' }),
      timeout: 8000,
    }));
    expect(result).toEqual({ city: 'Vancouver', province: 'British Columbia' });
  });

  // API: GeocodingService.reverseGeocode
  // Input: API response with non-OK status
  // Expected status code: n/a
  // Expected behavior: logs warning and returns undefined
  // Expected output: undefined
  test('reverseGeocode returns undefined when API yields non-OK status', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { status: 'ZERO_RESULTS', error_message: 'no matches' },
    } as any);

    const result = await geocodingService.reverseGeocode(0, 0);

    expect(result).toBeUndefined();
    expect(mockedLogger.warn).toHaveBeenCalledWith('Geocoding API returned non-OK status', {
      status: 'ZERO_RESULTS',
      errorMessage: 'no matches',
    });
  });

  // API: GeocodingService.forwardGeocode
  // Input: address string with API returning formatted result
  // Expected status code: n/a
  // Expected behavior: returns coordinates plus normalized fields
  // Expected output: ForwardGeocodeResult with latitude, longitude, city, province, formattedAddress
  test('forwardGeocode returns coordinates and metadata on success', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'OK',
        results: [
          {
            formatted_address: '123 Main St, Vancouver, BC',
            geometry: { location: { lat: 49.0, lng: -123.0 } },
            address_components: [
              { long_name: 'Vancouver', types: ['locality'] },
              { long_name: 'British Columbia', types: ['administrative_area_level_1'] },
            ],
          },
        ],
      },
    } as any);

    const result = await geocodingService.forwardGeocode(' 123 Main St ');

    expect(mockedAxios.get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      params: expect.objectContaining({ address: '123 Main St' }),
      timeout: 8000,
    }));
    expect(result).toEqual({
      latitude: 49.0,
      longitude: -123.0,
      city: 'Vancouver',
      province: 'British Columbia',
      formattedAddress: '123 Main St, Vancouver, BC',
    });
  });

  // API: GeocodingService.forwardGeocode
  // Input: blank address string or missing API key
  // Expected behavior: returns undefined without calling axios
  // Expected output: undefined
  test('forwardGeocode short-circuits when address empty or API key missing', async () => {
    process.env.GOOGLE_GEOCODING_API_KEY = '';
    (geocodingService as any).apiKey = undefined;
    (geocodingService as any).envChecked = false;

    const result = await geocodingService.forwardGeocode('   ');

    expect(result).toBeUndefined();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  // API: GeocodingService.forwardGeocode
  // Input: axios throws network error
  // Expected behavior: logs error and returns undefined
  // Expected output: undefined
  test('forwardGeocode logs and returns undefined when axios rejects', async () => {
    const axiosError = Object.assign(new Error('timeout'), { isAxiosError: true });
    mockedAxios.get.mockRejectedValueOnce(axiosError);

    const result = await geocodingService.forwardGeocode('Vancouver');

    expect(result).toBeUndefined();
    expect(mockedLogger.error).toHaveBeenCalledWith(
      'Geocoding API request failed during forward lookup',
      expect.objectContaining({ message: 'timeout', query: 'Vancouver' })
    );
  });

  // API: GeocodingService.reverseGeocode
  // Input: missing API key in environment
  // Expected status code: n/a
  // Expected behavior: logs warning and returns undefined without calling axios
  // Expected output: undefined
  test('reverseGeocode logs warning when API key missing', async () => {
    delete process.env.GOOGLE_GEOCODING_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    (geocodingService as any).apiKey = undefined;
    (geocodingService as any).envChecked = false;

    const result = await geocodingService.reverseGeocode(1, 1);

    expect(result).toBeUndefined();
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedLogger.warn).toHaveBeenCalledWith(
      'GeocodingService initialized without an API key. Location enrichment will be skipped.'
    );
  });

  // API: GeocodingService.reverseGeocode
  // Input: API OK response without address components
  // Expected status code: n/a
  // Expected behavior: returns undefined when components missing
  // Expected output: undefined
  test('reverseGeocode returns undefined when components missing', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { status: 'OK', results: [{ address_components: [] }] },
    } as any);

    const result = await geocodingService.reverseGeocode(10, 20);

    expect(result).toBeUndefined();
  });

  // API: GeocodingService.reverseGeocode
  // Input: axios rejects with non-Axios error
  // Expected status code: n/a
  // Expected behavior: logs unexpected error message
  // Expected output: undefined
  test('reverseGeocode logs unexpected error when non-axios rejection occurs', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('boom'));

    const result = await geocodingService.reverseGeocode(1, 2);

    expect(result).toBeUndefined();
    expect(mockedLogger.error).toHaveBeenCalledWith(
      'Unexpected error during reverse geocoding',
      expect.any(Error)
    );
  });

  // API: GeocodingService.forwardGeocode
  // Input: API response with non-OK status
  // Expected status code: n/a
  // Expected behavior: warns and returns undefined
  // Expected output: undefined
  test('forwardGeocode logs warning when status not OK', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { status: 'ZERO_RESULTS', error_message: 'none', results: [] },
    } as any);

    const result = await geocodingService.forwardGeocode('Nowhere');

    expect(result).toBeUndefined();
    expect(mockedLogger.warn).toHaveBeenCalledWith(
      'Geocoding API returned non-OK status for forward lookup',
      expect.objectContaining({ status: 'ZERO_RESULTS', query: 'Nowhere' })
    );
  });

  // API: GeocodingService.forwardGeocode
  // Input: response missing geometry
  // Expected status code: n/a
  // Expected behavior: returns undefined without logging error
  // Expected output: undefined
  test('forwardGeocode returns undefined when geometry missing', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'OK',
        results: [
          {
            formatted_address: '123',
            address_components: [],
          },
        ],
      },
    } as any);

    const result = await geocodingService.forwardGeocode('123 Main');

    expect(result).toBeUndefined();
  });

  // API: GeocodingService.forwardGeocode
  // Input: non-Axios error thrown
  // Expected status code: n/a
  // Expected behavior: logs unexpected error and returns undefined
  // Expected output: undefined
  test('forwardGeocode logs unexpected error for non-axios failures', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('oops'));

    const result = await geocodingService.forwardGeocode('Vancouver, BC');

    expect(result).toBeUndefined();
    expect(mockedLogger.error).toHaveBeenCalledWith(
      'Unexpected error during forward geocoding',
      expect.any(Error)
    );
  });

  test('reverseGeocode reuses cached API key without re-reading env', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'OK',
        results: [
          {
            address_components: [
              { long_name: 'City', types: ['locality'] },
              { long_name: 'Province', types: ['administrative_area_level_1'] },
            ],
          },
        ],
      },
    } as any);
    (geocodingService as any).apiKey = 'cached-key';
    (geocodingService as any).envChecked = true;

    const result = await geocodingService.reverseGeocode(1, 2);

    expect(result?.city).toBe('City');
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      params: expect.objectContaining({ key: 'cached-key' }),
    }));
  });

  test('reverseGeocode returns city from administrative_area_level_2 when locality missing', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'OK',
        results: [
          {
            address_components: [
              { long_name: 'District', types: ['administrative_area_level_2'] },
              { long_name: 'Province', types: ['administrative_area_level_1'] },
            ],
          },
        ],
      },
    } as any);

    const result = await geocodingService.reverseGeocode(1, 2);

    expect(result).toEqual({ city: 'District', province: 'Province' });
  });

  test('reverseGeocode returns undefined when components lack city and province', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'OK',
        results: [
          {
            address_components: [{ long_name: 'Route', types: ['route'] }],
          },
        ],
      },
    } as any);

    const result = await geocodingService.reverseGeocode(1, 2);

    expect(result).toBeUndefined();
  });

  test('reverseGeocode logs axios errors when request fails', async () => {
    const axiosError = Object.assign(new Error('timeout'), {
      isAxiosError: true,
      response: { status: 500, data: { message: 'oops' } },
    });
    mockedAxios.get.mockRejectedValueOnce(axiosError);

    const result = await geocodingService.reverseGeocode(1, 2);

    expect(result).toBeUndefined();
    expect(mockedLogger.error).toHaveBeenCalledWith(
      'Geocoding API request failed',
      expect.objectContaining({
        message: 'timeout',
        status: 500,
        data: { message: 'oops' },
      })
    );
  });

  test('forwardGeocode uses administrative_area_level_2 when locality is absent', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'OK',
        results: [
          {
            formatted_address: '123 Address',
            geometry: { location: { lat: 1, lng: 2 } },
            address_components: [
              { long_name: 'District', types: ['administrative_area_level_2'] },
              { long_name: 'Province', types: ['administrative_area_level_1'] },
            ],
          },
        ],
      },
    } as any);

    const result = await geocodingService.forwardGeocode('Address');

    expect(result?.city).toBe('District');
    expect(result?.province).toBe('Province');
  });
});
