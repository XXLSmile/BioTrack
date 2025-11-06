import { beforeEach, describe, expect, test } from '@jest/globals';
import request from 'supertest';

import { createApp } from '../../../src/app';
import { authService } from '../../../src/auth/auth.service';

jest.mock('../../../src/auth/auth.service', () => ({
  authService: {
    signUpWithGoogle: jest.fn(),
    signInWithGoogle: jest.fn(),
    logout: jest.fn(),
  },
}));

const app = createApp();

const MATT_ID_TOKEN =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6ImI1ZTQ0MGFlOTQxZTk5ODFlZTJmYTEzNzZkNDJjNDZkNzMxZGVlM2YiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI0MDc0MDg3MTgxOTIuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI0MDc0MDg3MTgxOTIuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMDI2MTEwNjYyNDQ0Mjg3Njg0NDUiLCJlbWFpbCI6InpoYW5naGFvcmFubWF0dEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiYXRfaGFzaCI6IkVxQXBGb1h0SG9SUWNUSHF4OXpaV2ciLCJuYW1lIjoiTWF0dCBaaGFuZyIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJMDVaYVRlUGlSUWhRSTQzNWhlVjBGS1lKSmhUdTVvYlktR2I0NjZWNjlNNGVBZFJjPXM5Ni1jIiwiZ2l2ZW5fbmFtZSI6Ik1hdHQiLCJmYW1pbHlfbmFtZSI6IlpoYW5nIiwiaWF0IjoxNzYyMzkwNDQ1LCJleHAiOjE3NjIzOTQwNDV9.MGu-drTsbsrMbbfvvDUsr-vfMrq7VpnLViCRf8TMNc54B9Fmpvgfx-FKg5HI-jaHEJNcUmhqa957coYaxYmca7JHgeVAo4fm9rovRsy3jwP7bcTxKVx6OlsaO6MQo0tRKCE_VWxoL0yVB0N5TEubrAGPNNG15n2fT69HyR29itBbjuikvU1DIscXaj5Y1QZbx0LgnqYrVQq39RMgrK_v29pOkEKtT_dwAIxdRClyX5oNN4ZLcNTCvcpMTnW7ZBlE17hS6lTI5EEOrRIGUrxdryY-velElBzaldsMJzIKGsNrVrVVPd1ES6dSlTUlrF5aIlugh2XR1bABmfL00dMklQ';

const XIAOHAN_ID_TOKEN =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6ImI1ZTQ0MGFlOTQxZTk5ODFlZTJmYTEzNzZkNDJjNDZkNzMxZGVlM2YiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI0MDc0MDg3MTgxOTIuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI0MDc0MDg3MTgxOTIuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTExODMxMTY0Mjg2MzcxMTcxMzEiLCJlbWFpbCI6InhobDIwMjNAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImF0X2hhc2giOiJoeXB3cDdCbG1RRDdRX1psYjV3MzV3IiwibmFtZSI6InhpYW9oYW4gbGl1IiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0tveHB6eFEyOVZpY292cjFJMTdIUXR2QjRzSTJkLVBULWQtTnN3VzhQLUdoMUhzQT1zOTYtYyIsImdpdmVuX25hbWUiOiJ4aWFvaGFuIiwiZmFtaWx5X25hbWUiOiJsaXUiLCJpYXQiOjE3NjIzOTA1MzUsImV4cCI6MTc2MjM5NDEzNX0.fVPIEnlmmFZHrmbCYYaA6r-7c7Jhp4goeNXF-S6AcqrN-aobou-k_OqFeEbPuaLIMYgPkWOeD7nC6su9dGM-j8PxbYIAWxM8dNcVU4k7ASzgsjh4bUKej9jd3Jny9_Fg7mSM0BKnWxIN5haScCH6bQ7M9ktJbjK7Z6Dm_mdIPty2aF0717Tv-Dpw4rizUW0IGAAnzS1HUnENYLMwaGwSluvrvQWuqYGnVQ_KSjDtO_3g-LLXSOT4GgYb321eGUcwOK5c5XxZLj0JA0Cpxt5wVQoWZ-e_hSDpQ3XoT2Q1EAFIVFmodJmEFZ_Na4NJfxJ7uBafWfp4Yw54VgIYtpHrxg';

beforeEach(() => {
  jest.clearAllMocks();
});

// Interface POST /auth/signup
describe('Mocked: POST /auth/signup', () => {
  test('returns 201 when sign up succeeds', async () => {
    jest
      .spyOn(authService, 'signUpWithGoogle')
      .mockResolvedValueOnce({
        token: 'signed-jwt',
        user: { email: 'zhanghaoranmatt@gmail.com' },
      });

    const response = await request(app)
      .post('/api/auth/signup')
      .send({ idToken: MATT_ID_TOKEN });

    expect(authService.signUpWithGoogle).toHaveBeenCalledWith(MATT_ID_TOKEN);
    expect(response.status).toBe(201);
    expect(response.body?.data).toEqual({
      token: 'signed-jwt',
      user: { email: 'zhanghaoranmatt@gmail.com' },
    });
  });

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
  test('returns 200 when sign in succeeds', async () => {
    jest
      .spyOn(authService, 'signInWithGoogle')
      .mockResolvedValueOnce({
        token: 'signed-jwt',
        user: { email: 'zhanghaoranmatt@gmail.com' },
      });

    const response = await request(app)
      .post('/api/auth/signin')
      .send({ idToken: MATT_ID_TOKEN });

    expect(response.status).toBe(200);
    expect(response.body?.data).toEqual({
      token: 'signed-jwt',
      user: { email: 'zhanghaoranmatt@gmail.com' },
    });
  });

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
  test('returns 500 when logout fails', async () => {
    jest.spyOn(authService, 'logout').mockRejectedValueOnce(
      new Error('logout failed')
    );

    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(500);
  });
});
