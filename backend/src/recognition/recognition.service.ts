import axios from 'axios';
import crypto from 'crypto';
import logger from '../logger.util';
import { RecognitionResult } from './recognition.types';
import { speciesRepository } from './species.model';

export class RecognitionService {
  private zylaApiUrl =
    process.env.ZYLA_API_URL ??
    'https://zylalabs.com/api/6628/animal+image+detection+api/9728/animal+recognition';
  private zylaApiToken =
    process.env.ZYLA_API_KEY ?? '10848|57uHDVRiBVLHqWIkZvIQStLfpiEctQWUBsFfjNQi';

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
