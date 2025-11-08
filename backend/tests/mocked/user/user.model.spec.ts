import { afterAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import mongoose from 'mongoose';

jest.mock('../../../src/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

jest.mock('../../../src/logger.util', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const catalogCountMock = jest.fn();

jest.mock('../../../src/recognition/catalog.model', () => ({
  CatalogModel: {
    countDocuments: jest.fn(() => catalogCountMock()),
  },
}));

import { userModel } from '../../../src/user/user.model';
import type { IUser } from '../../../src/user/user.types';
import { CatalogModel } from '../../../src/recognition/catalog.model';

void CatalogModel;

type AsyncMock<T = any> = jest.MockedFunction<(...args: any[]) => Promise<T>>;

type UserCollectionStub = {
  create?: AsyncMock<IUser>;
  findByIdAndUpdate?: AsyncMock<IUser | null>;
  findByIdAndDelete?: AsyncMock<void>;
  findOne?: AsyncMock<IUser | null>;
  find?: AsyncMock<any>;
  findById?: jest.Mock;
};

const originalCollection = (userModel as any).user;
let collectionStub: UserCollectionStub;

const setCollection = (methods: UserCollectionStub) => {
  collectionStub = {
    create: asyncMock(),
    findByIdAndUpdate: asyncMock(),
    findByIdAndDelete: asyncMock(),
    findOne: asyncMock(),
    find: asyncMock(),
    findById: jest.fn(),
    ...methods,
  };
  (userModel as any).user = collectionStub;
};

const asyncMock = <T = any>() =>
  jest.fn<(...args: any[]) => Promise<T>>();

const objectId = () => new mongoose.Types.ObjectId();

beforeEach(() => {
  jest.restoreAllMocks();
  catalogCountMock.mockReset();
});

afterAll(() => {
  (userModel as any).user = originalCollection;
});

// Interface UserModel.create
describe('Mocked: UserModel.create', () => {
  // Input: Google user info whose base username already exists
  // Expected status code: n/a (model returns created user)
  // Expected behavior: method iterates suffix until available then creates user
  // Expected output: created user with unique username
  // Mock behavior: collection.findOne resolves existing then null, collection.create resolves new user
  test('generates unique username and creates user', async () => {
    const createdUser = { _id: objectId(), username: 'alice_1' };
    const findOne = asyncMock()
      .mockResolvedValueOnce({ _id: objectId() } as any)
      .mockResolvedValueOnce(null);
    const create = asyncMock().mockResolvedValue(createdUser as any);

    setCollection({
      findOne,
      create,
    });

    const result = await userModel.create({
      googleId: 'gid',
      email: 'Alice@example.com',
      name: 'Alice',
    });

    expect(findOne).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'alice_1' })
    );
    expect(result).toEqual(createdUser);
  });

  // Input: Google user info with invalid email (triggers schema error)
  // Expected status code: n/a (method throws)
  // Expected behavior: method throws descriptive validation error
  // Expected output: Error("Invalid update data")
  // Mock behavior: none beyond default
  test('throws Invalid update data when schema validation fails', async () => {
    setCollection({
      findOne: asyncMock().mockResolvedValue(null),
    });

    await expect(
      userModel.create({
        googleId: 'gid',
        email: 'not-an-email',
        name: 'Alice',
      } as any)
    ).rejects.toThrow('Invalid update data');
  });

  // Input: valid Google user info when database create rejects
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps unexpected errors
  // Expected output: Error("Failed to update user")
  // Mock behavior: collection.create rejects with Error('db down')
  test('throws Failed to update user when persistence fails', async () => {
    const create = asyncMock().mockRejectedValue(new Error('db down'));
    setCollection({
      findOne: asyncMock().mockResolvedValue(null),
      create,
    });

    await expect(
      userModel.create({
        googleId: 'gid',
        email: 'alice@example.com',
        name: 'Alice',
      })
    ).rejects.toThrow('Failed to update user');
  });
});

