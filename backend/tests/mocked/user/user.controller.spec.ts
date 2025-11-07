import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import mongoose from 'mongoose';

jest.mock('../../../src/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

const mockUserModel = {
  isUsernameAvailable: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByUsername: jest.fn(),
  findByName: jest.fn(),
  findById: jest.fn(),
  searchByName: jest.fn(),
  getUserStats: jest.fn(),
  addFavoriteSpecies: jest.fn(),
  removeFavoriteSpecies: jest.fn(),
  updateMany: jest.fn(),
  decrementFriendCount: jest.fn(),
  addFavoriteSpeciesReturn: jest.fn(),
  addBadge: jest.fn(),
  updateFcmToken: jest.fn(),
};

jest.mock('../../../src/user/user.model', () => ({
  userModel: mockUserModel,
}));

const mockFriendshipModel = {
  deleteAllForUser: jest.fn(),
};

jest.mock('../../../src/friends/friend.model', () => ({
  friendshipModel: mockFriendshipModel,
}));

import { UserController } from '../../../src/user/user.controller';
import { userModel } from '../../../src/user/user.model';
import { friendshipModel } from '../../../src/friends/friend.model';

const mockedUserModel = userModel as jest.Mocked<typeof userModel>;
const mockedFriendshipModel = friendshipModel as jest.Mocked<typeof friendshipModel>;

const controller = new UserController();

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as {
    status: jest.Mock;
    json: jest.Mock;
  };
};

const createNext = () => jest.fn() as jest.Mock;

