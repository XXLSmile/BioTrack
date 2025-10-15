import axios from 'axios';
import FormData from 'form-data';
import logger from '../logger.util';
import {
  INaturalistResponse,
  IdentificationResult,
} from './identify.types';
import { speciesRepository } from './species.model';

export class IdentifyService {
  private apiBaseUrl = 'https://api.inaturalist.org/v1';
  private userAgent = 'BioTrack/1.0';

  /**
   * Identify species from an image using iNaturalist API
   */
  async identifyFromImage(
    imageBuffer: Buffer,
    latitude?: number,
    longitude?: number
  ): Promise<IdentificationResult> {
    try {
      logger.info('Starting species identification via iNaturalist API');

      // Create form data for the API request
      const formData = new FormData();
      formData.append('image', imageBuffer, {
        filename: 'observation.jpg',
        contentType: 'image/jpeg',
      });

      // Add location if provided (improves accuracy)
      if (latitude !== undefined && longitude !== undefined) {
        formData.append('lat', latitude.toString());
        formData.append('lng', longitude.toString());
      }

      // Call iNaturalist computer vision API
      const response = await axios.post<INaturalistResponse>(
        `${this.apiBaseUrl}/computervision/score_image`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'User-Agent': this.userAgent,
          },
          timeout: 30000, // 30 second timeout
        }
      );

      if (!response.data.results || response.data.results.length === 0) {
        throw new Error('No species identified from image');
      }

      // Process the top result
      const topResult = response.data.results[0];
      const taxon = topResult.taxon;

      // Store species in database
      await speciesRepository.findOrCreate({
        inaturalistId: taxon.id,
        scientificName: taxon.name,
        commonName: taxon.preferred_common_name || taxon.common_name?.name,
        rank: taxon.rank,
        taxonomy: taxon.iconic_taxon_name,
        wikipediaUrl: taxon.wikipedia_url,
        imageUrl: taxon.default_photo?.medium_url,
      });

      // Build identification result
      const identificationResult: IdentificationResult = {
        species: {
          id: taxon.id,
          scientificName: taxon.name,
          commonName: taxon.preferred_common_name || taxon.common_name?.name,
          rank: taxon.rank,
          taxonomy: taxon.iconic_taxon_name,
          wikipediaUrl: taxon.wikipedia_url,
          imageUrl: taxon.default_photo?.medium_url,
        },
        confidence: topResult.score || topResult.combined_score || 0,
        alternatives: response.data.results.slice(1, 4).map(result => ({
          scientificName: result.taxon.name,
          commonName: result.taxon.preferred_common_name || result.taxon.common_name?.name,
          confidence: result.score || result.combined_score || 0,
        })),
      };

      logger.info(`Species identified: ${taxon.name} with confidence ${identificationResult.confidence}`);
      return identificationResult;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        logger.error('iNaturalist API error:', {
          status: error.response?.status,
          message: error.message,
        });

        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }

        if (error.response?.status === 422) {
          throw new Error('Invalid image format or image processing failed.');
        }
      }

      logger.error('Error identifying species:', error instanceof Error ? error.message : String(error));
      throw new Error('Failed to identify species from image');
    }
  }
}

export const identifyService = new IdentifyService();

