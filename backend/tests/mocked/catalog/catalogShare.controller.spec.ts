// @ts-nocheck
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import mongoose from 'mongoose';

jest.mock('../../../src/logger.util', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/catalog/catalog.model', () => ({
  catalogModel: {
    findById: jest.fn(),
  },
}));

jest.mock('../../../src/catalog/catalogShare.model', () => ({
  catalogShareModel: {
    listCollaborators: jest.fn(),
    findByCatalogAndInvitee: jest.fn(),
    createInvitation: jest.fn(),
    findById: jest.fn(),
    revokeInvitation: jest.fn(),
    updateRole: jest.fn(),
    updateStatus: jest.fn(),
    listPendingInvitations: jest.fn(),
    listSharedWithUser: jest.fn(),
  },
}));

jest.mock('../../../src/user/user.model', () => ({
  userModel: {
    findById: jest.fn(),
  },
}));

jest.mock('../../../src/firebase', () => ({
  messaging: { send: jest.fn() },
  default: { messaging: { send: jest.fn() } },
}));

import { CatalogShareController } from '../../../src/catalog/catalogShare.controller';
import { catalogModel } from '../../../src/catalog/catalog.model';
import { catalogShareModel } from '../../../src/catalog/catalogShare.model';
import { userModel } from '../../../src/user/user.model';
import { messaging } from '../../../src/firebase';

const catalogModelMock = catalogModel as any;
const catalogShareModelMock = catalogShareModel as any;
const userModelMock = userModel as any;
const messagingMock = messaging as any;

const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const getJsonPayload = (res: any) => (res.json as jest.Mock).mock.calls[0]?.[0];

