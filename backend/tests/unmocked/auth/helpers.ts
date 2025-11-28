import { OAuth2Client } from 'google-auth-library';
import { jest } from '@jest/globals';
import type { SuperTest, Test } from 'supertest';
import type { IUser } from '../../../src/types/user.types';

export const VALID_ID_TOKEN = 'valid-test-token';

export const VALID_GOOGLE_PAYLOAD = {
  sub: 'test-google-id',
  email: 'feature-test@example.com',
  name: 'Feature Test',
  picture: 'https://example.com/avatar.png',
};

let verifyIdTokenSpy: ReturnType<typeof jest.spyOn> | null = null;
const userCache = new Map<string, IUser>();

const setVerifyImplementation = (impl: (...args: unknown[]) => unknown) => {
  verifyIdTokenSpy?.mockRestore();
  verifyIdTokenSpy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken');
  verifyIdTokenSpy.mockImplementation(impl);
  return verifyIdTokenSpy;
};

export const mockGoogleVerifySuccess = () =>
  mockGoogleVerifyWithPayload(VALID_GOOGLE_PAYLOAD);

export const mockGoogleVerifyFailure = () =>
  setVerifyImplementation(async () => {
    throw new Error('Invalid Google token');
  });

export const mockGoogleVerifyWithPayload = (payload: Record<string, unknown> | null) =>
  setVerifyImplementation(async () => ({
    getPayload: () => payload,
  } as never));

export const createUserAndToken = async (api: SuperTest<Test>): Promise<string> =>
  createUserAndTokenWithPayload(api, VALID_GOOGLE_PAYLOAD);

export const createUserAndTokenWithPayload = async (
  api: SuperTest<Test>,
  payload: Record<string, unknown> | null
): Promise<string> => {
  mockGoogleVerifyWithPayload(payload);
  await api.post('/api/auth/signup').send({ idToken: VALID_ID_TOKEN });
  const signin = await api.post('/api/auth/signin').send({ idToken: VALID_ID_TOKEN });
  const cachedUser = signin.body?.data?.user as IUser | undefined;
  if (typeof payload?.sub === 'string' && cachedUser) {
    userCache.set(payload.sub, cachedUser);
  }
  return signin.body?.data?.token;
};

export const getCachedUserByGoogleId = (googleId: string): IUser | undefined =>
  userCache.get(googleId);
