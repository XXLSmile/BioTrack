import mongoose from 'mongoose';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../../../src/logger.util', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { FriendshipModel } from '../../../src/friends/friend.model';
import logger from '../../../src/logger.util';

const objectId = () => new mongoose.Types.ObjectId();

type ModelMocks = {
  create: jest.Mock;
  findOne: jest.Mock;
  find: jest.Mock;
  findById: jest.Mock;
  findByIdAndUpdate: jest.Mock;
  findByIdAndDelete: jest.Mock;
  deleteMany: jest.Mock;
};

const createModelMocks = (): ModelMocks => ({
  create: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  deleteMany: jest.fn(),
});

describe('Mocked: FriendshipModel', () => {
  let model: FriendshipModel;
  let mocks: ReturnType<typeof createModelMocks>;

  beforeEach(() => {
    model = new FriendshipModel();
    mocks = createModelMocks();
    (model as any).friendship = mocks;
    jest.clearAllMocks();
  });

  // API: FriendshipModel.createRequest
  // Input: requester and addressee ObjectIds
  // Expected behavior: delegates to mongoose model create
  // Expected output: created friendship document
  test('createRequest persists pending friendship', async () => {
    const requester = objectId();
    const addressee = objectId();
    const createdDoc = { _id: objectId(), requester, addressee, status: 'pending' };
    mocks.create.mockImplementationOnce(async () => createdDoc);

    const result = await model.createRequest(requester, addressee);

    expect(mocks.create).toHaveBeenCalledWith({
      requester,
      addressee,
      status: 'pending',
    });
    expect(result).toBe(createdDoc);
  });

  // API: FriendshipModel.createRequest
  // Input: mongoose create throws
  // Expected behavior: logs error and rethrows friendly message
  // Expected output: thrown Error("Failed to create friend request")
  test('createRequest logs and rethrows when persistence fails', async () => {
    const error = new Error('duplicate key');
    mocks.create.mockImplementationOnce(async () => {
      throw error;
    });

    await expect(model.createRequest(objectId(), objectId())).rejects.toThrow(
      'Failed to create friend request'
    );
    expect(logger.error).toHaveBeenCalledWith('Failed to create friend request:', error);
  });

  // API: FriendshipModel.findRequestBetween
  // Input: two user ObjectIds
  // Expected behavior: queries with $or pairing both directions
  // Expected output: friendship document from findOne
  test('findRequestBetween queries both requester/addressee permutations', async () => {
    const userA = objectId();
    const userB = objectId();
    const friendship = { _id: objectId() };
    mocks.findOne.mockImplementationOnce(async () => friendship);

    const result = await model.findRequestBetween(userA, userB);

    expect(mocks.findOne).toHaveBeenCalledWith({
      $or: [
        { requester: userA, addressee: userB },
        { requester: userB, addressee: userA },
      ],
    });
    expect(result).toBe(friendship);
  });

  // API: FriendshipModel.getPendingForUser
  // Input: addressee id
  // Expected behavior: find pending requests and populate requester summary
  // Expected output: populated array returned by populate chain
  test('getPendingForUser populates requester details', async () => {
    const userId = objectId();
    const populated = [{ _id: objectId() }];
    const populate = jest.fn().mockImplementationOnce(async () => populated);
    mocks.find.mockReturnValueOnce({ populate });

    const result = await model.getPendingForUser(userId);

    expect(mocks.find).toHaveBeenCalledWith({ addressee: userId, status: 'pending' });
    expect(populate).toHaveBeenCalledWith('requester', 'name username profilePicture');
    expect(result).toBe(populated);
  });

  // API: FriendshipModel.getOutgoingForUser
  // Input: requester id
  // Expected behavior: find pending requests and populate addressee summary
  // Expected output: populated results
  test('getOutgoingForUser populates addressee details', async () => {
    const userId = objectId();
    const populated = [{ _id: objectId() }];
    const populate = jest.fn().mockImplementationOnce(async () => populated);
    mocks.find.mockReturnValueOnce({ populate });

    const result = await model.getOutgoingForUser(userId);

    expect(mocks.find).toHaveBeenCalledWith({ requester: userId, status: 'pending' });
    expect(populate).toHaveBeenCalledWith('addressee', 'name username profilePicture');
    expect(result).toBe(populated);
  });

  // API: FriendshipModel.getFriendsForUser
  // Input: user id
  // Expected behavior: find accepted friendships and populate both requester/addressee
  // Expected output: doubly populated results
  test('getFriendsForUser populates both participants', async () => {
    const userId = objectId();
    const populated = [{ _id: objectId() }];
    const secondPopulate = jest.fn().mockImplementationOnce(async () => populated);
    const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });
    mocks.find.mockReturnValueOnce({ populate: firstPopulate });

    const result = await model.getFriendsForUser(userId);

    expect(mocks.find).toHaveBeenCalledWith({
      status: 'accepted',
      $or: [{ requester: userId }, { addressee: userId }],
    });
    expect(firstPopulate).toHaveBeenCalledWith('requester', 'name username profilePicture');
    expect(secondPopulate).toHaveBeenCalledWith('addressee', 'name username profilePicture');
    expect(result).toBe(populated);
  });

  // API: FriendshipModel.getAcceptedFriendshipsForUsers
  // Input: empty array
  // Expected behavior: returns early without hitting database
  // Expected output: empty array
  test('getAcceptedFriendshipsForUsers short-circuits on empty input', async () => {
    const result = await model.getAcceptedFriendshipsForUsers([]);
    expect(result).toEqual([]);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  // API: FriendshipModel.getAcceptedFriendshipsForUsers
  // Input: list of user ids
  // Expected behavior: queries accepted friendships matching requester or addressee in list
  // Expected output: documents returned by find
  test('getAcceptedFriendshipsForUsers queries accepted friendships for provided ids', async () => {
    const ids = [objectId(), objectId()];
    const docs = [{ _id: objectId() }];
    mocks.find.mockImplementationOnce(async () => docs);

    const result = await model.getAcceptedFriendshipsForUsers(ids);

    expect(mocks.find).toHaveBeenCalledWith({
      status: 'accepted',
      $or: [
        { requester: { $in: ids } },
        { addressee: { $in: ids } },
      ],
    });
    expect(result).toBe(docs);
  });

  // API: FriendshipModel.getRelationshipsForUser
  // Input: user id
  // Expected behavior: finds all friendships where user is requester or addressee
  // Expected output: raw documents from find
  test('getRelationshipsForUser returns friendships involving user', async () => {
    const userId = objectId();
    const docs = [{ _id: objectId() }];
    mocks.find.mockImplementationOnce(async () => docs);

    const result = await model.getRelationshipsForUser(userId);

    expect(mocks.find).toHaveBeenCalledWith({
      $or: [{ requester: userId }, { addressee: userId }],
    });
    expect(result).toBe(docs);
  });

  // API: FriendshipModel.findById
  // Input: friendship id
  // Expected behavior: delegates to mongoose findById
  // Expected output: document returned by findById
  test('findById delegates to mongoose model', async () => {
    const id = objectId();
    const doc = { _id: id };
    mocks.findById.mockImplementationOnce(async () => doc);

    const result = await model.findById(id);

    expect(mocks.findById).toHaveBeenCalledWith(id);
    expect(result).toBe(doc);
  });

  // API: FriendshipModel.updateRequestStatus
  // Input: friendship id and status
  // Expected behavior: updates status and respondedAt timestamp
  // Expected output: updated document from findByIdAndUpdate
  test('updateRequestStatus updates status with responded timestamp', async () => {
    const id = objectId();
    const updated = { _id: id, status: 'accepted' };
    mocks.findByIdAndUpdate.mockImplementationOnce(async () => updated);

    const result = await model.updateRequestStatus(id, 'accepted');

    expect(mocks.findByIdAndUpdate).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ status: 'accepted' }),
      { new: true }
    );
    expect(result).toBe(updated);
  });

  // API: FriendshipModel.updateRequestStatus
  // Input: persistence throws
  // Expected behavior: logs error and throws domain error
  // Expected output: Error("Failed to update friend request")
  test('updateRequestStatus propagates errors with friendly message', async () => {
    const error = new Error('write failed');
    mocks.findByIdAndUpdate.mockImplementationOnce(async () => {
      throw error;
    });

    await expect(model.updateRequestStatus(objectId(), 'declined')).rejects.toThrow(
      'Failed to update friend request'
    );
    expect(logger.error).toHaveBeenCalledWith('Failed to update friend request:', error);
  });

  // API: FriendshipModel.deleteFriendship
  // Input: friendship id
  // Expected behavior: deletes document via findByIdAndDelete
  // Expected output: resolves void
  test('deleteFriendship removes friendship', async () => {
    const id = objectId();
    mocks.findByIdAndDelete.mockImplementationOnce(async () => undefined);

    await model.deleteFriendship(id);

    expect(mocks.findByIdAndDelete).toHaveBeenCalledWith(id);
  });

  // API: FriendshipModel.deleteFriendship
  // Input: deletion throws
  // Expected behavior: logs error and rethrows friendly message
  // Expected output: Error("Failed to delete friendship")
  test('deleteFriendship logs and rethrows errors', async () => {
    const error = new Error('network');
    mocks.findByIdAndDelete.mockImplementationOnce(async () => {
      throw error;
    });

    await expect(model.deleteFriendship(objectId())).rejects.toThrow('Failed to delete friendship');
    expect(logger.error).toHaveBeenCalledWith('Failed to delete friendship:', error);
  });

  // API: FriendshipModel.deleteAllForUser
  // Input: user id with accepted and pending friendships
  // Expected behavior: returns ids of accepted friends and deletes all relationships for user
  // Expected output: array of ObjectIds for accepted friendships
  test('deleteAllForUser returns accepted friend ids before deletion', async () => {
    const userId = objectId();
    const acceptedFriendId = objectId();
    const pendingFriendId = objectId();
    mocks.find.mockImplementationOnce(async () => [
      {
        requester: userId,
        addressee: acceptedFriendId,
        status: 'accepted',
      },
      {
        requester: pendingFriendId,
        addressee: userId,
        status: 'pending',
      },
    ]);
    mocks.deleteMany.mockImplementationOnce(async () => undefined);

    const result = await model.deleteAllForUser(userId);

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      $or: [{ requester: userId }, { addressee: userId }],
    });
    expect(result).toEqual([acceptedFriendId]);
  });

  // API: FriendshipModel.deleteAllForUser
  // Input: only accepted friendships where the user is the addressee
  // Expected behavior: method returns requester ids before deleting records
  // Expected output: array containing the requester's ObjectId
  test('deleteAllForUser returns requester ids when user is addressee', async () => {
    const userId = objectId();
    const requesterId = objectId();
    mocks.find.mockImplementationOnce(async () => [
      {
        requester: requesterId,
        addressee: userId,
        status: 'accepted',
      },
    ]);
    mocks.deleteMany.mockImplementationOnce(async () => undefined);

    const result = await model.deleteAllForUser(userId);

    expect(result).toEqual([requesterId]);
  });

  // API: FriendshipModel.deleteAllForUser
  // Input: find throws
  // Expected behavior: logs error and rethrows domain message
  // Expected output: Error("Failed to delete friendships for user")
  test('deleteAllForUser rethrows when lookup fails', async () => {
    const error = new Error('lookup failed');
    mocks.find.mockImplementationOnce(async () => {
      throw error;
    });

    await expect(model.deleteAllForUser(objectId())).rejects.toThrow(
      'Failed to delete friendships for user'
    );
    expect(logger.error).toHaveBeenCalledWith('Failed to delete friendships for user:', error);
  });
});
