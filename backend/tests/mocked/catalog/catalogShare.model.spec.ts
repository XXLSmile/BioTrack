// @ts-nocheck
import mongoose from 'mongoose';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../../../src/logger.util', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

import logger from '../../../src/logger.util';
import { CatalogShareModel } from '../../../src/catalog/catalogShare.model';

const getLoggerError = () => (logger.error as jest.Mock);

describe('Mocked: CatalogShareModel', () => {
  let model: CatalogShareModel;
  let shareMock: any;

  beforeEach(() => {
    model = new CatalogShareModel();
    shareMock = {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };
    (model as any).share = shareMock;
    getLoggerError().mockReset();
  });

  // API: CatalogShareModel.createInvitation
  // Input: catalog, owner, invitee, invitedBy, role
  // Expected behavior: forwards payload to mongoose create
  // Expected output: created document
  test('createInvitation stores new invitation document', async () => {
    const payload = {
      catalog: new mongoose.Types.ObjectId(),
      owner: new mongoose.Types.ObjectId(),
      invitee: new mongoose.Types.ObjectId(),
      invitedBy: new mongoose.Types.ObjectId(),
      role: 'editor' as const,
    };
    const doc = { _id: new mongoose.Types.ObjectId(), ...payload };
    shareMock.create.mockResolvedValueOnce(doc);

    const result = await model.createInvitation(
      payload.catalog,
      payload.owner,
      payload.invitee,
      payload.invitedBy,
      payload.role
    );

    expect(shareMock.create).toHaveBeenCalledWith({
      ...payload,
      status: 'pending',
    });
    expect(result).toBe(doc);
  });

  // API: CatalogShareModel.createInvitation
  // Input: create throws
  // Expected behavior: logs error and throws friendly Error
  // Expected output: Error("Failed to create catalog invitation")
  test('createInvitation logs failures', async () => {
    const error = new Error('duplicate');
    shareMock.create.mockRejectedValueOnce(error);

    await expect(
      model.createInvitation(
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        'viewer'
      )
    ).rejects.toThrow('Failed to create catalog invitation');

    expect(getLoggerError()).toHaveBeenCalledWith('Failed to create catalog invitation:', error);
  });

  // API: CatalogShareModel.findByCatalogAndInvitee
  // Input: catalog + invitee ids
  // Expected behavior: calls findOne with filter
  // Expected output: value from findOne
  test('findByCatalogAndInvitee delegates to mongoose findOne', async () => {
    const catalog = new mongoose.Types.ObjectId();
    const invitee = new mongoose.Types.ObjectId();
    const doc = { _id: new mongoose.Types.ObjectId() };
    shareMock.findOne.mockResolvedValueOnce(doc);

    const result = await model.findByCatalogAndInvitee(catalog, invitee);

    expect(shareMock.findOne).toHaveBeenCalledWith({ catalog, invitee });
    expect(result).toBe(doc);
  });

  // API: CatalogShareModel.findById
  // Input: shareId
  // Expected behavior: forwards to findById
  // Expected output: doc
  test('findById resolves document', async () => {
    const shareId = new mongoose.Types.ObjectId();
    const doc = { _id: shareId };
    shareMock.findById.mockResolvedValueOnce(doc);

    const result = await model.findById(shareId);

    expect(shareMock.findById).toHaveBeenCalledWith(shareId);
    expect(result).toBe(doc);
  });

  // API: CatalogShareModel.listCollaborators
  // Input: catalogId
  // Expected behavior: filters out revoked entries and populates invitee/invitedBy
  // Expected output: populated array
  test('listCollaborators filters revoked and populates relationships', async () => {
    const populated = [{ _id: new mongoose.Types.ObjectId() }];
    const secondPopulate = jest.fn() as jest.Mock;
    secondPopulate.mockResolvedValue(populated);
    const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });
    shareMock.find.mockReturnValue({ populate: firstPopulate });

    const result = await model.listCollaborators(new mongoose.Types.ObjectId());

    expect(shareMock.find).toHaveBeenCalledWith({ catalog: expect.any(mongoose.Types.ObjectId), status: { $ne: 'revoked' } });
    expect(firstPopulate).toHaveBeenCalledWith('invitee', 'name username profilePicture');
    expect(secondPopulate).toHaveBeenCalledWith('invitedBy', 'name username profilePicture');
    expect(result).toBe(populated);
  });

  // API: CatalogShareModel.listPendingInvitations
  // Input: invitee id
  // Expected behavior: finds pending invitations and populates catalog + inviter summary
  // Expected output: populated list
  test('listPendingInvitations populates catalog and inviter summaries', async () => {
    const populated = [{ _id: new mongoose.Types.ObjectId() }];
    const secondPopulate = jest.fn() as jest.Mock;
    secondPopulate.mockResolvedValue(populated);
    const firstPopulate = jest.fn().mockReturnValue({ populate: secondPopulate });
    shareMock.find.mockReturnValue({ populate: firstPopulate });

    const result = await model.listPendingInvitations(new mongoose.Types.ObjectId());

    expect(shareMock.find).toHaveBeenCalledWith({ invitee: expect.any(mongoose.Types.ObjectId), status: 'pending' });
    expect(firstPopulate).toHaveBeenCalledWith('catalog');
    expect(secondPopulate).toHaveBeenCalledWith('invitedBy', 'name username profilePicture');
    expect(result).toBe(populated);
  });

  // API: CatalogShareModel.listSharedWithUser
  // Input: user id
  // Expected behavior: finds accepted invitations and populates catalog
  // Expected output: populated entries
  test('listSharedWithUser returns accepted shares', async () => {
    const populated = [{ _id: new mongoose.Types.ObjectId() }];
    const firstPopulate = jest.fn() as jest.Mock;
    firstPopulate.mockResolvedValue(populated);
    shareMock.find.mockReturnValue({ populate: firstPopulate });

    const result = await model.listSharedWithUser(new mongoose.Types.ObjectId());

    expect(shareMock.find).toHaveBeenCalledWith({ invitee: expect.any(mongoose.Types.ObjectId), status: 'accepted' });
    expect(firstPopulate).toHaveBeenCalledWith('catalog');
    expect(result).toBe(populated);
  });

  // API: CatalogShareModel.updateStatus
  // Input: shareId + status
  // Expected behavior: findByIdAndUpdate with respondedAt timestamp
  // Expected output: doc from findByIdAndUpdate
  test('updateStatus updates status with respondedAt timestamp', async () => {
    const shareId = new mongoose.Types.ObjectId();
    const updated = { _id: shareId, status: 'accepted' };
    shareMock.findByIdAndUpdate.mockResolvedValueOnce(updated);

    const result = await model.updateStatus(shareId, 'accepted');

    expect(shareMock.findByIdAndUpdate).toHaveBeenCalledWith(
      shareId,
      expect.objectContaining({ status: 'accepted', respondedAt: expect.any(Date) }),
      { new: true }
    );
    expect(result).toBe(updated);
  });

  // API: CatalogShareModel.updateStatus
  // Input: findByIdAndUpdate throws
  // Expected behavior: logs error and throws friendly Error
  // Expected output: Error("Failed to update catalog share")
  test('updateStatus logs when persistence fails', async () => {
    const error = new Error('db');
    shareMock.findByIdAndUpdate.mockImplementationOnce(() => {
      throw error;
    });

    await expect(model.updateStatus(new mongoose.Types.ObjectId(), 'declined')).rejects.toThrow(
      'Failed to update catalog share'
    );
    expect(getLoggerError()).toHaveBeenCalledWith('Failed to update catalog share status:', error);
  });

  // API: CatalogShareModel.updateRole
  // Input: shareId + new role
  // Expected behavior: update role via findByIdAndUpdate
  // Expected output: updated document; logs on failure
  test('updateRole changes collaborator role', async () => {
    const shareId = new mongoose.Types.ObjectId();
    const updated = { _id: shareId, role: 'editor' };
    shareMock.findByIdAndUpdate.mockResolvedValueOnce(updated);

    const result = await model.updateRole(shareId, 'editor');

    expect(shareMock.findByIdAndUpdate).toHaveBeenCalledWith(
      shareId,
      { role: 'editor' },
      { new: true }
    );
    expect(result).toBe(updated);
  });

  // API: CatalogShareModel.updateRole
  // Input: findByIdAndUpdate throws
  // Expected behavior: logs error and throws friendly Error
  // Expected output: Error("Failed to update collaborator role")
  test('updateRole logs failures', async () => {
    const error = new Error('write');
    shareMock.findByIdAndUpdate.mockImplementationOnce(() => {
      throw error;
    });

    await expect(model.updateRole(new mongoose.Types.ObjectId(), 'viewer')).rejects.toThrow(
      'Failed to update collaborator role'
    );
    expect(getLoggerError()).toHaveBeenCalledWith('Failed to update collaborator role:', error);
  });

  // API: CatalogShareModel.revokeInvitation
  // Input: shareId
  // Expected behavior: updates status to revoked, sets respondedAt
  // Expected output: updated doc; logs on failure
  test('revokeInvitation updates status to revoked', async () => {
    const shareId = new mongoose.Types.ObjectId();
    const updated = { _id: shareId, status: 'revoked' };
    shareMock.findByIdAndUpdate.mockResolvedValueOnce(updated);

    const result = await model.revokeInvitation(shareId);

    expect(shareMock.findByIdAndUpdate).toHaveBeenCalledWith(
      shareId,
      expect.objectContaining({ status: 'revoked', respondedAt: expect.any(Date) }),
      { new: true }
    );
    expect(result).toBe(updated);
  });

  // API: CatalogShareModel.revokeInvitation
  // Input: findByIdAndUpdate throws
  // Expected behavior: logs error and throws friendly message
  // Expected output: Error("Failed to revoke catalog invitation")
  test('revokeInvitation logs persistence errors', async () => {
    const error = new Error('timeout');
    shareMock.findByIdAndUpdate.mockImplementationOnce(() => {
      throw error;
    });

    await expect(model.revokeInvitation(new mongoose.Types.ObjectId())).rejects.toThrow(
      'Failed to revoke catalog invitation'
    );
    expect(getLoggerError()).toHaveBeenCalledWith('Failed to revoke catalog invitation:', error);
  });

  // API: CatalogShareModel.getUserAccess
  // Input: catalog + user id
  // Expected behavior: findOne with accepted status
  // Expected output: doc from findOne
  test('getUserAccess looks up accepted invitation', async () => {
    const catalog = new mongoose.Types.ObjectId();
    const user = new mongoose.Types.ObjectId();
    const doc = { _id: new mongoose.Types.ObjectId(), status: 'accepted' };
    shareMock.findOne.mockResolvedValueOnce(doc);

    const result = await model.getUserAccess(catalog, user);

    expect(shareMock.findOne).toHaveBeenCalledWith({
      catalog,
      invitee: user,
      status: 'accepted',
    });
    expect(result).toBe(doc);
  });
});
