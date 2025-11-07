import { describe, expect, it, beforeAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { performance } from 'perf_hooks';

import { createApp } from '../../src/app';
import { recognitionService } from '../../src/recognition/recognition.service';
import { RecognitionResult } from '../../src/recognition/recognition.types';

const mockRecognition: RecognitionResult = {
  species: {
    id: 1010,
    scientificName: 'Setophaga coronata',
    commonName: 'Yellow-rumped Warbler',
    rank: 'species',
    taxonomy: 'Aves',
    imageUrl: 'https://example.com/warbler.jpg',
  },
  confidence: 0.91,
  alternatives: [
    { scientificName: 'Carduelis tristis', commonName: 'Goldfinch', confidence: 0.6 },
  ],
};

const payloadMatrix = [
  {
    label: '1MB payload',
    body: {
      imageUrl: 'https://cdn.test/images/warbler-1mb.jpg',
      latitude: 48.4284,
      longitude: -123.3656,
    },
  },
  {
    label: '3MB payload',
    body: {
      imageUrl: 'https://cdn.test/images/warbler-3mb.jpg',
      latitude: 49.2827,
      longitude: -123.1207,
    },
  },
  {
    label: '5MB payload',
    body: {
      imageUrl: 'https://cdn.test/images/warbler-5mb.jpg',
      latitude: 50.4452,
      longitude: -104.6189,
    },
  },
];

describe('NFR: Recognition latency', () => {
  const latencyBudgetMs = 10_000;
  let app = createApp();

  beforeAll(() => {
    app = createApp();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(payloadMatrix)('%s completes within 10 seconds', async ({ body }) => {
    jest.spyOn(recognitionService, 'recognizeFromUrl').mockResolvedValue(mockRecognition);

    const start = performance.now();
    const response = await request(app)
      .post('/api/recognition')
      .set('Content-Type', 'application/json')
      .send(body);
    const durationMs = performance.now() - start;

    expect(response.status).toBe(200);
    expect(response.body?.data?.recognition?.species?.scientificName).toBe(
      mockRecognition.species.scientificName
    );
    expect(durationMs).toBeLessThanOrEqual(latencyBudgetMs);
  });
});