// Interface UserModel.update
describe('Mocked: UserModel.update', () => {
  // Input: partial user object with valid fields
  // Expected status code: n/a (method returns updated user)
  // Expected behavior: method validates payload and updates record
  // Expected output: updated user document
  // Mock behavior: collection.findByIdAndUpdate resolves updated user
  test('returns updated user on success', async () => {
    const updated = { _id: objectId(), name: 'Alice' };
    setCollection({
      findByIdAndUpdate: asyncMock().mockResolvedValue(updated as any),
    });

    const result = await userModel.update(objectId(), { name: 'Alice' });

    expect(collectionStub.findByIdAndUpdate).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  // Input: invalid username with uppercase characters
  // Expected status code: n/a (method throws)
  // Expected behavior: schema validation rejects and method throws generic error
  // Expected output: Error("Failed to update user")
  // Mock behavior: none beyond default
  test('throws when update validation fails', async () => {
    setCollection({});

    await expect(
      userModel.update(objectId(), { username: 'BadName' } as any)
    ).rejects.toThrow('Failed to update user');
  });
});

// Interface UserModel.delete
describe('Mocked: UserModel.delete', () => {
  // Input: user id to delete
  // Expected status code: n/a (method resolves)
  // Expected behavior: method delegates to model without error
  // Expected output: undefined
  // Mock behavior: collection.findByIdAndDelete resolves
  test('deletes user successfully', async () => {
    setCollection({
      findByIdAndDelete: asyncMock().mockResolvedValue(undefined),
    });

    await expect(userModel.delete(objectId())).resolves.toBeUndefined();
  });

  // Input: user id when delete throws
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error
  // Expected output: Error("Failed to delete user")
  // Mock behavior: collection.findByIdAndDelete rejects
  test('throws when delete fails', async () => {
    setCollection({
      findByIdAndDelete: asyncMock().mockRejectedValue(new Error('db fail')),
    });

    await expect(userModel.delete(objectId())).rejects.toThrow(
      'Failed to delete user'
    );
  });
});

// Interface UserModel.findById
describe('Mocked: UserModel.findById', () => {
  // Input: existing id
  // Expected status code: n/a (method resolves to user)
  // Expected behavior: method returns user from collection
  // Expected output: user document
  // Mock behavior: collection.findOne resolves user
  test('returns user when found', async () => {
    const user = { _id: objectId() };
    setCollection({
      findOne: asyncMock().mockResolvedValue(user as any),
    });

    const result = await userModel.findById(objectId());

    expect(result).toEqual(user);
  });

  // Input: non-existent id
  // Expected status code: n/a (method resolves null)
  // Expected behavior: method returns null
  // Expected output: null
  // Mock behavior: collection.findOne resolves null
  test('returns null when user missing', async () => {
    setCollection({
      findOne: asyncMock().mockResolvedValue(null),
    });

    const result = await userModel.findById(objectId());

    expect(result).toBeNull();
  });

  // Input: id lookup causing exception
  // Expected status code: n/a (method throws)
  // Expected behavior: method rethrows as "Failed to find user"
  // Expected output: Error("Failed to find user")
  // Mock behavior: collection.findOne rejects
  test('throws when findById encounters error', async () => {
    setCollection({
      findOne: asyncMock().mockRejectedValue(new Error('fail')),
    });

    await expect(userModel.findById(objectId())).rejects.toThrow(
      'Failed to find user'
    );
  });
});

// Interface UserModel.findByGoogleId
describe('Mocked: UserModel.findByGoogleId', () => {
  // Input: existing googleId
  // Expected status code: n/a (method resolves user)
  // Expected behavior: method returns matching user
  // Expected output: user document
  // Mock behavior: collection.findOne resolves user
  test('returns user when googleId found', async () => {
    const user = { _id: objectId() };
    setCollection({
      findOne: asyncMock().mockResolvedValue(user as any),
    });

    const result = await userModel.findByGoogleId('gid');

    expect(result).toEqual(user);
  });

  // Input: googleId not found
  // Expected status code: n/a (method resolves null)
  // Expected behavior: method yields null
  // Expected output: null
  // Mock behavior: collection.findOne resolves null
  test('returns null when googleId missing', async () => {
    setCollection({
      findOne: asyncMock().mockResolvedValue(null),
    });

    const result = await userModel.findByGoogleId('gid');

    expect(result).toBeNull();
  });

  // Input: googleId lookup throwing
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error
  // Expected output: Error("Failed to find user")
  // Mock behavior: collection.findOne rejects
  test('throws when googleId lookup fails', async () => {
    setCollection({
      findOne: asyncMock().mockRejectedValue(new Error('fail')),
    });

    await expect(userModel.findByGoogleId('gid')).rejects.toThrow(
      'Failed to find user'
    );
  });
});

// Interface UserModel.findByUsername
describe('Mocked: UserModel.findByUsername', () => {
  // Input: existing username in lowercase
  // Expected status code: n/a (method resolves user)
  // Expected behavior: method normalizes username and returns match
  // Expected output: user document
  // Mock behavior: collection.findOne resolves user
  test('returns user by username', async () => {
    const user = { _id: objectId() };
    setCollection({
      findOne: asyncMock().mockResolvedValue(user as any),
    });

    const result = await userModel.findByUsername('Alice');

    expect(collectionStub.findOne).toHaveBeenCalledWith({ username: 'alice' });
    expect(result).toEqual(user);
  });

  // Input: username not present
  // Expected status code: n/a (method resolves null)
  // Expected behavior: method returns null
  // Expected output: null
  // Mock behavior: collection.findOne resolves null
  test('returns null when username missing', async () => {
    setCollection({
      findOne: asyncMock().mockResolvedValue(null),
    });

    const result = await userModel.findByUsername('missing');

    expect(result).toBeNull();
  });

  // Input: username lookup throws error
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error
  // Expected output: Error("Failed to find user")
  // Mock behavior: collection.findOne rejects
  test('throws when username lookup fails', async () => {
    setCollection({
      findOne: asyncMock().mockRejectedValue(new Error('fail')),
    });

    await expect(userModel.findByUsername('alice')).rejects.toThrow(
      'Failed to find user'
    );
  });
});

// Interface UserModel.isUsernameAvailable
describe('Mocked: UserModel.isUsernameAvailable', () => {
  // Input: username not in collection
  // Expected status code: n/a (method resolves true)
  // Expected behavior: method returns true
  // Expected output: true
  // Mock behavior: collection.findOne resolves null
  test('returns true when username available', async () => {
    setCollection({
      findOne: asyncMock().mockResolvedValue(null),
    });

    await expect(userModel.isUsernameAvailable('name')).resolves.toBe(true);
  });

  // Input: username already taken
  // Expected status code: n/a (method resolves false)
  // Expected behavior: method returns false
  // Expected output: false
  // Mock behavior: collection.findOne resolves user
  test('returns false when username taken', async () => {
    setCollection({
      findOne: asyncMock().mockResolvedValue({ _id: objectId() } as any),
    });

    await expect(userModel.isUsernameAvailable('name')).resolves.toBe(false);
  });

  // Input: username lookup throws
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error
  // Expected output: Error("Failed to check username")
  // Mock behavior: collection.findOne rejects
  test('throws when availability check fails', async () => {
    setCollection({
      findOne: asyncMock().mockRejectedValue(new Error('fail')),
    });

    await expect(userModel.isUsernameAvailable('name')).rejects.toThrow(
      'Failed to check username'
    );
  });
});

// Interface UserModel.findByName
describe('Mocked: UserModel.findByName', () => {
  // Input: existing name
  // Expected status code: n/a (method resolves user)
  // Expected behavior: method performs case-insensitive lookup
  // Expected output: user document
  // Mock behavior: collection.findOne resolves user
  test('returns user by name', async () => {
    const user = { _id: objectId() };
    setCollection({
      findOne: asyncMock().mockResolvedValue(user as any),
    });

    const result = await userModel.findByName('Alice');

    expect(collectionStub.findOne).toHaveBeenCalledWith({
      $expr: {
        $eq: [{ $toLower: '$name' }, 'alice'],
      },
    });
    expect(result).toEqual(user);
  });

  // Input: name not found
  // Expected status code: n/a (method resolves null)
  // Expected behavior: method yields null
  // Expected output: null
  // Mock behavior: collection.findOne resolves null
  test('returns null when name missing', async () => {
    setCollection({
      findOne: asyncMock().mockResolvedValue(null),
    });

    const result = await userModel.findByName('Missing');

    expect(result).toBeNull();
  });

  // Input: name lookup error
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error
  // Expected output: Error("Failed to find user")
  // Mock behavior: collection.findOne rejects
  test('throws when name lookup fails', async () => {
    setCollection({
      findOne: asyncMock().mockRejectedValue(new Error('fail')),
    });

    await expect(userModel.findByName('Alice')).rejects.toThrow(
      'Failed to find user'
    );
  });
});

// Interface UserModel.findMany
describe('Mocked: UserModel.findMany', () => {
  // Input: filter with no limit
  // Expected status code: n/a (method resolves array)
  // Expected behavior: method returns results directly
  // Expected output: array of users
  // Mock behavior: collection.find returns promise resolving array
  test('returns results without limit', async () => {
    const users = [{ _id: objectId() }];
    const queryPromise = Promise.resolve(users) as any;
    queryPromise.limit = jest.fn();

    setCollection({
      find: asyncMock().mockReturnValue(queryPromise),
    });

    const result = await userModel.findMany({ name: 'Alice' });

    expect(collectionStub.find).toHaveBeenCalledWith(
      { name: 'Alice' },
      undefined
    );
    expect(result).toEqual(users);
  });

  // Input: filter with limit option
  // Expected status code: n/a (method resolves limited array)
  // Expected behavior: method applies limit
  // Expected output: limited array
  // Mock behavior: collection.find returns promise with limit method returning Promise
  test('applies limit when provided', async () => {
    const users = [{ _id: objectId() }, { _id: objectId() }];
    const queryPromise = Promise.resolve(users) as any;
    queryPromise.limit = jest.fn((limit: number) =>
      Promise.resolve(users.slice(0, limit))
    );

    setCollection({
      find: asyncMock().mockReturnValue(queryPromise),
    });

    const result = await userModel.findMany({ name: 'Alice' }, undefined, {
      limit: 1,
    });

    expect(result).toHaveLength(1);
    expect(queryPromise.limit).toHaveBeenCalledWith(1);
  });

  // Input: filter when find throws error
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error
  // Expected output: Error("Failed to find users")
  // Mock behavior: collection.find throws
  test('throws when findMany fails', async () => {
    setCollection({
      find: asyncMock().mockRejectedValue(new Error('fail')),
    });

    await expect(userModel.findMany({})).rejects.toThrow(
      'Failed to find users'
    );
  });
});

// Interface UserModel.searchByName
describe('Mocked: UserModel.searchByName', () => {
  // Input: query with limit excluding userId
  // Expected status code: n/a (method resolves array)
  // Expected behavior: method applies regex filter and limit
  // Expected output: array of users
  // Mock behavior: collection.find returns promise with limit
  test('searches by name with exclusion', async () => {
    const users = [{ _id: objectId() }];
    const queryPromise = Promise.resolve(users) as any;
    queryPromise.limit = jest.fn(() => Promise.resolve(users));

    setCollection({
      find: asyncMock().mockReturnValue(queryPromise),
    });

    const result = await userModel.searchByName(
      'ali',
      5,
      new mongoose.Types.ObjectId()
    );

    expect(collectionStub.find).toHaveBeenCalledWith(
      expect.objectContaining({
        name: { $regex: 'ali', $options: 'i' },
      })
    );
    expect(result).toEqual(users);
  });

  // Input: search causing error
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error message
  // Expected output: Error("Failed to search users")
  // Mock behavior: collection.find throws
  test('throws when search fails', async () => {
    const queryPromise = Promise.resolve([]) as any;
    queryPromise.limit = jest.fn(() =>
      Promise.reject(new Error('fail'))
    );
    setCollection({
      find: asyncMock().mockReturnValue(queryPromise),
    });

    await expect(
      userModel.searchByName('ali', 10)
    ).rejects.toThrow('Failed to search users');
  });

  // Input: query without explicit limit or exclude id
  // Expected status code: n/a
  // Expected behavior: method applies default limit of 10
  // Expected output: resolved array from mocked query
  // Mock behavior: collection.find returns promise with limit spy
  test('applies default limit when omitted', async () => {
    const users = [{ _id: objectId() }];
    const queryPromise = Promise.resolve(users) as any;
    queryPromise.limit = jest.fn(() => Promise.resolve(users));
    setCollection({
      find: asyncMock().mockReturnValue(queryPromise),
    });

    const result = await userModel.searchByName('ali');

    expect(queryPromise.limit).toHaveBeenCalledWith(10);
    expect(result).toEqual(users);
  });
});

// Interface UserModel.incrementObservationCount
describe('Mocked: UserModel.incrementObservationCount', () => {
  // Input: user id
  // Expected status code: n/a (method resolves)
  // Expected behavior: method increments observation count via $inc
  // Expected output: undefined
  // Mock behavior: collection.findByIdAndUpdate resolves
  test('increments observation count', async () => {
    setCollection({
      findByIdAndUpdate: asyncMock().mockResolvedValue(undefined),
    });

    await expect(
      userModel.incrementObservationCount(objectId())
    ).resolves.toBeUndefined();
  });

  // Input: user id when update throws
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error
  // Expected output: Error("Failed to update observation count")
  // Mock behavior: collection.findByIdAndUpdate rejects
  test('throws when increment fails', async () => {
    setCollection({
      findByIdAndUpdate: asyncMock().mockRejectedValue(new Error('fail')),
    });

    await expect(
      userModel.incrementObservationCount(objectId())
    ).rejects.toThrow('Failed to update observation count');
  });
});

// Interface UserModel.recomputeObservationCount
describe('Mocked: UserModel.recomputeObservationCount', () => {
  // Input: user id
  // Expected status code: n/a (method resolves)
  // Expected behavior: method counts documents then updates observation count
  // Expected output: undefined
  // Mock behavior: CatalogModel.countDocuments resolves count, collection.findByIdAndUpdate resolves
  test('recomputes observation count', async () => {
    catalogCountMock.mockReturnValueOnce(7);
    setCollection({
      findByIdAndUpdate: asyncMock().mockResolvedValue(undefined),
    });

    await expect(
      userModel.recomputeObservationCount(objectId())
    ).resolves.toBeUndefined();

    expect(catalogCountMock).toHaveBeenCalled();
    expect(collectionStub.findByIdAndUpdate).toHaveBeenCalledWith(
      expect.any(mongoose.Types.ObjectId),
      { observationCount: 7 }
    );
  });

  // Input: user id when update throws
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error
  // Expected output: Error("Failed to recompute observation count")
  // Mock behavior: count succeeds, update rejects
  test('throws when recompute update fails', async () => {
    catalogCountMock.mockReturnValueOnce(2);
    setCollection({
      findByIdAndUpdate: asyncMock().mockRejectedValue(new Error('fail')),
    });

    await expect(
      userModel.recomputeObservationCount(objectId())
    ).rejects.toThrow('Failed to recompute observation count');
  });
});

// Interface UserModel.incrementSpeciesDiscovered
describe('Mocked: UserModel.incrementSpeciesDiscovered', () => {
  // Input: user id
  // Expected status code: n/a (method resolves)
  // Expected behavior: method increments species discovered
  // Expected output: undefined
  // Mock behavior: collection.findByIdAndUpdate resolves
  test('increments species discovered', async () => {
    setCollection({
      findByIdAndUpdate: asyncMock().mockResolvedValue(undefined),
    });

    await expect(
      userModel.incrementSpeciesDiscovered(objectId())
    ).resolves.toBeUndefined();
  });

  // Input: user id when increment throws
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error
  // Expected output: Error("Failed to update species discovered")
  // Mock behavior: collection.findByIdAndUpdate rejects
  test('throws when increment species fails', async () => {
    setCollection({
      findByIdAndUpdate: asyncMock().mockRejectedValue(new Error('fail')),
    });

    await expect(
      userModel.incrementSpeciesDiscovered(objectId())
    ).rejects.toThrow('Failed to update species discovered');
  });
});

// Interface UserModel.addFavoriteSpecies
describe('Mocked: UserModel.addFavoriteSpecies', () => {
  // Input: species name
  // Expected status code: n/a (method resolves)
  // Expected behavior: method updates document with $addToSet
  // Expected output: undefined
  // Mock behavior: collection.findByIdAndUpdate resolves
  test('adds favorite species', async () => {
    setCollection({
      findByIdAndUpdate: asyncMock().mockResolvedValue(undefined),
    });

    await expect(
      userModel.addFavoriteSpecies(objectId(), 'Owl')
    ).resolves.toBeUndefined();
  });

  // Input: species update failing
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error
  // Expected output: Error("Failed to add favorite species")
  // Mock behavior: collection.findByIdAndUpdate rejects
  test('throws when add favorite fails', async () => {
    setCollection({
      findByIdAndUpdate: asyncMock().mockRejectedValue(new Error('fail')),
    });

    await expect(
      userModel.addFavoriteSpecies(objectId(), 'Owl')
    ).rejects.toThrow('Failed to add favorite species');
  });
});

// Interface UserModel.removeFavoriteSpecies
describe('Mocked: UserModel.removeFavoriteSpecies', () => {
  // Input: species name
  // Expected status code: n/a (method resolves)
  // Expected behavior: method pulls species from array
  // Expected output: undefined
  // Mock behavior: collection.findByIdAndUpdate resolves
  test('removes favorite species', async () => {
    setCollection({
      findByIdAndUpdate: asyncMock().mockResolvedValue(undefined),
    });

    await expect(
      userModel.removeFavoriteSpecies(objectId(), 'Owl')
    ).resolves.toBeUndefined();
  });

  // Input: removal throwing error
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps exception
  // Expected output: Error("Failed to remove favorite species")
  // Mock behavior: collection.findByIdAndUpdate rejects
  test('throws when remove favorite fails', async () => {
    setCollection({
      findByIdAndUpdate: asyncMock().mockRejectedValue(new Error('fail')),
    });

    await expect(
      userModel.removeFavoriteSpecies(objectId(), 'Owl')
    ).rejects.toThrow('Failed to remove favorite species');
  });
});

// Interface UserModel.addBadge
describe('Mocked: UserModel.addBadge', () => {
  // Input: badge name
  // Expected status code: n/a (method resolves)
  // Expected behavior: method adds badge via $addToSet
  // Expected output: undefined
  // Mock behavior: collection.findByIdAndUpdate resolves
  test('adds badge', async () => {
    setCollection({
      findByIdAndUpdate: asyncMock().mockResolvedValue(undefined),
    });

    await expect(userModel.addBadge(objectId(), 'rookie')).resolves.toBeUndefined();
  });

  // Input: badge addition failing
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error
  // Expected output: Error("Failed to add badge")
  // Mock behavior: collection.findByIdAndUpdate rejects
  test('throws when add badge fails', async () => {
    setCollection({
      findByIdAndUpdate: asyncMock().mockRejectedValue(new Error('fail')),
    });

    await expect(userModel.addBadge(objectId(), 'rookie')).rejects.toThrow(
      'Failed to add badge'
    );
  });
});

// Interface UserModel.incrementFriendCount
describe('Mocked: UserModel.incrementFriendCount', () => {
  // Input: user id
  // Expected status code: n/a (method resolves)
  // Expected behavior: method increments friend count
  // Expected output: undefined
  // Mock behavior: collection.findByIdAndUpdate resolves
  test('increments friend count', async () => {
    setCollection({
      findByIdAndUpdate: asyncMock().mockResolvedValue(undefined),
    });

    await expect(
      userModel.incrementFriendCount(objectId())
    ).resolves.toBeUndefined();
  });

  // Input: increment failing
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error
  // Expected output: Error("Failed to update friend count")
  // Mock behavior: collection.findByIdAndUpdate rejects
  test('throws when increment friend fails', async () => {
    setCollection({
      findByIdAndUpdate: asyncMock().mockRejectedValue(new Error('fail')),
    });

    await expect(
      userModel.incrementFriendCount(objectId())
    ).rejects.toThrow('Failed to update friend count');
  });
});

// Interface UserModel.decrementFriendCount
describe('Mocked: UserModel.decrementFriendCount', () => {
  // Input: user id
  // Expected status code: n/a (method resolves)
  // Expected behavior: method decrements friend count
  // Expected output: undefined
  // Mock behavior: collection.findByIdAndUpdate resolves
  test('decrements friend count', async () => {
    setCollection({
      findByIdAndUpdate: asyncMock().mockResolvedValue(undefined),
    });

    await expect(
      userModel.decrementFriendCount(objectId())
    ).resolves.toBeUndefined();
  });

  // Input: decrement failing
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error
  // Expected output: Error("Failed to update friend count")
  // Mock behavior: collection.findByIdAndUpdate rejects
  test('throws when decrement friend fails', async () => {
    setCollection({
      findByIdAndUpdate: asyncMock().mockRejectedValue(new Error('fail')),
    });

    await expect(
      userModel.decrementFriendCount(objectId())
    ).rejects.toThrow('Failed to update friend count');
  });
});

// Interface UserModel.getUserStats
describe('Mocked: UserModel.getUserStats', () => {
  // Input: user id with stats
  // Expected status code: n/a (method resolves stats)
  // Expected behavior: method selects and maps fields
  // Expected output: stats object
  // Mock behavior: collection.findById returns object with select returning user
  test('returns stats when user exists', async () => {
    const select = asyncMock().mockResolvedValue({
      observationCount: 5,
      speciesDiscovered: 3,
      friendCount: 2,
      badges: ['rookie'],
    });
    setCollection({
      findById: jest.fn().mockReturnValue({ select }),
    });

    const result = await userModel.getUserStats(objectId());

    expect(collectionStub.findById).toHaveBeenCalled();
    expect(result).toEqual({
      observationCount: 5,
      speciesDiscovered: 3,
      friendCount: 2,
      badges: ['rookie'],
    });
  });

  // Input: user id without stats
  // Expected status code: n/a (method resolves null)
  // Expected behavior: method returns null when select resolves null
  // Expected output: null
  // Mock behavior: select resolves null
  test('returns null when stats missing', async () => {
    const select = asyncMock().mockResolvedValue(null);
    setCollection({
      findById: jest.fn().mockReturnValue({ select }),
    });

    const result = await userModel.getUserStats(objectId());

    expect(result).toBeNull();
  });

  // Input: stats lookup failing
  // Expected status code: n/a (method throws)
  // Expected behavior: method wraps error
  // Expected output: Error("Failed to get user stats")
  // Mock behavior: findById throws
  test('throws when stats lookup fails', async () => {
    setCollection({
      findById: jest.fn().mockImplementation(() => {
        throw new Error('fail');
      }),
    });

    await expect(userModel.getUserStats(objectId())).rejects.toThrow(
      'Failed to get user stats'
    );
  });
});
