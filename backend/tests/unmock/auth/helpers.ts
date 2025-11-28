import { OAuth2Client } from 'google-auth-library';
import { jest } from '@jest/globals';

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
  jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockRejectedValue(new Error('Invalid Google token'));
