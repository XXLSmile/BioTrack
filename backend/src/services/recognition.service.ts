import axios from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger.util';
import { RecognitionResult } from '../types/recognition.types';
import { speciesRepository } from '../models/recognition/species.model';

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
        { url: imageUrl },
        {
          headers: {
            Authorization: `Bearer ${this.zylaApiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const outputs: { label: string; score?: number }[] = response.data?.output ?? [];

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

      const normalizedMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error recognizing species:', normalizedMessage);

      if (typeof normalizedMessage === 'string') {
        const recognizedMessages = [
          'No species recognized from image',
          'Rate limit exceeded',
          'Request timed out while contacting upstream',
        ];

        if (recognizedMessages.some(message => normalizedMessage.includes(message))) {
          throw error;
        }
      }

      throw new Error('Failed to recognize species from image');
    }
  }

  private getStableId(label: string): number {
    const hash = crypto.createHash('sha256').update(label).digest('hex');
    const unsigned = parseInt(hash.slice(0, 8), 16);
    const stableId = unsigned & 0x7fffffff; // clamp to 31 bits to fit signed 32-bit int
    if (stableId !== 0) {
      return stableId;
    }
    const fallback = parseInt(hash.slice(8, 16), 16) & 0x7fffffff;
    return fallback !== 0 ? fallback : 1;
  }
}

export const recognitionService = new RecognitionService();
