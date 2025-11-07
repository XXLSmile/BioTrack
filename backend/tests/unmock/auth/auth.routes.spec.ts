import { describe, expect, test, jest } from '@jest/globals';
import request from 'supertest';

jest.mock('../../../src/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

import { createApp } from '../../../src/app';

const app = createApp();

// Interface POST /auth/signup
describe('Unmocked: POST /auth/signup', () => {
  // Input: {}
  // Expected status code: 400
  // Expected behavior: validator rejects missing idToken
  // Expected output: JSON error message
  test('rejects missing idToken payload', async () => {
    const response = await request(app).post('/api/auth/signup').send({});

    expect(response.status).toBe(400);
    expect(response.body?.message).toBeDefined();
  });
});

// Interface POST /auth/signin
describe('Unmocked: POST /auth/signin', () => {
  // Input: {}
  // Expected status code: 400
  // Expected behavior: validator rejects missing idToken
  // Expected output: JSON error message
  test('rejects missing idToken payload', async () => {
    const response = await request(app).post('/api/auth/signin').send({});

    expect(response.status).toBe(400);
    expect(response.body?.message).toBeDefined();
  });
});

// Interface POST /auth/logout
describe('Unmocked: POST /auth/logout', () => {
  // Input: POST request without body
  // Expected status code: 200
  // Expected behavior: controller returns static success message
  // Expected output: message "User logged out successfully"
  test('returns 200 on logout', async () => {
    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('User logged out successfully');
  });
});
