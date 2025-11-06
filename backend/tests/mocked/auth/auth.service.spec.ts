import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import jwt from 'jsonwebtoken';

type Payload = ReturnType<typeof buildBasePayload>;
type MockTicket = { getPayload: () => Payload };

let verifyIdTokenMock: jest.MockedFunction<
  (idToken: unknown) => Promise<MockTicket>
>;

jest.mock('google-auth-library', () => {
  verifyIdTokenMock = jest.fn<(idToken: unknown) => Promise<MockTicket>>();
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: verifyIdTokenMock,
    })),
  };
});

const findByGoogleIdMock: jest.MockedFunction<
  (googleId: string) => Promise<any>
> = jest.fn();
const createUserMock: jest.MockedFunction<
  (payload: unknown) => Promise<any>
> = jest.fn();

jest.mock('../../../src/user/user.model', () => ({
  userModel: {
    findByGoogleId: findByGoogleIdMock,
    create: createUserMock,
  },
}));

jest.mock('../../../src/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

import { authService } from '../../../src/auth/auth.service';

const buildPayload = (overrides: Partial<ReturnType<typeof buildBasePayload>> = {}) =>
  ({
    sub: overrides.sub ?? 'google-123',
    email: overrides.email ?? 'user@example.com',
    name: overrides.name ?? 'User',
    picture: overrides.picture ?? 'https://example.com/avatar.png',
  });

function buildBasePayload() {
  return {
    sub: 'google-123',
    email: 'user@example.com',
    name: 'User',
    picture: 'https://example.com/avatar.png',
  };
}

const resolveTicket = (payload: Payload): MockTicket => ({
  getPayload: () => payload,
});

afterEach(() => {
  jest.clearAllMocks();
});

beforeEach(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
});

// Interface AuthService.signUpWithGoogle
describe('Mocked: AuthService.signUpWithGoogle', () => {
  // Input: Google ID token for new user, payload contains sub google-123
  // Expected status code: n/a (service returns auth result)
  // Expected behavior: service verifies token, creates user, and signs JWT
  // Expected output: object containing signed JWT and created user
  // Mock behavior: verifyIdToken resolves with payload, findByGoogleId resolves null, create resolves createdUser, jwt.sign invoked
  test('creates new user when Google token valid and user not found', async () => {
    verifyIdTokenMock.mockResolvedValueOnce(resolveTicket(buildBasePayload()));
    findByGoogleIdMock.mockResolvedValueOnce(null);
    const createdUser = { _id: 'user-id' };
    createUserMock.mockResolvedValueOnce(createdUser);
    const signSpy = jest.spyOn(jwt, 'sign');

    const result = await authService.signUpWithGoogle('id-token');

    expect(findByGoogleIdMock).toHaveBeenCalledWith('google-123');
    expect(createUserMock).toHaveBeenCalled();
    expect(signSpy).toHaveBeenCalledWith({ id: createdUser._id }, expect.any(String), {
      expiresIn: '19h',
    });
    expect(typeof result.token).toBe('string');
    expect(result.user).toEqual(createdUser);
  });

  // Input: Google ID token matching existing user
  // Expected status code: n/a (service throws)
  // Expected behavior: service rejects when user already exists
  // Expected output: thrown Error("User already exists")
  // Mock behavior: verifyIdToken resolves with payload, findByGoogleId resolves existing user
  test('throws when user already exists', async () => {
    verifyIdTokenMock.mockResolvedValueOnce(resolveTicket(buildBasePayload()));
    findByGoogleIdMock.mockResolvedValueOnce({ _id: 'existing' });

    await expect(authService.signUpWithGoogle('token')).rejects.toThrow(
      'User already exists'
    );
  });

  // Input: Google ID token failing verification
  // Expected status code: n/a (service throws)
  // Expected behavior: service maps verification failure to invalid token error
  // Expected output: thrown Error("Invalid Google token")
  // Mock behavior: verifyIdToken rejects with Error('bad token')
  test('throws invalid token error when verification fails', async () => {
    verifyIdTokenMock.mockRejectedValueOnce(new Error('bad token'));

    await expect(authService.signUpWithGoogle('token')).rejects.toThrow(
      'Invalid Google token'
    );
  });

  // Input: Google ID token resolving to payload with missing fields
  // Expected status code: n/a (service throws)
  // Expected behavior: service treats incomplete payload as invalid token
  // Expected output: thrown Error("Invalid Google token")
  // Mock behavior: verifyIdToken resolves to payload lacking email
  test('throws invalid token error when payload missing required info', async () => {
    verifyIdTokenMock.mockResolvedValueOnce({
      getPayload: () =>
        ({
          sub: 'google-123',
          email: undefined,
          name: 'User',
          picture: 'https://example.com/avatar.png',
        }) as any,
    });

    await expect(authService.signUpWithGoogle('token')).rejects.toThrow(
      'Invalid Google token'
    );
  });

  // Input: Google ID token resolving to empty payload
  // Expected status code: n/a (service throws)
  // Expected behavior: service rejects when ticket payload absent
  // Expected output: thrown Error("Invalid Google token")
  // Mock behavior: verifyIdToken resolves to object whose getPayload returns null
  test('throws invalid token error when payload missing', async () => {
    verifyIdTokenMock.mockResolvedValueOnce({
      getPayload: () => null as any,
    });

    await expect(authService.signUpWithGoogle('token')).rejects.toThrow(
      'Invalid Google token'
    );
  });
});

