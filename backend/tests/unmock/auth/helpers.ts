import { OAuth2Client } from 'google-auth-library';
import { jest } from '@jest/globals';
import type { SuperTest, Test } from 'supertest';

export const VALID_ID_TOKEN = 'valid-test-token';

export const VALID_GOOGLE_PAYLOAD = {
  sub: 'test-google-id',
  email: 'feature-test@example.com',
  name: 'Feature Test',
  picture: 'https://example.com/avatar.png',
};

export const mockGoogleVerifySuccess = () =>
  jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
    getPayload: () => VALID_GOOGLE_PAYLOAD,
  } as never);

export const mockGoogleVerifyFailure = () =>
  jest
    .spyOn(OAuth2Client.prototype, 'verifyIdToken')
    .mockImplementation(async () => {
      throw new Error('Invalid Google token');
    });

export const mockGoogleVerifyWithPayload = (payload: Record<string, unknown> | null) =>
  jest
    .spyOn(OAuth2Client.prototype, 'verifyIdToken')
    .mockResolvedValue({
      getPayload: () => payload,
    } as never);

export const createUserAndToken = async (api: SuperTest<Test>): Promise<string> => {
  mockGoogleVerifySuccess();
  await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });
  const signin = await api.post('/api/auth/signin').send({ idToken: VALID_ID_TOKEN });
  return signin.body?.data?.token;
};
