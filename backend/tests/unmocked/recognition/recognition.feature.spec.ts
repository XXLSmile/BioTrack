import http from 'http';
import request from 'supertest';
import { beforeAll, describe, expect, jest, test } from '@jest/globals';

import { createApp } from '../../../src/core/app';
import { initializeSocketServer } from '../../../src/infrastructure/socket.manager';
/**
 * Unmocked recognition test that calls the real upstream API with a real image URL.
 *
 * This spec is intentionally minimal and is guarded by an env flag so it does not
 * run in CI by default. To enable the real call locally:
 *
 *   RUN_REAL_RECOGNITION_TESTS=true ZYLA_API_KEY=... npm test -- recognition.feature.spec.ts
 */

const app = createApp();
const server = http.createServer(app);

// Initialize Socket.IO server so catalog events are actually emitted instead of skipped.
initializeSocketServer(server);

const api = request(server);

// Public nature photo that the upstream service can download (or override via env).
const MEDIA_BASE_URL = process.env.MEDIA_BASE_URL ?? 'http://4.206.208.211:80/uploads/images';
const DEFAULT_RECOGNITION_IMAGE_URL = `${MEDIA_BASE_URL}/dc606ab876ac356ace4cc107d20646ca.jpg`;
const MISSING_RECOGNITION_IMAGE_URL = `${MEDIA_BASE_URL}/014ca3681f74d0c087486c0b10dd453c.jpg`;

describe('API (unmocked): /api/recognition with real upstream service', () => {
  beforeAll(() => {
    // Allow extra time for real network + upstream API latency.
    jest.setTimeout(30_000);
  });

  test('POST /api/recognition calls real recognition service with hosted imageUrl', async () => {
    const response = await api
      .post('/api/recognition')
      .set('Content-Type', 'application/json')
      .send({ imageUrl: DEFAULT_RECOGNITION_IMAGE_URL });

    // We expect a successful call when API key and upstream are healthy.
    expect(response.status).toBe(200);
    expect(response.body?.data?.recognition).toBeDefined();
    expect(response.body?.data?.recognition?.species?.scientificName).toBe(
      'House Sparrow',
    );
    expect(response.body?.data?.recognition?.confidence).toBeGreaterThan(0);
  });

  test('POST /api/recognition returns 404 when recognition fails for provided image', async () => {
    const response = await api
      .post('/api/recognition')
      .set('Content-Type', 'application/json')
      .send({ imageUrl: MISSING_RECOGNITION_IMAGE_URL });

    expect(response.status).toBe(404);
    expect(response.body?.message).toContain('Could not recognize');
  });
});