// Interface AuthService.signInWithGoogle
describe('Mocked: AuthService.signInWithGoogle', () => {
  // Input: Google ID token for existing user
  // Expected status code: n/a (service returns auth result)
  // Expected behavior: service verifies token, fetches user, and signs JWT
  // Expected output: object containing signed JWT and existing user
  // Mock behavior: verifyIdToken resolves with payload, findByGoogleId resolves existingUser, jwt.sign invoked
  test('returns auth result when user exists', async () => {
    verifyIdTokenMock.mockResolvedValueOnce(resolveTicket(buildBasePayload()));
    const existingUser = { _id: 'existing' };
    findByGoogleIdMock.mockResolvedValueOnce(existingUser);
    const signSpy = jest.spyOn(jwt, 'sign');

    const result = await authService.signInWithGoogle('token');

    expect(typeof result.token).toBe('string');
    expect(result.user).toEqual(existingUser);
    expect(signSpy).toHaveBeenCalled();
  });

  // Input: Google ID token for non-existent user
  // Expected status code: n/a (service throws)
  // Expected behavior: service rejects when user not found
  // Expected output: thrown Error("User not found")
  // Mock behavior: verifyIdToken resolves with payload, findByGoogleId resolves null
  test('throws when user not found', async () => {
    verifyIdTokenMock.mockResolvedValueOnce(resolveTicket(buildBasePayload()));
    findByGoogleIdMock.mockResolvedValueOnce(null);

    await expect(authService.signInWithGoogle('token')).rejects.toThrow(
      'User not found'
    );
  });

  // Input: Google ID token failing verification
  // Expected status code: n/a (service throws)
  // Expected behavior: service maps verification failure to invalid token error
  // Expected output: thrown Error("Invalid Google token")
  // Mock behavior: verifyIdToken rejects with Error('bad token')
  test('throws invalid token error when verification fails', async () => {
    verifyIdTokenMock.mockRejectedValueOnce(new Error('bad token'));

    await expect(authService.signInWithGoogle('token')).rejects.toThrow(
      'Invalid Google token'
    );
  });

  // Input: Google ID token resolving to payload without name
  // Expected status code: n/a (service throws)
  // Expected behavior: service rejects when Google payload incomplete
  // Expected output: thrown Error("Invalid Google token")
  // Mock behavior: verifyIdToken resolves to payload lacking name
  test('throws invalid token error when payload missing name', async () => {
    verifyIdTokenMock.mockResolvedValueOnce({
      getPayload: () =>
        ({
          sub: 'google-123',
          email: 'user@example.com',
          name: undefined,
          picture: 'https://example.com/avatar.png',
        }) as any,
    });

    await expect(authService.signInWithGoogle('token')).rejects.toThrow(
      'Invalid Google token'
    );
  });
});
