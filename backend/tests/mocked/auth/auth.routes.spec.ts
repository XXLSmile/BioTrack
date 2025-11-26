import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

jest.mock('../../../src/config/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

import { createApp } from '../../../src/core/app';
import { authService } from '../../../src/services/auth.service';
import type { IUser } from '../../../src/types/user.types';

jest.mock('../../../src/services/auth.service', () => ({
  authService: {
    signUpWithGoogle: jest.fn(),
    signInWithGoogle: jest.fn(),
    logout: jest.fn(),
  },
}));

const app = createApp();

const buildMockUser = (overrides: Partial<IUser> = {}): IUser => {
  const ObjectId = require('mongoose').Types.ObjectId;
  return {
    _id: overrides._id ?? new ObjectId(),
    googleId: overrides.googleId ?? 'google-mock-user',
    email: overrides.email ?? 'mock@example.com',
    name: overrides.name ?? 'Mock User',
    username: overrides.username ?? 'mock_user',
    profilePicture: overrides.profilePicture,
    observationCount: overrides.observationCount ?? 0,
    speciesDiscovered: overrides.speciesDiscovered ?? 0,
    favoriteSpecies: overrides.favoriteSpecies ?? [],
    location: overrides.location,
    region: overrides.region,
    isPublicProfile: overrides.isPublicProfile ?? true,
    badges: overrides.badges ?? [],
    friendCount: overrides.friendCount ?? 0,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    fcmToken: overrides.fcmToken ?? null,
  } as IUser;
};

const MATT_ID_TOKEN =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6ImI1ZTQ0MGFlOTQxZTk5ODFlZTJmYTEzNzZkNDJjNDZkNzMxZGVlM2YiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI0MDc0MDg3MTgxOTIuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI0MDc0MDg3MTgxOTIuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMDI2MTEwNjYyNDQ0Mjg3Njg0NDUiLCJlbWFpbCI6InpoYW5naGFvcmFubWF0dEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiYXRfaGFzaCI6IkVxQXBGb1h0SG9SUWNUSHF4OXpaV2ciLCJuYW1lIjoiTWF0dCBaaGFuZyIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJMDVaYVRlUGlSUWhRSTQzNWhlVjBGS1lKSmhUdTVvYlktR2I0NjZWNjlNNGVBZFJjPXM5Ni1jIiwiZ2l2ZW5fbmFtZSI6Ik1hdHQiLCJmYW1pbHlfbmFtZSI6IlpoYW5nIiwiaWF0IjoxNzYyMzkwNDQ1LCJleHAiOjE3NjIzOTQwNDV9.MGu-drTsbsrMbbfvvDUsr-vfMrq7VpnLViCRf8TMNc54B9Fmpvgfx-FKg5HI-jaHEJNcUmhqa957coYaxYmca7JHgeVAo4fm9rovRsy3jwP7bcTxKVx6OlsaO6MQo0tRKCE_VWxoL0yVB0N5TEubrAGPNNG15n2fT69HyR29itBbjuikvU1DIscXaj5Y1QZbx0LgnqYrVQq39RMgrK_v29pOkEKtT_dwAIxdRClyX5oNN4ZLcNTCvcpMTnW7ZBlE17hS6lTI5EEOrRIGUrxdryY-velElBzaldsMJzIKGsNrVrVVPd1ES6dSlTUlrF5aIlugh2XR1bABmfL00dMklQ';

const XIAOHAN_ID_TOKEN =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6ImI1ZTQ0MGFlOTQxZTk5ODFlZTJmYTEzNzZkNDJjNDZkNzMxZGVlM2YiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI0MDc0MDg3MTgxOTIuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI0MDc0MDg3MTgxOTIuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTExODMxMTY0Mjg2MzcxMTcxMzEiLCJlbWFpbCI6InhobDIwMjNAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImF0X2hhc2giOiJoeXB3cDdCbG1RRDdRX1psYjV3MzV3IiwibmFtZSI6InhpYW9oYW4gbGl1IiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0tveHB6eFEyOVZpY292cjFJMTdIUXR2QjRzSTJkLVBULWQtTnN3VzhQLUdoMUhzQT1zOTYtYyIsImdpdmVuX25hbWUiOiJ4aWFvaGFuIiwiZmFtaWx5X25hbWUiOiJsaXUiLCJpYXQiOjE3NjIzOTA1MzUsImV4cCI6MTc2MjM5NDEzNX0.fVPIEnlmmFZHrmbCYYaA6r-7c7Jhp4goeNXF-S6AcqrN-aobou-k_OqFeEbPuaLIMYgPkWOeD7nC6su9dGM-j8PxbYIAWxM8dNcVU4k7ASzgsjh4bUKej9jd3Jny9_Fg7mSM0BKnWxIN5haScCH6bQ7M9ktJbjK7Z6Dm_mdIPty2aF0717Tv-Dpw4rizUW0IGAAnzS1HUnENYLMwaGwSluvrvQWuqYGnVQ_KSjDtO_3g-LLXSOT4GgYb321eGUcwOK5c5XxZLj0JA0Cpxt5wVQoWZ-e_hSDpQ3XoT2Q1EAFIVFmodJmEFZ_Na4NJfxJ7uBafWfp4Yw54VgIYtpHrxg';

beforeEach(() => {
  jest.clearAllMocks();
});

// Interface POST /auth/signup
describe('Mocked: POST /auth/signup', () => {
  // Input: matt account ID token
  // Expected status code: 201
  // Expected behavior: controller forwards mocked service response
  // Expected output: JSON payload containing token and user email
  // Mock behavior: authService.signUpWithGoogle resolves with fake auth result
  test('returns 201 when sign up succeeds', async () => {
    jest
      .spyOn(authService, 'signUpWithGoogle')
      .mockResolvedValueOnce({
        token: 'signed-jwt',
        user: buildMockUser({ email: 'zhanghaoranmatt@gmail.com' }),
      });

    const response = await request(app)
      .post('/api/auth/signup')
      .send({ idToken: MATT_ID_TOKEN });

    expect(authService.signUpWithGoogle).toHaveBeenCalledWith(MATT_ID_TOKEN);
    expect(response.status).toBe(201);
    expect(response.body?.data?.token).toBe('signed-jwt');
    expect(response.body?.data?.user?.email).toBe('zhanghaoranmatt@gmail.com');
  });

  // Input: matt account ID token
  // Expected status code: 401
  // Expected behavior: controller maps mocked error to 401 response
  // Expected output: message "Invalid Google token"
  // Mock behavior: authService.signUpWithGoogle rejects with Error('Invalid Google token')
  test('returns 401 when Google token invalid', async () => {
    jest
      .spyOn(authService, 'signUpWithGoogle')
      .mockRejectedValueOnce(new Error('Invalid Google token'));

    const response = await request(app)
      .post('/api/auth/signup')
      .send({ idToken: MATT_ID_TOKEN });

    expect(response.status).toBe(401);
    expect(response.body?.message).toBe('Invalid Google token');
  });

  // Input: xiaohan account ID token
  // Expected status code: 409
  // Expected behavior: controller returns conflict when service reports duplicate user
  // Expected output: 409 response body (message not asserted)
  // Mock behavior: authService.signUpWithGoogle rejects with Error('User already exists')
  test('returns 409 when user already exists', async () => {
    jest
      .spyOn(authService, 'signUpWithGoogle')
      .mockRejectedValueOnce(new Error('User already exists'));

    const response = await request(app)
      .post('/api/auth/signup')
      .send({ idToken: XIAOHAN_ID_TOKEN });

    expect(response.status).toBe(409);
  });
});

// Interface POST /auth/signin
describe('Mocked: POST /auth/signin', () => {
  // Input: matt account ID token
  // Expected status code: 200
  // Expected behavior: controller forwards mocked auth result
  // Expected output: JSON payload containing token and user email
  // Mock behavior: authService.signInWithGoogle resolves with fake auth result
  test('returns 200 when sign in succeeds', async () => {
    jest
      .spyOn(authService, 'signInWithGoogle')
      .mockResolvedValueOnce({
        token: 'signed-jwt',
        user: buildMockUser({ email: 'zhanghaoranmatt@gmail.com' }),
      });

    const response = await request(app)
      .post('/api/auth/signin')
      .send({ idToken: MATT_ID_TOKEN });

    expect(response.status).toBe(200);
    expect(response.body?.data?.token).toBe('signed-jwt');
    expect(response.body?.data?.user?.email).toBe('zhanghaoranmatt@gmail.com');
  });

  // Input: xiaohan account ID token
  // Expected status code: 404
  // Expected behavior: controller forwards "User not found" error as 404
  // Expected output: 404 response
  // Mock behavior: authService.signInWithGoogle rejects with Error('User not found')
  test('returns 404 when user not found', async () => {
    jest
      .spyOn(authService, 'signInWithGoogle')
      .mockRejectedValueOnce(new Error('User not found'));

    const response = await request(app)
      .post('/api/auth/signin')
      .send({ idToken: XIAOHAN_ID_TOKEN });

    expect(response.status).toBe(404);
  });
});

// Interface POST /auth/logout
describe('Mocked: POST /auth/logout', () => {
  // Input: POST request without body
  // Expected status code: 500
  // Expected behavior: controller propagates mocked service failure
  // Expected output: 500 response
  // Mock behavior: authService.logout rejects with Error('logout failed')
  test('returns 500 when logout fails', async () => {
    jest.spyOn(authService, 'logout').mockRejectedValueOnce(
      new Error('logout failed')
    );

    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(500);
  });
});
