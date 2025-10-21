import axios from 'axios';
import FormData from 'form-data';
import logger from '../logger.util';
import {
  INaturalistResponse,
  RecognitionResult,
} from './recognition.types';
import { speciesRepository } from './species.model';

export class RecognitionService {
  private apiBaseUrl = 'https://api.inaturalist.org/v1';
  private userAgent = 'BioTrack/1.0';

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

      // DEVELOPMENT MODE: Use mock data for testing
      if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_IDENTIFICATION === 'true') {
        logger.info('Using mock recognition for development');
        return this.getMockRecognitionResult();
      }

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

  /**
   * Mock recognition result for development/testing
   */
  private getMockRecognitionResult(): RecognitionResult {
    const mockSpecies = [
      {
        id: 12345,
        scientificName: 'Corvus brachyrhynchos',
        commonName: 'American Crow',
        rank: 'species',
        taxonomy: 'Aves',
        wikipediaUrl: 'https://en.wikipedia.org/wiki/American_crow',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/American_Crow.jpg/256px-American_Crow.jpg',
      },
      {
        id: 12346,
        scientificName: 'Turdus migratorius',
        commonName: 'American Robin',
        rank: 'species',
        taxonomy: 'Aves',
        wikipediaUrl: 'https://en.wikipedia.org/wiki/American_robin',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Turdus-migratorius-002.jpg/256px-Turdus-migratorius-002.jpg',
      },
      {
        id: 12347,
        scientificName: 'Cardinalis cardinalis',
        commonName: 'Northern Cardinal',
        rank: 'species',
        taxonomy: 'Aves',
        wikipediaUrl: 'https://en.wikipedia.org/wiki/Northern_cardinal',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Cardinalis_cardinalis_-Illinois-8.jpg/256px-Cardinalis_cardinalis_-Illinois-8.jpg',
      }
    ];

    // Randomly select a species for variety
    const selectedSpecies = mockSpecies[Math.floor(Math.random() * mockSpecies.length)];

    return {
      species: selectedSpecies,
      confidence: 0.85 + Math.random() * 0.1, // 0.85-0.95 confidence
      alternatives: mockSpecies
        .filter(s => s.id !== selectedSpecies.id)
        .slice(0, 3)
        .map(species => ({
          scientificName: species.scientificName,
          commonName: species.commonName,
          confidence: 0.3 + Math.random() * 0.4, // 0.3-0.7 confidence
        })),
    };
  }
}

export const recognitionService = new RecognitionService();
