import axios from 'axios';
import FormData from 'form-data';
import crypto from 'crypto';
import logger from '../logger.util';
import {
  INaturalistResponse,
  RecognitionResult,
} from './recognition.types';
import { speciesRepository } from './species.model';

export class RecognitionService {
  private apiBaseUrl = 'https://api.inaturalist.org/v1';
  private userAgent = 'BioTrack/1.0';
  private zylaApiUrl = process.env.ZYLA_API_URL ?? 'https://zylalabs.com/api/6628/animal+image+detection+api/9728/animal+recognition';
  private zylaApiToken = process.env.ZYLA_API_KEY ?? '10848|57uHDVRiBVLHqWIkZvIQStLfpiEctQWUBsFfjNQi';

  /**
   * Recognize species from an image using iNaturalist API
   */
  async recognizeFromImage(
    imageBuffer: Buffer,
    latitude?: number,
    longitude?: number
  ): Promise<RecognitionResult> {
    try {
      logger.info('Starting species recognition via iNaturalist API');

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
        throw new Error('No species recognized from image');
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

      // Build recognition result
      const recognitionResult: RecognitionResult = {
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

      logger.info(`Species recognized: ${taxon.name} with confidence ${recognitionResult.confidence}`);
      return recognitionResult;
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

      logger.error('Error recognizing species:', error instanceof Error ? error.message : String(error));
      throw new Error('Failed to recognize species from image');
    }
  }

  async recognizeFromUrl(imageUrl: string): Promise<RecognitionResult> {
    try {
      logger.info('Starting species recognition via Zyla API');

      const response = await axios.post(
        this.zylaApiUrl,
        { image_url: imageUrl },
        {
          headers: {
            Authorization: `Bearer ${this.zylaApiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const outputs: Array<{ label: string; score?: number }> = response.data?.output ?? [];

      if (!response.data?.success || outputs.length === 0) {
        throw new Error('No species recognized from image');
      }

      const top = outputs[0];
      const label = top.label || 'Unknown species';
      const normalizedLabel = label.toLowerCase();

      const syntheticId = this.getStableId(normalizedLabel);

      await speciesRepository.findOrCreate({
        inaturalistId: syntheticId,
        scientificName: label,
        commonName: label,
        rank: 'species',
        taxonomy: 'Unknown',
        wikipediaUrl: undefined,
        imageUrl,
      });

      const recognitionResult: RecognitionResult = {
        species: {
          id: syntheticId,
          scientificName: label,
          commonName: label,
          rank: 'species',
          taxonomy: 'Unknown',
          wikipediaUrl: undefined,
          imageUrl,
        },
        confidence: top.score ?? 0,
        alternatives: outputs.slice(1, 4).map(candidate => ({
          scientificName: candidate.label,
          commonName: candidate.label,
          confidence: candidate.score ?? 0,
        })),
      };

      return recognitionResult;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Zyla API error:', {
          status: error.response?.status,
          message: error.message,
        });
      }

      logger.error('Error recognizing species:', error instanceof Error ? error.message : String(error));
      throw new Error('Failed to recognize species from image');
    }
  }

  private getStableId(label: string): number {
    const hash = crypto.createHash('sha256').update(label).digest('hex');
    return parseInt(hash.slice(0, 8), 16);
  }
}

export const recognitionService = new RecognitionService();
