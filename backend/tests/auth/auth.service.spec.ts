import type { LoginTicket } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { AuthService } from '../../src/auth/auth.service';

let verifyIdTokenMock: jest.Mock;
let findByGoogleIdMock: jest.Mock;
let createUserMock: jest.Mock;

jest.mock('google-auth-library', () => {
  verifyIdTokenMock = jest.fn();
  return {
    OAuth2Client: jest.fn(() => ({
      verifyIdToken: verifyIdTokenMock,
    })),
  };
});

jest.mock('../../src/user/user.model', () => {
  findByGoogleIdMock = jest.fn();
  createUserMock = jest.fn();
  return {
    userModel: {
      findByGoogleId: findByGoogleIdMock,
      create: createUserMock,
      findById: jest.fn(),
    },
  };
});

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));

import { userModel } from '../../src/user/user.model';

const signMock = jwt.sign as jest.Mock;

const createLoginTicket = (
  payload: Record<string, unknown>
): Pick<LoginTicket, 'getPayload'> => ({
  getPayload: () => payload,
});

describe('Mocked: AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.GOOGLE_CLIENT_ID = 'test-client';

    verifyIdTokenMock.mockReset();
    findByGoogleIdMock.mockReset();
    createUserMock.mockReset();
    signMock.mockReset();

    service = new AuthService();
  });

  test('signUpWithGoogle returns token and user on success', async () => {
    const fakeUser = { _id: 'user123', email: 'new@example.com' };

    verifyIdTokenMock.mockResolvedValueOnce(
      createLoginTicket({
        sub: 'google-123',
        email: 'new@example.com',
        name: 'New User',
        picture: 'https://example.com/pic.jpg',
      })
    );
    findByGoogleIdMock.mockResolvedValueOnce(null);
    createUserMock.mockResolvedValueOnce(fakeUser);
    signMock.mockReturnValueOnce('signed-token');

    const result = await service.signUpWithGoogle('valid-id-token');

    expect(verifyIdTokenMock).toHaveBeenCalledWith({
      idToken: 'valid-id-token',
      audience: 'test-client',
    });
    expect(findByGoogleIdMock).toHaveBeenCalledWith('google-123');
    expect(createUserMock).toHaveBeenCalled();
    expect(signMock).toHaveBeenCalledWith({ id: fakeUser._id }, 'test-secret', {
      expiresIn: '19h',
    });
    expect(result).toEqual({ token: 'signed-token', user: fakeUser });
  });

  test('signUpWithGoogle throws when Google token is invalid', async () => {
    verifyIdTokenMock.mockRejectedValueOnce(new Error('boom'));

    await expect(service.signUpWithGoogle('bad-token')).rejects.toThrow(
      'Invalid Google token'
    );
    expect(findByGoogleIdMock).not.toHaveBeenCalled();
    expect(createUserMock).not.toHaveBeenCalled();
  });

  test('signUpWithGoogle throws when user already exists', async () => {
    verifyIdTokenMock.mockResolvedValueOnce(
      createLoginTicket({
        sub: 'google-dup',
        email: 'dup@example.com',
        name: 'Dup User',
      })
    );
    findByGoogleIdMock.mockResolvedValueOnce({ _id: 'existing' });

    await expect(service.signUpWithGoogle('token')).rejects.toThrow(
      'User already exists'
    );
    expect(createUserMock).not.toHaveBeenCalled();
  });

  test('signInWithGoogle returns token when user exists', async () => {
    const existingUser = { _id: 'existing', email: 'user@example.com' };

    verifyIdTokenMock.mockResolvedValueOnce(
      createLoginTicket({
        sub: 'google-existing',
        email: 'user@example.com',
        name: 'Existing User',
      })
    );
    findByGoogleIdMock.mockResolvedValueOnce(existingUser);
    signMock.mockReturnValueOnce('signed-token');

    const result = await service.signInWithGoogle('token');

    expect(findByGoogleIdMock).toHaveBeenCalledWith('google-existing');
    expect(result).toEqual({ token: 'signed-token', user: existingUser });
  });

  test('signInWithGoogle throws when user not found', async () => {
    verifyIdTokenMock.mockResolvedValueOnce(
      createLoginTicket({
        sub: 'google-missing',
        email: 'missing@example.com',
        name: 'Missing',
      })
    );
    findByGoogleIdMock.mockResolvedValueOnce(null);

    await expect(service.signInWithGoogle('token')).rejects.toThrow(
      'User not found'
    );
    expect(signMock).not.toHaveBeenCalled();
  });
});
