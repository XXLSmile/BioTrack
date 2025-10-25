import axios from 'axios';

import logger from '../logger.util';

export interface ReverseGeocodeResult {
  city?: string;
  province?: string;
}

/**
 * Thin wrapper around Google Geocoding API to translate coordinates into a human readable city/province.
 * In case of failure or missing credentials the service logs and returns undefined so the calling flow can continue.
 */
class GeocodingService {
  private readonly apiKey: string | undefined;
  private readonly endpoint = 'https://maps.googleapis.com/maps/api/geocode/json';

  constructor() {
    this.apiKey = process.env.GOOGLE_GEOCODING_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
    if (!this.apiKey) {
      logger.warn('GeocodingService initialized without an API key. Location enrichment will be skipped.');
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | undefined> {
    if (!this.apiKey) {
      return undefined;
    }

    try {
      const response = await axios.get(this.endpoint, {
        params: {
          latlng: `${latitude},${longitude}`,
          key: this.apiKey,
          result_type: 'locality|administrative_area_level_2|administrative_area_level_1',
        },
        timeout: 8000,
      });

      if (response.data?.status !== 'OK') {
        logger.warn('Geocoding API returned non-OK status', {
          status: response.data?.status,
          errorMessage: response.data?.error_message,
        });
        return undefined;
      }

      const components: Array<{
        long_name: string;
        short_name: string;
        types: string[];
      }> = response.data.results?.[0]?.address_components ?? [];

      if (!components.length) {
        return undefined;
      }

      let city: string | undefined;
      let province: string | undefined;

      for (const component of components) {
        if (!city && component.types.includes('locality')) {
          city = component.long_name;
        } else if (!city && component.types.includes('administrative_area_level_2')) {
          city = component.long_name;
        }

        if (!province && component.types.includes('administrative_area_level_1')) {
          province = component.long_name;
        }
      }

      if (!city && !province) {
        return undefined;
      }

      return { city, province };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Geocoding API request failed', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
        });
      } else {
        logger.error('Unexpected error during reverse geocoding', error);
      }
      return undefined;
    }
  }
}

export const geocodingService = new GeocodingService();
