import mongoose from 'mongoose';
import { afterEach, describe, expect, jest, test } from '@jest/globals';

import { recognitionService } from '../../../src/recognition/recognition.service';
import { speciesRepository } from '../../../src/recognition/species.model';

const runLiveSuite = process.env.RUN_ZYLA_LIVE_TESTS === 'true';

jest.setTimeout(45_000);

describe('RecognitionService (live Zyla API)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test(
    runLiveSuite
      ? 'recognizes raccoon from hosted image'
      : 'recognizes raccoon from hosted image (set RUN_ZYLA_LIVE_TESTS=true to exercise)',
    async () => {
      if (!runLiveSuite) {
        console.warn('RUN_ZYLA_LIVE_TESTS not enabled, skipping live API call.');
        return;
      }

      const speciesDoc = {
        _id: new mongoose.Types.ObjectId(),
        inaturalistId: 42,
        scientificName: 'Procyon lotor',
        commonName: 'raccoon',
        rank: 'species',
      };

      jest.spyOn(speciesRepository, 'findOrCreate').mockResolvedValue(speciesDoc as any);

      const imageUrl = 'http://4.206.208.211:80/uploads/images/racoon.jpg';

      const result = await recognitionService.recognizeFromUrl(imageUrl);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.species.commonName?.toLowerCase()).toContain('raco');
      expect(result.species.scientificName.toLowerCase()).toContain('rac');
    }
  );
});
