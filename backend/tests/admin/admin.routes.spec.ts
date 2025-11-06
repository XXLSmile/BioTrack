import request from 'supertest';
import mongoose from 'mongoose';

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

import { createApp } from '../../src/app';
import { createTestUser } from '../utils/testHelpers';
import { userModel } from '../../src/user/user.model';

const app = createApp();

// Interface GET /admin/users
describe('Unmocked: GET /admin/users', () => {
  // Input: database with at least one user
  // Expected status code: 200
  // Expected behavior: returns list of users
  // Expected output: count >= 1
  test('lists users successfully', async () => {
    await createTestUser();

    const response = await request(app).get('/api/admin/users');

    expect(response.status).toBe(200);
    expect(response.body?.count).toBeGreaterThanOrEqual(1);
  });
});

describe('Mocked: GET /admin/users', () => {
  // Input: request for user list
  // Expected status code: 500
  // Expected behavior: surfaces database error
  // Expected output: message 'Failed to fetch users'
  // Mock behavior: mongoose.model('User').find rejects
  test('returns 500 when fetch fails', async () => {
    const mongooseLib = require('mongoose');
    const User = mongooseLib.model('User');
    const spy = jest
      .spyOn(User, 'find')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app).get('/api/admin/users');

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /admin/users/:userId
describe('Unmocked: GET /admin/users/:userId', () => {
  // Input: existing user id
  // Expected status code: 200
  // Expected behavior: returns user data
  // Expected output: data.user present
  test('returns specific user', async () => {
    const user = await createTestUser();

    const response = await request(app).get(
      `/api/admin/users/${user._id.toString()}`
    );

    expect(response.status).toBe(200);
    expect(response.body?.data?._id).toBe(user._id.toString());
  });
});

describe('Mocked: GET /admin/users/:userId', () => {
  // Input: user id
  // Expected status code: 500
  // Expected behavior: surfaces repository error
  // Expected output: internal server error
  // Mock behavior: userModel.findById throws
  test('returns 500 when lookup fails', async () => {
    const spy = jest
      .spyOn(userModel, 'findById')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app).get(
        `/api/admin/users/${new mongoose.Types.ObjectId().toString()}`
      );

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /admin/stats
describe('Unmocked: GET /admin/stats', () => {
  // Input: request without params
  // Expected status code: 200
  // Expected behavior: returns database stats
  // Expected output: data.totalUsers present
  test('returns database stats', async () => {
    const response = await request(app).get('/api/admin/stats');

    expect(response.status).toBe(200);
    expect(response.body?.data?.totalUsers).toBeDefined();
  });
});

describe('Mocked: GET /admin/stats', () => {
  // Input: request for stats
  // Expected status code: 500
  // Expected behavior: surfaces database error
  // Expected output: message 'Failed to fetch stats'
  // Mock behavior: countDocuments rejects
  test('returns 500 when stats lookup fails', async () => {
    const mongooseLib = require('mongoose');
    const User = mongooseLib.model('User');
    const spy = jest
      .spyOn(User, 'countDocuments')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app).get('/api/admin/stats');

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface POST /admin/create-user
describe('Unmocked: POST /admin/create-user', () => {
  // Input: unique googleId/email/username
  // Expected status code: 201
  // Expected behavior: creates test user
  // Expected output: data.user present
  test('creates a test user successfully', async () => {
    const response = await request(app).post('/api/admin/create-user').send({
      googleId: `google-${Date.now()}`,
      email: `admin-${Date.now()}@example.com`,
      name: 'Admin Test',
      username: `admintest${Date.now()}`,
    });

    expect(response.status).toBe(201);
    expect(response.body?.data?.user).toBeDefined();
  });
});

describe('Mocked: POST /admin/create-user', () => {
  // Input: request body with unique data
  // Expected status code: 500
  // Expected behavior: surfaces errors from userModel
  // Expected output: 500 response
  // Mock behavior: userModel.findByGoogleId throws
  test('returns 500 when user creation fails', async () => {
    const spy = jest
      .spyOn(userModel, 'findByGoogleId')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app).post('/api/admin/create-user').send({
        googleId: `google-${Date.now()}`,
        email: `admin-${Date.now()}@example.com`,
        name: 'Admin Test',
        username: `admintest${Date.now()}`,
      });

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});