describe('Mocked: CatalogShareController', () => {
  let controller: CatalogShareController;

  beforeEach(() => {
    controller = new CatalogShareController();
    jest.clearAllMocks();
  });

  // API: GET /api/catalogs/:catalogId/share
  // Input: missing authenticated user
  // Expected status code: 401
  test('listCollaborators requires authentication', async () => {
    const req: any = { user: undefined, params: { catalogId: 'cat' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.listCollaborators(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // API: POST /api/catalogs/:catalogId/share
  // Input: missing authenticated user
  // Expected status code: 401
  test('inviteCollaborator requires authenticated user', async () => {
    const req: any = { user: undefined, params: { catalogId: 'cat' }, body: { inviteeId: 'id', role: 'viewer' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.inviteCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // API: PATCH /api/catalogs/:catalogId/share/:shareId
  // Input: missing authenticated user
  // Expected status code: 401
  test('updateCollaborator requires authenticated user', async () => {
    const req: any = { user: undefined, params: { catalogId: 'cat', shareId: 'share' }, body: { role: 'viewer' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.updateCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // API: PATCH /api/catalogs/share/:shareId/respond
  // Input: missing authenticated user
  // Expected status code: 401
  test('respondToInvitation requires authenticated user', async () => {
    const req: any = { user: undefined, params: { shareId: 'share' }, body: { action: 'accept' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.respondToInvitation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // API: GET /api/catalog/share/pending
  // Input: missing authenticated user
  // Expected status code: 401
  test('listPendingInvitations requires authenticated user', async () => {
    const req: any = { user: undefined };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.listPendingInvitations(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // API: GET /api/catalog/shared-with/me
  // Input: missing authenticated user
  // Expected status code: 401
  test('listSharedWithMe requires authenticated user', async () => {
    const req: any = { user: undefined };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.listSharedWithMe(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // API: GET /api/catalogs/:catalogId/collaborators (CatalogShareController.listCollaborators)
  // Input: owner requesting collaborators
  // Expected status code: 200
  // Expected behavior: returns collaborators array
  // Expected output: JSON payload with collaborators list
  test('listCollaborators returns collaborators for owner', async () => {
    const owner = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), owner });
    const collaborators = [{ _id: new mongoose.Types.ObjectId() }];
    catalogShareModelMock.listCollaborators.mockResolvedValueOnce(collaborators);
    const req: any = { user: { _id: owner }, params: { catalogId: 'cat' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.listCollaborators(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(getJsonPayload(res)?.data?.collaborators).toBe(collaborators);
  });

  // API: GET /api/catalogs/:catalogId/collaborators (CatalogShareController.listCollaborators)
  // Input: catalog not found
  // Expected status code: 404
  // Expected output: JSON error message
  test('listCollaborators returns 404 when catalog missing', async () => {
    catalogModelMock.findById.mockResolvedValueOnce(null);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'cat' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.listCollaborators(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: GET /api/catalogs/:catalogId/collaborators (CatalogShareController.listCollaborators)
  // Input: user not owner
  // Expected status code: 403
  // Expected behavior: denies access
  test('listCollaborators enforces owner-only access', async () => {
    catalogModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), owner: new mongoose.Types.ObjectId() });
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'cat' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.listCollaborators(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // API: GET /api/catalogs/:catalogId/collaborators (CatalogShareController.listCollaborators)
  // Input: model throws
  // Expected behavior: forwards error via next
  test('listCollaborators forwards errors to next', async () => {
    const error = new Error('fail');
    catalogModelMock.findById.mockRejectedValueOnce(error);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() }, params: { catalogId: 'cat' } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.listCollaborators(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // API: POST /api/catalogs/:catalogId/collaborators (CatalogShareController.inviteCollaborator)
  // Input: owner inviting user with FCM token
  // Expected status code: 201
  // Expected behavior: creates invitation, attempts FCM send
  // Expected output: JSON payload with invitation
  test('inviteCollaborator creates invitation and sends FCM notification', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner, name: 'Bird Log' };
    const inviteeId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    userModelMock.findById.mockResolvedValueOnce({ _id: inviteeId, fcmToken: 'token123', username: 'invitee' });
    catalogShareModelMock.findByCatalogAndInvitee.mockResolvedValueOnce(null);
    const invitation = { _id: new mongoose.Types.ObjectId(), invitee: inviteeId, role: 'viewer' };
    catalogShareModelMock.createInvitation.mockResolvedValueOnce(invitation);
    const req: any = {
      user: { _id: owner, name: 'Owner' },
      params: { catalogId: catalog._id.toString() },
      body: { inviteeId: inviteeId.toString(), role: 'viewer' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.inviteCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(getJsonPayload(res)?.data?.invitation).toBe(invitation);
    expect(messagingMock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'token123',
        data: expect.objectContaining({ catalogId: catalog._id.toString() }),
      })
    );
  });

  // API: POST /api/catalogs/:catalogId/collaborators (CatalogShareController.inviteCollaborator)
  // Input: existing revoked invitation
  // Expected status code: 200
  // Expected behavior: reactivates invitation without creating new record
  // Expected output: invitation returned with pending status
  test('inviteCollaborator re-sends revoked invitations', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner, name: 'Catalog' };
    const inviteeId = new mongoose.Types.ObjectId();
    const revokedInvitation = {
      _id: new mongoose.Types.ObjectId(),
      status: 'revoked',
      role: 'viewer',
      save: jest.fn(),
    };
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    userModelMock.findById.mockResolvedValueOnce({ _id: inviteeId });
    catalogShareModelMock.findByCatalogAndInvitee.mockResolvedValueOnce(revokedInvitation);
    const req: any = {
      user: { _id: owner, name: 'Owner' },
      params: { catalogId: catalog._id.toString() },
      body: { inviteeId: inviteeId.toString(), role: 'editor' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.inviteCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(revokedInvitation.save).toHaveBeenCalled();
    expect(getJsonPayload(res)?.data?.invitation).toBe(revokedInvitation);
    expect(catalogShareModelMock.createInvitation).not.toHaveBeenCalled();
  });

  // API: POST /api/catalogs/:catalogId/collaborators (CatalogShareController.inviteCollaborator)
  // Input: pending invitation already exists
  // Expected status code: 409
  // Expected behavior: returns conflict without sending invite
  test('inviteCollaborator rejects duplicate invitations', async () => {
    const owner = new mongoose.Types.ObjectId();
    const inviteeId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), owner });
    userModelMock.findById.mockResolvedValueOnce({ _id: inviteeId });
    catalogShareModelMock.findByCatalogAndInvitee.mockResolvedValueOnce({ status: 'pending' });
    const req: any = {
      user: { _id: owner },
      params: { catalogId: 'cat' },
      body: { inviteeId: inviteeId.toString(), role: 'viewer' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.inviteCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  // API: POST /api/catalogs/:catalogId/collaborators (CatalogShareController.inviteCollaborator)
  // Input: invitee same as owner
  // Expected status code: 400
  // Expected behavior: rejects self-invite
  test('inviteCollaborator prevents inviting oneself', async () => {
    const owner = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), owner });
    const req: any = {
      user: { _id: owner },
      params: { catalogId: 'cat' },
      body: { inviteeId: owner.toString(), role: 'viewer' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.inviteCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // API: POST /api/catalogs/:catalogId/collaborators (CatalogShareController.inviteCollaborator)
  // Input: invitee not found
  // Expected status code: 404
  test('inviteCollaborator returns 404 when invitee missing', async () => {
    const owner = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), owner });
    userModelMock.findById.mockResolvedValueOnce(null);
    const req: any = {
      user: { _id: owner },
      params: { catalogId: 'cat' },
      body: { inviteeId: new mongoose.Types.ObjectId().toString(), role: 'viewer' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.inviteCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: POST /api/catalogs/:catalogId/collaborators (CatalogShareController.inviteCollaborator)
  // Input: requester not owner
  // Expected status code: 403
  test('inviteCollaborator enforces owner-only guard', async () => {
    catalogModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), owner: new mongoose.Types.ObjectId() });
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { catalogId: 'cat' },
      body: { inviteeId: new mongoose.Types.ObjectId().toString(), role: 'viewer' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.inviteCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // API: POST /api/catalogs/:catalogId/collaborators (CatalogShareController.inviteCollaborator)
  // Input: catalog missing
  // Expected status code: 404
  test('inviteCollaborator returns 404 when catalog missing', async () => {
    catalogModelMock.findById.mockResolvedValueOnce(null);
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { catalogId: 'cat' },
      body: { inviteeId: new mongoose.Types.ObjectId().toString(), role: 'viewer' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.inviteCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: POST /api/catalogs/:catalogId/collaborators (CatalogShareController.inviteCollaborator)
  // Input: FCM send throws
  // Expected behavior: controller logs warning but still returns 201
  test('inviteCollaborator swallows FCM failures', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner, name: 'Catalog' };
    const inviteeId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    userModelMock.findById.mockResolvedValueOnce({ _id: inviteeId, fcmToken: 'token' });
    catalogShareModelMock.findByCatalogAndInvitee.mockResolvedValueOnce(null);
    catalogShareModelMock.createInvitation.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId() });
    messagingMock.send.mockRejectedValueOnce(new Error('fcm down'));
    const req: any = {
      user: { _id: owner, name: 'Owner' },
      params: { catalogId: catalog._id.toString() },
      body: { inviteeId: inviteeId.toString(), role: 'viewer' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.inviteCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  // API: POST /api/catalogs/:catalogId/collaborators (CatalogShareController.inviteCollaborator)
  // Input: unexpected error
  // Expected behavior: forwards to next
  test('inviteCollaborator forwards unexpected errors', async () => {
    const owner = new mongoose.Types.ObjectId();
    const error = new Error('create fail');
    catalogModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), owner });
    userModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId() });
    catalogShareModelMock.findByCatalogAndInvitee.mockResolvedValueOnce(null);
    catalogShareModelMock.createInvitation.mockRejectedValueOnce(error);
    const req: any = {
      user: { _id: owner },
      params: { catalogId: 'cat' },
      body: { inviteeId: new mongoose.Types.ObjectId().toString(), role: 'viewer' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.inviteCollaborator(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // API: PATCH /api/catalogs/:catalogId/collaborators/:shareId (CatalogShareController.updateCollaborator)
  // Input: catalog missing
  // Expected status code: 404
  test('updateCollaborator returns 404 when catalog missing', async () => {
    catalogModelMock.findById.mockResolvedValueOnce(null);
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { catalogId: 'cat', shareId: new mongoose.Types.ObjectId().toString() },
      body: { role: 'viewer' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.updateCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: PATCH /api/catalogs/:catalogId/collaborators/:shareId (CatalogShareController.updateCollaborator)
  // Input: user not owner
  // Expected status code: 403
  test('updateCollaborator enforces owner guard', async () => {
    catalogModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), owner: new mongoose.Types.ObjectId() });
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { catalogId: 'cat', shareId: new mongoose.Types.ObjectId().toString() },
      body: { role: 'viewer' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.updateCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // API: PATCH /api/catalogs/:catalogId/collaborators/:shareId (CatalogShareController.updateCollaborator)
  // Input: share not found or mismatched
  // Expected status code: 404
  test('updateCollaborator requires invitation belonging to catalog', async () => {
    const owner = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), owner });
    catalogShareModelMock.findById.mockResolvedValueOnce(null);
    const req: any = {
      user: { _id: owner },
      params: { catalogId: 'cat', shareId: new mongoose.Types.ObjectId().toString() },
      body: { role: 'viewer' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.updateCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: PATCH /api/catalogs/:catalogId/collaborators/:shareId (CatalogShareController.updateCollaborator)
  // Input: revoke action
  // Expected status code: 200
  // Expected behavior: delegates to catalogShareModel.revokeInvitation
  test('updateCollaborator supports revoke action', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner };
    const shareId = new mongoose.Types.ObjectId();
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogShareModelMock.findById.mockResolvedValueOnce({ _id: shareId, catalog: catalog._id });
    const revoked = { _id: shareId, status: 'revoked' };
    catalogShareModelMock.revokeInvitation.mockResolvedValueOnce(revoked);
    const req: any = {
      user: { _id: owner },
      params: { catalogId: catalog._id.toString(), shareId: shareId.toString() },
      body: { action: 'revoke' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.updateCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(getJsonPayload(res)?.data?.invitation).toBe(revoked);
  });

  // API: PATCH /api/catalogs/:catalogId/collaborators/:shareId (CatalogShareController.updateCollaborator)
  // Input: role update
  // Expected status code: 200
  test('updateCollaborator updates collaborator role', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner };
    const shareId = new mongoose.Types.ObjectId();
    const updatedShare = { _id: shareId, role: 'editor', catalog: catalog._id };
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogShareModelMock.findById.mockResolvedValueOnce({ _id: shareId, catalog: catalog._id });
    catalogShareModelMock.updateRole.mockResolvedValueOnce(updatedShare);
    const req: any = {
      user: { _id: owner },
      params: { catalogId: catalog._id.toString(), shareId: shareId.toString() },
      body: { role: 'editor' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.updateCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  // API: PATCH /api/catalogs/:catalogId/collaborators/:shareId (CatalogShareController.updateCollaborator)
  // Input: updateRole/revoke returns null
  // Expected status code: 500
  test('updateCollaborator returns 500 when underlying update fails', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner };
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogShareModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), catalog: catalog._id });
    catalogShareModelMock.updateRole.mockResolvedValueOnce(null);
    const req: any = {
      user: { _id: owner },
      params: { catalogId: catalog._id.toString(), shareId: new mongoose.Types.ObjectId().toString() },
      body: { role: 'viewer' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.updateCollaborator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // API: PATCH /api/catalogs/:catalogId/collaborators/:shareId (CatalogShareController.updateCollaborator)
  // Input: unexpected error
  // Expected behavior: forwards to next
  test('updateCollaborator forwards unexpected errors', async () => {
    const owner = new mongoose.Types.ObjectId();
    const catalog = { _id: new mongoose.Types.ObjectId(), owner };
    const error = new Error('update fail');
    catalogModelMock.findById.mockResolvedValueOnce(catalog);
    catalogShareModelMock.findById.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId(), catalog: catalog._id });
    catalogShareModelMock.updateRole.mockRejectedValueOnce(error);
    const req: any = {
      user: { _id: owner },
      params: { catalogId: catalog._id.toString(), shareId: new mongoose.Types.ObjectId().toString() },
      body: { role: 'viewer' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.updateCollaborator(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // API: POST /api/catalogShares/:shareId/respond (CatalogShareController.respondToInvitation)
  // Input: invitation missing
  // Expected status code: 404
  test('respondToInvitation returns 404 when invitation missing', async () => {
    catalogShareModelMock.findById.mockResolvedValueOnce(null);
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { shareId: new mongoose.Types.ObjectId().toString() },
      body: { action: 'accept' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.respondToInvitation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // API: POST /api/catalogShares/:shareId/respond (CatalogShareController.respondToInvitation)
  // Input: invitee mismatch
  // Expected status code: 403
  test('respondToInvitation enforces invitee identity', async () => {
    catalogShareModelMock.findById.mockResolvedValueOnce({
      invitee: new mongoose.Types.ObjectId(),
      status: 'pending',
      catalog: new mongoose.Types.ObjectId(),
    });
    const req: any = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { shareId: new mongoose.Types.ObjectId().toString() },
      body: { action: 'accept' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.respondToInvitation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // API: POST /api/catalogShares/:shareId/respond (CatalogShareController.respondToInvitation)
  // Input: invitation not pending
  // Expected status code: 400
  test('respondToInvitation rejects non-pending invitations', async () => {
    const invitee = new mongoose.Types.ObjectId();
    catalogShareModelMock.findById.mockResolvedValueOnce({
      invitee,
      status: 'accepted',
      catalog: new mongoose.Types.ObjectId(),
    });
    const req: any = {
      user: { _id: invitee },
      params: { shareId: new mongoose.Types.ObjectId().toString() },
      body: { action: 'accept' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.respondToInvitation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // API: POST /api/catalogShares/:shareId/respond (CatalogShareController.respondToInvitation)
  // Input: updateStatus returns null
  // Expected status code: 500
  test('respondToInvitation returns 500 when updateStatus fails', async () => {
    const invitee = new mongoose.Types.ObjectId();
    const invitation = {
      _id: new mongoose.Types.ObjectId(),
      invitee,
      status: 'pending',
      catalog: new mongoose.Types.ObjectId(),
    };
    catalogShareModelMock.findById.mockResolvedValueOnce(invitation);
    catalogShareModelMock.updateStatus.mockResolvedValueOnce(null);
    const req: any = {
      user: { _id: invitee },
      params: { shareId: invitation._id.toString() },
      body: { action: 'accept' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.respondToInvitation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // API: POST /api/catalogShares/:shareId/respond (CatalogShareController.respondToInvitation)
  // Input: accept invitation with owner FCM token
  // Expected status code: 200
  // Expected behavior: updates status, notifies owner
  test('respondToInvitation accepts invitation and notifies owner', async () => {
    const invitee = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const invitation = {
      _id: new mongoose.Types.ObjectId(),
      invitee,
      status: 'pending',
      catalog: catalogId,
    };
    catalogShareModelMock.findById.mockResolvedValueOnce(invitation);
    const updatedInvitation = { ...invitation, status: 'accepted' };
    catalogShareModelMock.updateStatus.mockResolvedValueOnce(updatedInvitation);
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner: ownerId, name: 'Catalog' });
    userModelMock.findById.mockResolvedValueOnce({ _id: ownerId, fcmToken: 'token', username: 'owner' });
    messagingMock.send.mockResolvedValueOnce(undefined);
    const req: any = {
      user: { _id: invitee, name: 'Invitee', username: 'invitee' },
      params: { shareId: invitation._id.toString() },
      body: { action: 'accept' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.respondToInvitation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(messagingMock.send).toHaveBeenCalled();
  });

  // API: POST /api/catalogShares/:shareId/respond (CatalogShareController.respondToInvitation)
  // Input: decline invitation with FCM failure
  // Expected status code: 200
  // Expected behavior: catches notification failure
  test('respondToInvitation handles notification failures gracefully', async () => {
    const invitee = new mongoose.Types.ObjectId();
    const catalogId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const invitation = {
      _id: new mongoose.Types.ObjectId(),
      invitee,
      status: 'pending',
      catalog: catalogId,
    };
    catalogShareModelMock.findById.mockResolvedValueOnce(invitation);
    const updated = { ...invitation, status: 'declined' };
    catalogShareModelMock.updateStatus.mockResolvedValueOnce(updated);
    catalogModelMock.findById.mockResolvedValueOnce({ _id: catalogId, owner: ownerId, name: 'Catalog' });
    userModelMock.findById.mockResolvedValueOnce({ _id: ownerId, fcmToken: 'token' });
    messagingMock.send.mockRejectedValueOnce(new Error('fcm fail'));
    const req: any = {
      user: { _id: invitee, name: 'Invitee', username: 'invitee' },
      params: { shareId: invitation._id.toString() },
      body: { action: 'decline' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.respondToInvitation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  // API: POST /api/catalogShares/:shareId/respond (CatalogShareController.respondToInvitation)
  // Input: unexpected error
  // Expected behavior: forwards to next
  test('respondToInvitation forwards unexpected errors', async () => {
    const invitee = new mongoose.Types.ObjectId();
    const invitation = {
      _id: new mongoose.Types.ObjectId(),
      invitee,
      status: 'pending',
      catalog: new mongoose.Types.ObjectId(),
    };
    const error = new Error('fail');
    catalogShareModelMock.findById.mockResolvedValueOnce(invitation);
    catalogShareModelMock.updateStatus.mockRejectedValueOnce(error);
    const req: any = {
      user: { _id: invitee },
      params: { shareId: invitation._id.toString() },
      body: { action: 'accept' },
    };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.respondToInvitation(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // API: GET /api/catalogShares/pending (CatalogShareController.listPendingInvitations)
  // Input: authenticated user
  // Expected status code: 200
  // Expected behavior: returns pending invitations for user
  test('listPendingInvitations returns pending invitations', async () => {
    const shares = [{ _id: new mongoose.Types.ObjectId() }];
    catalogShareModelMock.listPendingInvitations.mockResolvedValueOnce(shares);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.listPendingInvitations(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(getJsonPayload(res)?.data?.shares).toBe(shares);
  });

  // API: GET /api/catalogShares/pending (CatalogShareController.listPendingInvitations)
  // Input: model throws
  // Expected behavior: forwards error
  test('listPendingInvitations forwards unexpected errors', async () => {
    const error = new Error('fail');
    catalogShareModelMock.listPendingInvitations.mockRejectedValueOnce(error);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.listPendingInvitations(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  // API: GET /api/catalogShares/shared-with-me (CatalogShareController.listSharedWithMe)
  // Input: authenticated user
  // Expected status code: 200
  // Expected behavior: returns shares accepted for user
  test('listSharedWithMe returns accepted shares', async () => {
    const shares = [{ _id: new mongoose.Types.ObjectId() }];
    catalogShareModelMock.listSharedWithUser.mockResolvedValueOnce(shares);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.listSharedWithMe(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(getJsonPayload(res)?.data?.shares).toBe(shares);
  });

  // API: GET /api/catalogShares/shared-with-me (CatalogShareController.listSharedWithMe)
  // Input: model throws
  // Expected behavior: forwards error to next
  test('listSharedWithMe forwards errors', async () => {
    const error = new Error('fail');
    catalogShareModelMock.listSharedWithUser.mockRejectedValueOnce(error);
    const req: any = { user: { _id: new mongoose.Types.ObjectId() } };
    const res = createMockResponse();
    const next = jest.fn();

    await controller.listSharedWithMe(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
