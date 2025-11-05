import request from 'supertest';

jest.mock('../../src/firebase', () => ({
  __esModule: true,
  messaging: {
    send: jest.fn().mockResolvedValue(undefined),
  },
  default: {
    messaging: {
      send: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

jest.mock('../../src/socket/socket.manager', () => ({
  emitCatalogDeleted: jest.fn(),
  emitCatalogEntriesUpdated: jest.fn(),
  emitCatalogMetadataUpdated: jest.fn(),
  initializeSocketServer: jest.fn(),
}));

jest.mock('../../src/auth/auth.service', () => ({
  authService: {
    signUpWithGoogle: jest.fn(),
    signInWithGoogle: jest.fn(),
    logout: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { authService } from '../../src/auth/auth.service';

const app = createApp();

// Interface POST /auth/signup
describe('Unmocked: POST /auth/signup', () => {
  // Input: no idToken field
  // Expected status code: 400
  // Expected behavior: request rejected by validation middleware
  // Expected output: error message about validation
  test('rejects missing idToken payload', async () => {
    const response = await request(app).post('/api/auth/signup').send({});

    expect(response.status).toBe(400);
    expect(response.body?.message).toBeDefined();
  });
});

describe('Mocked: POST /auth/signup', () => {
  // Input: valid idToken string
  // Expected status code: 201
  // Expected behavior: authService.signUpWithGoogle invoked and response returned
  // Expected output: auth result payload
  // Mock behavior: authService.signUpWithGoogle resolves to fake user/token
  test('returns 201 when signup succeeds', async () => {
    const mockResult = {
      token: 'mock-token',
      user: { _id: '123', email: 'user@example.com' },
    };
    (authService.signUpWithGoogle as jest.Mock).mockResolvedValueOnce(
      mockResult
    );

    const response = await request(app)
      .post('/api/auth/signup')
      .send({ idToken: 'valid-token' });

    expect(response.status).toBe(201);
    expect(response.body?.data).toStrictEqual(mockResult);
    expect(authService.signUpWithGoogle).toHaveBeenCalledWith('valid-token');
  });
});

// Interface POST /auth/signin
describe('Unmocked: POST /auth/signin', () => {
  // Input: empty body
  // Expected status code: 400
  // Expected behavior: validation fails and request rejected
  // Expected output: validation error message
  test('rejects missing idToken payload', async () => {
    const response = await request(app).post('/api/auth/signin').send({});

    expect(response.status).toBe(400);
  });
});

describe('Mocked: POST /auth/signin', () => {
  // Input: idToken present
  // Expected status code: 200
  // Expected behavior: authService.signInWithGoogle invoked
  // Expected output: auth result
  // Mock behavior: authService.signInWithGoogle resolves to fake data
  test('returns 200 when signin succeeds', async () => {
    const mockResult = {
      token: 'mock-token',
      user: { _id: '456', email: 'user2@example.com' },
    };
    (authService.signInWithGoogle as jest.Mock).mockResolvedValueOnce(
      mockResult
    );

    const response = await request(app)
      .post('/api/auth/signin')
      .send({ idToken: 'valid-token' });

    expect(response.status).toBe(200);
    expect(response.body?.data).toStrictEqual(mockResult);
  });
});

// Interface POST /auth/logout
describe('Unmocked: POST /auth/logout', () => {
  // Input: simple POST request
  // Expected status code: 200
  // Expected behavior: logout succeeds (no auth required)
  // Expected output: success message
  test('returns 200 on logout', async () => {
    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('User logged out successfully');
  });
});

describe('Mocked: POST /auth/logout', () => {
  // Input: POST request
  // Expected status code: 200
  // Expected behavior: authService.logout invoked
  // Expected output: success message
  // Mock behavior: authService.logout rejects to simulate failure
  test('propagates service errors', async () => {
    (authService.logout as jest.Mock).mockRejectedValueOnce(
      new Error('logout failed')
    );

    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(500);
  });
});