const sampleUser = () => ({
  _id: new mongoose.Types.ObjectId(),
  name: 'Alice',
  username: 'alice',
  profilePicture: 'pic.jpg',
  location: 'Vancouver',
  region: 'BC',
  observationCount: 5,
  speciesDiscovered: 3,
  badges: ['rookie'],
  friendCount: 2,
  favoriteSpecies: ['Owl'],
  createdAt: new Date(),
  isPublicProfile: true,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// Interface UserController.updateProfile
describe('Mocked: UserController.updateProfile', () => {
  // Input: payload with unchanged username
  // Expected status code: 200
  // Expected behavior: controller updates profile without availability check failure
  // Expected output: JSON containing updated user
  // Mock behavior: userModel.update resolves to updated user
  test('updates profile when username unchanged', async () => {
    const user = sampleUser();
    const updated = { ...user, name: 'Alice Updated' } as any;
    mockedUserModel.update.mockResolvedValueOnce(updated);

    const req = { user, body: { name: 'Alice Updated' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.updateProfile(req, res as any, next);

    expect(mockedUserModel.update).toHaveBeenCalledWith(user._id, { name: 'Alice Updated' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User info updated successfully',
      data: { user: updated },
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: payload requesting new username already taken
  // Expected status code: 409
  // Expected behavior: controller responds with conflict message
  // Expected output: message about username taken
  // Mock behavior: userModel.isUsernameAvailable resolves false
  test('returns 409 when username already taken', async () => {
    const user = sampleUser();
    mockedUserModel.isUsernameAvailable.mockResolvedValueOnce(false);

    const req = { user, body: { username: 'newname' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.updateProfile(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Username already taken. Please choose a different username.',
    });
    expect(mockedUserModel.update).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  // Input: payload with new username available but update returns null
  // Expected status code: 404
  // Expected behavior: controller signals user not found
  // Expected output: message "User not found"
  // Mock behavior: userModel.isUsernameAvailable resolves true, update resolves null
  test('returns 404 when update returns null', async () => {
    const user = sampleUser();
    mockedUserModel.isUsernameAvailable.mockResolvedValueOnce(true);
    mockedUserModel.update.mockResolvedValueOnce(null);

    const req = { user, body: { username: 'newname' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.updateProfile(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User not found',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: payload causing duplicate key error
  // Expected status code: 409
  // Expected behavior: controller maps Mongo duplicate error to conflict
  // Expected output: message about username taken
  // Mock behavior: userModel.update rejects with Error containing "E11000"
  test('returns 409 when duplicate key error thrown', async () => {
    const user = sampleUser();
    mockedUserModel.update.mockRejectedValueOnce(new Error('E11000 duplicate key error'));

    const req = { user, body: {} } as any;
    const res = createResponse();
    const next = createNext();

    await controller.updateProfile(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Username already taken. Please choose a different username.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: payload causing generic error
  // Expected status code: 500
  // Expected behavior: controller returns error message
  // Expected output: message with error text
  // Mock behavior: userModel.update rejects with Error('boom')
  test('returns 500 when update throws generic error', async () => {
    const user = sampleUser();
    mockedUserModel.update.mockRejectedValueOnce(new Error('boom'));

    const req = { user, body: {} } as any;
    const res = createResponse();
    const next = createNext();

    await controller.updateProfile(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'boom',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: payload triggering non-Error rejection
  // Expected status code: n/a
  // Expected behavior: controller forwards unknown error to next()
  // Expected output: next invoked with thrown value
  // Mock behavior: userModel.update rejects with string
  test('forwards unexpected error types to next', async () => {
    const user = sampleUser();
    mockedUserModel.update.mockRejectedValueOnce('weird');

    const req = { user, body: {} } as any;
    const res = createResponse();
    const next = createNext();

    await controller.updateProfile(req, res as any, next);

    expect(next).toHaveBeenCalledWith('weird');
  });
});

// Interface UserController.deleteProfile
describe('Mocked: UserController.deleteProfile', () => {
  // Input: authenticated user with accepted friendships
  // Expected status code: 200
  // Expected behavior: controller deletes friendships, decrements friend counts, deletes user
  // Expected output: message "User deleted successfully"
  // Mock behavior: friendshipModel.deleteAllForUser resolves with duplicate friend ids
  test('deletes profile and notifies friends', async () => {
    const user = sampleUser();
    const friendA = new mongoose.Types.ObjectId();
    const friendB = new mongoose.Types.ObjectId();
    mockedFriendshipModel.deleteAllForUser.mockResolvedValueOnce([friendA, friendB, friendA]);
    mockedUserModel.decrementFriendCount.mockResolvedValue(undefined);
    mockedUserModel.delete.mockResolvedValue(undefined);

    const req = { user } as any;
    const res = createResponse();
    const next = createNext();

    await controller.deleteProfile(req, res as any, next);

    expect(mockedFriendshipModel.deleteAllForUser).toHaveBeenCalledWith(user._id);
    expect(mockedUserModel.decrementFriendCount).toHaveBeenCalledTimes(2);
    expect(mockedUserModel.decrementFriendCount).toHaveBeenCalledWith(friendA);
    expect(mockedUserModel.decrementFriendCount).toHaveBeenCalledWith(friendB);
    expect(mockedUserModel.delete).toHaveBeenCalledWith(user._id);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User deleted successfully',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: authenticated user when deletion throws error
  // Expected status code: 500
  // Expected behavior: controller returns failure message
  // Expected output: JSON with error message
  // Mock behavior: userModel.delete rejects with Error('fail')
  test('returns 500 when delete fails', async () => {
    const user = sampleUser();
    mockedFriendshipModel.deleteAllForUser.mockRejectedValueOnce(new Error('fail'));

    const req = { user } as any;
    const res = createResponse();
    const next = createNext();

    await controller.deleteProfile(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'fail',
    });
    expect(next).not.toHaveBeenCalled();
  });
});

// Interface UserController.getUserByUsername
describe('Mocked: UserController.getUserByUsername', () => {
  const makeRequest = (username: string, requestingUser?: any) =>
    ({
      params: { username },
      user: requestingUser,
    } as any);

  // Input: public user requested by guest
  // Expected status code: 200
  // Expected behavior: controller returns public profile
  // Expected output: JSON with sanitized user data
  // Mock behavior: userModel.findByUsername resolves with public user
  test('returns public profile for guest', async () => {
    const user = { ...sampleUser(), favoriteSpecies: ['Eagle', null] };
    mockedUserModel.findByUsername.mockResolvedValueOnce(user as any);
    const req = makeRequest('alice');
    const res = createResponse();
    const next = createNext();

    await controller.getUserByUsername(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User profile fetched successfully',
      data: {
        user: expect.objectContaining({
          _id: user._id,
          username: user.username,
          favoriteSpecies: ['Eagle'],
        }),
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: private user requested by outsider
  // Expected status code: 403
  // Expected behavior: controller denies access
  // Expected output: message "This profile is private"
  // Mock behavior: userModel.findByUsername resolves private user, req.user absent
  test('returns 403 for private profile when requester not owner', async () => {
    const user = { ...sampleUser(), isPublicProfile: false };
    mockedUserModel.findByUsername.mockResolvedValueOnce(user as any);
    const req = makeRequest('alice');
    const res = createResponse();
    const next = createNext();

    await controller.getUserByUsername(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'This profile is private',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: private user requested by same user
  // Expected status code: 200
  // Expected behavior: controller allows owner to view profile
  // Expected output: JSON with user data
  // Mock behavior: userModel.findByUsername resolves private user, req.user matches id
  test('allows owner to view private profile', async () => {
    const user = { ...sampleUser(), isPublicProfile: false };
    mockedUserModel.findByUsername.mockResolvedValueOnce(user as any);
    const req = makeRequest('alice', { _id: user._id });
    const res = createResponse();
    const next = createNext();

    await controller.getUserByUsername(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  // Input: username that does not exist
  // Expected status code: 404
  // Expected behavior: controller returns not found
  // Expected output: message "User not found"
  // Mock behavior: userModel.findByUsername resolves null
  test('returns 404 when username not found', async () => {
    mockedUserModel.findByUsername.mockResolvedValueOnce(null);
    const req = makeRequest('missing');
    const res = createResponse();
    const next = createNext();

    await controller.getUserByUsername(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User not found',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: request causing underlying model error
  // Expected status code: n/a
  // Expected behavior: controller forwards error to next()
  // Expected output: next invoked with error
  // Mock behavior: userModel.findByUsername rejects with Error('boom')
  test('forwards errors from model', async () => {
    mockedUserModel.findByUsername.mockRejectedValueOnce(new Error('boom'));
    const req = makeRequest('alice');
    const res = createResponse();
    const next = createNext();

    await controller.getUserByUsername(req, res as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// Interface UserController.getUserByName
describe('Mocked: UserController.getUserByName', () => {
  const makeRequest = (username: string, requestingUser?: any) =>
    ({
      params: { username },
      user: requestingUser,
    } as any);

  // Input: existing public user
  // Expected status code: 200
  // Expected behavior: controller returns sanitized profile
  // Expected output: JSON containing selected fields
  // Mock behavior: userModel.findByName resolves user
  test('returns public profile for name lookup', async () => {
    const user = { ...sampleUser(), isPublicProfile: true };
    mockedUserModel.findByName.mockResolvedValueOnce(user as any);
    const req = makeRequest('Alice');
    const res = createResponse();
    const next = createNext();

    await controller.getUserByName(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User profile fetched successfully',
      data: {
        user: expect.objectContaining({
          _id: user._id,
          name: user.name,
        }),
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: private user requested by outsider
  // Expected status code: 403
  // Expected behavior: controller blocks access
  // Expected output: message "This profile is private"
  // Mock behavior: userModel.findByName resolves private user, req.user missing
  test('rejects access to private profile for name lookup', async () => {
    const user = { ...sampleUser(), isPublicProfile: false };
    mockedUserModel.findByName.mockResolvedValueOnce(user as any);
    const req = makeRequest('Alice');
    const res = createResponse();
    const next = createNext();

    await controller.getUserByName(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'This profile is private',
    });
  });

  // Input: name not found
  // Expected status code: 404
  // Expected behavior: controller returns not found
  // Expected output: message "User not found"
  // Mock behavior: userModel.findByName resolves null
  test('returns 404 when name not found', async () => {
    mockedUserModel.findByName.mockResolvedValueOnce(null);
    const req = makeRequest('Unknown');
    const res = createResponse();
    const next = createNext();

    await controller.getUserByName(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User not found',
    });
  });

  // Input: name lookup causing model error
  // Expected status code: n/a
  // Expected behavior: controller forwards error to next()
  // Expected output: next called with error
  // Mock behavior: userModel.findByName rejects
  test('forwards errors for name lookup', async () => {
    mockedUserModel.findByName.mockRejectedValueOnce(new Error('fail'));
    const req = makeRequest('Alice');
    const res = createResponse();
    const next = createNext();

    await controller.getUserByName(req, res as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// Interface UserController.getUserById
describe('Mocked: UserController.getUserById', () => {
  const makeRequest = (userId: string, requestingUser?: any) =>
    ({
      params: { userId },
      user: requestingUser,
    } as any);

  // Input: existing public user
  // Expected status code: 200
  // Expected behavior: controller returns sanitized profile
  // Expected output: JSON with user summary
  // Mock behavior: userModel.findById resolves user
  test('returns user by id when public', async () => {
    const user = { ...sampleUser(), isPublicProfile: true };
    mockedUserModel.findById.mockResolvedValueOnce(user as any);
    const req = makeRequest(user._id.toString());
    const res = createResponse();
    const next = createNext();

    await controller.getUserById(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User profile fetched successfully',
      data: {
        user: expect.objectContaining({
          _id: user._id,
          name: user.name,
        }),
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: private user requested by other person
  // Expected status code: 403
  // Expected behavior: controller denies access
  // Expected output: message "This profile is private"
  // Mock behavior: userModel.findById resolves private user, req.user mismatched
  test('returns 403 for private user id when requester different', async () => {
    const user = { ...sampleUser(), isPublicProfile: false };
    mockedUserModel.findById.mockResolvedValueOnce(user as any);
    const req = makeRequest(user._id.toString(), { _id: new mongoose.Types.ObjectId() });
    const res = createResponse();
    const next = createNext();

    await controller.getUserById(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'This profile is private',
    });
  });

  // Input: user id absent in database
  // Expected status code: 404
  // Expected behavior: controller returns not found
  // Expected output: message "User not found"
  // Mock behavior: userModel.findById resolves null
  test('returns 404 when user id not found', async () => {
    mockedUserModel.findById.mockResolvedValueOnce(null);
    const req = makeRequest(new mongoose.Types.ObjectId().toString());
    const res = createResponse();
    const next = createNext();

    await controller.getUserById(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User not found',
    });
  });

  // Input: lookup causing model error
  // Expected status code: n/a
  // Expected behavior: controller forwards error
  // Expected output: next called with error
  // Mock behavior: userModel.findById rejects with Error
  test('forwards errors from findById', async () => {
    mockedUserModel.findById.mockRejectedValueOnce(new Error('fail'));
    const req = makeRequest(new mongoose.Types.ObjectId().toString());
    const res = createResponse();
    const next = createNext();

    await controller.getUserById(req, res as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// Interface UserController.searchUsers
describe('Mocked: UserController.searchUsers', () => {
  // Input: missing query parameter
  // Expected status code: 400
  // Expected behavior: controller rejects request
  // Expected output: message "Search query is required"
  // Mock behavior: none
  test('returns 400 when query missing', async () => {
    const req = { query: {}, user: undefined } as any;
    const res = createResponse();
    const next = createNext();

    await controller.searchUsers(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Search query is required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: valid query with mix of public and private users including self
  // Expected status code: 200
  // Expected behavior: controller filters to public users excluding current user
  // Expected output: JSON with filtered list and count
  // Mock behavior: userModel.searchByName resolves full list
  test('returns filtered search results', async () => {
    const currentUserId = new mongoose.Types.ObjectId();
    const users = [
      { ...sampleUser(), _id: currentUserId, isPublicProfile: true },
      { ...sampleUser(), _id: new mongoose.Types.ObjectId(), isPublicProfile: true },
      { ...sampleUser(), _id: new mongoose.Types.ObjectId(), isPublicProfile: false },
    ];
    mockedUserModel.searchByName.mockResolvedValueOnce(users as any);

    const req = {
      query: { query: 'ali' },
      user: { _id: currentUserId.toString() },
    } as any;
    const res = createResponse();
    const next = createNext();

    await controller.searchUsers(req, res as any, next);

    expect(mockedUserModel.searchByName).toHaveBeenCalledWith('ali', 10, expect.any(mongoose.Types.ObjectId));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Search completed successfully',
      data: expect.objectContaining({
        users: expect.arrayContaining([
          expect.objectContaining({ _id: users[1]._id }),
        ]),
        count: 1,
      }),
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: search causing model error
  // Expected status code: n/a
  // Expected behavior: controller forwards error to next()
  // Expected output: next called with error
  // Mock behavior: userModel.searchByName rejects with Error
  test('forwards search errors', async () => {
    mockedUserModel.searchByName.mockRejectedValueOnce(new Error('fail'));
    const req = { query: { query: 'ali' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.searchUsers(req, res as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// Interface UserController.getUserStats
describe('Mocked: UserController.getUserStats', () => {
  // Input: stats exist for user
  // Expected status code: 200
  // Expected behavior: controller returns stats payload
  // Expected output: JSON containing stats object
  // Mock behavior: userModel.getUserStats resolves stats
  test('returns stats when available', async () => {
    const user = { _id: new mongoose.Types.ObjectId() };
    mockedUserModel.getUserStats.mockResolvedValueOnce({
      observationCount: 5,
      speciesDiscovered: 2,
      friendCount: 4,
      badges: ['collector'],
    });

    const req = { user } as any;
    const res = createResponse();
    const next = createNext();

    await controller.getUserStats(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User stats fetched successfully',
      data: {
        observationCount: 5,
        speciesDiscovered: 2,
        friendCount: 4,
        badges: ['collector'],
      },
    });
  });

  // Input: stats not found
  // Expected status code: 404
  // Expected behavior: controller signals missing stats
  // Expected output: message "User stats not found"
  // Mock behavior: userModel.getUserStats resolves null
  test('returns 404 when stats missing', async () => {
    const req = { user: { _id: new mongoose.Types.ObjectId() } } as any;
    mockedUserModel.getUserStats.mockResolvedValueOnce(null);
    const res = createResponse();
    const next = createNext();

    await controller.getUserStats(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User stats not found',
    });
  });

  // Input: stats lookup throws error
  // Expected status code: 500
  // Expected behavior: controller returns failure message
  // Expected output: message with error text
  // Mock behavior: userModel.getUserStats rejects with Error('boom')
  test('returns 500 when stats retrieval fails', async () => {
    const req = { user: { _id: new mongoose.Types.ObjectId() } } as any;
    mockedUserModel.getUserStats.mockRejectedValueOnce(new Error('boom'));
    const res = createResponse();
    const next = createNext();

    await controller.getUserStats(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'boom',
    });
    expect(next).not.toHaveBeenCalled();
  });
});

// Interface UserController.addFavoriteSpecies
describe('Mocked: UserController.addFavoriteSpecies', () => {
  // Input: request without species name
  // Expected status code: 400
  // Expected behavior: controller rejects request
  // Expected output: message "Species name is required"
  // Mock behavior: none
  test('returns 400 when species missing', async () => {
    const req = { user: sampleUser(), body: {} } as any;
    const res = createResponse();
    const next = createNext();

    await controller.addFavoriteSpecies(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Species name is required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: valid species name
  // Expected status code: 200
  // Expected behavior: controller delegates to model and returns success
  // Expected output: message confirming addition
  // Mock behavior: userModel.addFavoriteSpecies resolves
  test('adds favorite species successfully', async () => {
    const user = sampleUser();
    mockedUserModel.addFavoriteSpecies.mockResolvedValueOnce(undefined);

    const req = { user, body: { speciesName: 'Owl' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.addFavoriteSpecies(req, res as any, next);

    expect(mockedUserModel.addFavoriteSpecies).toHaveBeenCalledWith(user._id, 'Owl');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Favorite species added successfully',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: valid species producing error
  // Expected status code: n/a
  // Expected behavior: controller forwards error to next()
  // Expected output: next invoked with error
  // Mock behavior: userModel.addFavoriteSpecies rejects with Error
  test('forwards error when add favorite fails', async () => {
    const user = sampleUser();
    mockedUserModel.addFavoriteSpecies.mockRejectedValueOnce(new Error('fail'));

    const req = { user, body: { speciesName: 'Owl' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.addFavoriteSpecies(req, res as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// Interface UserController.removeFavoriteSpecies
describe('Mocked: UserController.removeFavoriteSpecies', () => {
  // Input: request without species name
  // Expected status code: 400
  // Expected behavior: controller rejects request
  // Expected output: message "Species name is required"
  // Mock behavior: none
  test('returns 400 when species missing', async () => {
    const req = { user: sampleUser(), body: {} } as any;
    const res = createResponse();
    const next = createNext();

    await controller.removeFavoriteSpecies(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Species name is required',
    });
  });

  // Input: request with species name
  // Expected status code: 200
  // Expected behavior: controller removes species and confirms
  // Expected output: message "Favorite species removed successfully"
  // Mock behavior: userModel.removeFavoriteSpecies resolves
  test('removes favorite species successfully', async () => {
    const user = sampleUser();
    mockedUserModel.removeFavoriteSpecies.mockResolvedValueOnce(undefined);

    const req = { user, body: { speciesName: 'Owl' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.removeFavoriteSpecies(req, res as any, next);

    expect(mockedUserModel.removeFavoriteSpecies).toHaveBeenCalledWith(user._id, 'Owl');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Favorite species removed successfully',
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: species removal causing error
  // Expected status code: n/a
  // Expected behavior: controller forwards error to next()
  // Expected output: next invoked with error
  // Mock behavior: userModel.removeFavoriteSpecies rejects
  test('forwards errors when removal fails', async () => {
    const user = sampleUser();
    mockedUserModel.removeFavoriteSpecies.mockRejectedValueOnce(new Error('fail'));

    const req = { user, body: { speciesName: 'Owl' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.removeFavoriteSpecies(req, res as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// Interface UserController.checkUsernameAvailability
describe('Mocked: UserController.checkUsernameAvailability', () => {
  // Input: missing username query
  // Expected status code: 400
  // Expected behavior: controller rejects request
  // Expected output: message "Username is required"
  test('returns 400 when username missing', async () => {
    const req = { query: {} } as any;
    const res = createResponse();
    const next = createNext();

    await controller.checkUsernameAvailability(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Username is required',
    });
  });

  // Input: username with invalid characters
  // Expected status code: 400
  // Expected behavior: controller enforces pattern
  // Expected output: message about invalid format and available false
  test('returns 400 for invalid username format', async () => {
    const req = { query: { username: 'BadName!' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.checkUsernameAvailability(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid username format. Use only lowercase letters, numbers, and underscores.',
      available: false,
    });
  });

  // Input: username that is too short
  // Expected status code: 400
  // Expected behavior: controller enforces length constraints
  // Expected output: message about length and available false
  test('returns 400 for username length violation', async () => {
    const req = { query: { username: 'ab' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.checkUsernameAvailability(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Username must be between 3 and 30 characters.',
      available: false,
    });
  });

  // Input: valid username that is available
  // Expected status code: 200
  // Expected behavior: controller reports availability
  // Expected output: available true, message "Username is available"
  // Mock behavior: userModel.isUsernameAvailable resolves true
  test('returns available status for free username', async () => {
    mockedUserModel.isUsernameAvailable.mockResolvedValueOnce(true);
    const req = { query: { username: 'valid_name' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.checkUsernameAvailability(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Username is available',
      available: true,
      username: 'valid_name',
    });
  });

  // Input: valid username already taken
  // Expected status code: 200
  // Expected behavior: controller reports unavailability
  // Expected output: available false, message "Username is already taken"
  // Mock behavior: userModel.isUsernameAvailable resolves false
  test('returns unavailable status for taken username', async () => {
    mockedUserModel.isUsernameAvailable.mockResolvedValueOnce(false);
    const req = { query: { username: 'taken_name' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.checkUsernameAvailability(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Username is already taken',
      available: false,
      username: 'taken_name',
    });
  });

  // Input: username availability check throwing error
  // Expected status code: n/a
  // Expected behavior: controller forwards error to next()
  // Expected output: next invoked with error
  // Mock behavior: userModel.isUsernameAvailable rejects
  test('forwards errors when availability check fails', async () => {
    mockedUserModel.isUsernameAvailable.mockRejectedValueOnce(new Error('fail'));
    const req = { query: { username: 'valid_name' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.checkUsernameAvailability(req, res as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// Interface UserController.updateFcmToken
describe('Mocked: UserController.updateFcmToken', () => {
  // Input: request without token
  // Expected status code: 400
  // Expected behavior: controller rejects invalid token input
  // Expected output: message "A valid FCM token is required"
  test('returns 400 when token missing', async () => {
    const req = { user: sampleUser(), body: {} } as any;
    const res = createResponse();
    const next = createNext();

    await controller.updateFcmToken(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'A valid FCM token is required',
    });
  });

  // Input: request with token string
  // Expected status code: 200
  // Expected behavior: controller updates user record and confirms
  // Expected output: message "Token updated"
  // Mock behavior: userModel.update resolves
  test('updates token successfully', async () => {
    const user = sampleUser();
    mockedUserModel.update.mockResolvedValueOnce(undefined as any);

    const req = { user, body: { token: 'abc123' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.updateFcmToken(req, res as any, next);

    expect(mockedUserModel.update).toHaveBeenCalledWith(user._id, { fcmToken: 'abc123' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token updated' });
    expect(next).not.toHaveBeenCalled();
  });

  // Input: token update causing error
  // Expected status code: n/a
  // Expected behavior: controller forwards error
  // Expected output: next called with error
  // Mock behavior: userModel.update rejects
  test('forwards errors when update fails', async () => {
    const user = sampleUser();
    mockedUserModel.update.mockRejectedValueOnce(new Error('fail'));

    const req = { user, body: { token: 'abc123' } } as any;
    const res = createResponse();
    const next = createNext();

    await controller.updateFcmToken(req, res as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// Interface UserController.clearFcmToken
describe('Mocked: UserController.clearFcmToken', () => {
  // Input: authenticated user clearing token
  // Expected status code: 200
  // Expected behavior: controller clears token via model
  // Expected output: message "Token cleared"
  // Mock behavior: userModel.update resolves
  test('clears token successfully', async () => {
    const user = sampleUser();
    mockedUserModel.update.mockResolvedValueOnce(undefined as any);

    const req = { user } as any;
    const res = createResponse();
    const next = createNext();

    await controller.clearFcmToken(req, res as any, next);

    expect(mockedUserModel.update).toHaveBeenCalledWith(user._id, { fcmToken: null });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token cleared' });
  });

  // Input: clear token when model throws error
  // Expected status code: n/a
  // Expected behavior: controller forwards error
  // Expected output: next invoked with error instance
  // Mock behavior: userModel.update rejects
  test('forwards errors when clear fails', async () => {
    const user = sampleUser();
    mockedUserModel.update.mockRejectedValueOnce(new Error('fail'));

    const req = { user } as any;
    const res = createResponse();
    const next = createNext();

    await controller.clearFcmToken(req, res as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
