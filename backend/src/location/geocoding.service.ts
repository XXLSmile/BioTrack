import axios from 'axios';

import logger from '../logger.util';

export interface ReverseGeocodeResult {
  city?: string;
  province?: string;
}

export interface ForwardGeocodeResult {
  latitude: number;
  longitude: number;
  city?: string;
  province?: string;
  formattedAddress?: string;
}

/**
 * Thin wrapper around Google Geocoding API to translate coordinates into a human readable city/province.
 * In case of failure or missing credentials the service logs and returns undefined so the calling flow can continue.
 */
class GeocodingService {
  private apiKey: string | undefined;
  private readonly endpoint = 'https://maps.googleapis.com/maps/api/geocode/json';
  private envChecked = false;

  private loadApiKey() {
    if (this.envChecked && this.apiKey) {
      return;
    }

    this.apiKey = process.env.GOOGLE_GEOCODING_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
    this.envChecked = true;

    if (!this.apiKey) {
      logger.warn('GeocodingService initialized without an API key. Location enrichment will be skipped.');
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | undefined> {
    this.loadApiKey();

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

  async forwardGeocode(address: string): Promise<ForwardGeocodeResult | undefined> {
    this.loadApiKey();

    const query = address?.trim();
    if (!this.apiKey || !query) {
      return undefined;
    }

    try {
      const response = await axios.get(this.endpoint, {
        params: {
          address: query,
          key: this.apiKey,
        },
        timeout: 8000,
      });

      if (response.data?.status !== 'OK' || !response.data.results?.length) {
        logger.warn('Geocoding API returned non-OK status for forward lookup', {
          status: response.data?.status,
          errorMessage: response.data?.error_message,
          query,
        });
        return undefined;
      }

      const result = response.data.results[0];
      const location = result?.geometry?.location;

      if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
        return undefined;
      }

      let city: string | undefined;
      let province: string | undefined;

      for (const component of result.address_components ?? []) {
        if (!city && component.types.includes('locality')) {
          city = component.long_name;
        } else if (!city && component.types.includes('administrative_area_level_2')) {
          city = component.long_name;
        }

        if (!province && component.types.includes('administrative_area_level_1')) {
          province = component.long_name;
        }
      }

      return {
        latitude: location.lat,
        longitude: location.lng,
        city,
        province,
        formattedAddress: result.formatted_address,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Geocoding API request failed during forward lookup', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          query,
        });
      } else {
        logger.error('Unexpected error during forward geocoding', error);
      }
      return undefined;
    }
  }
}

export const geocodingService = new GeocodingService();
