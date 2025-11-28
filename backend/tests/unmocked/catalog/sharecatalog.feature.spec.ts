import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import mongoose from 'mongoose';
import { api, createCatalogRequest, dropTestDb, payloadFor } from './test.utils';
import { createUserAndToken, createUserAndTokenWithPayload } from '../auth/helpers';
import { userModel } from '../../../src/models/user/user.model';
import { catalogShareModel } from '../../../src/models/catalog/catalogShare.model';
import { catalogModel } from '../../../src/models/catalog/catalog.model';

describe('API: catalog share flow', () => {
  beforeEach(async () => {
    await dropTestDb();
  });

  afterEach(async () => {
    await dropTestDb();
    jest.restoreAllMocks();
  });

  describe('GET /api/catalogs/:catalogId/share', () => {
    test('returns 401 when unauthenticated', async () => {
      const catalogId = new mongoose.Types.ObjectId();
      const response = await api.get(`/api/catalogs/${catalogId}/share`);

      expect(response.status).toBe(401);
      expect(response.body?.message).toBe('Authentication required');
    });

    test('returns 404 when catalog not found', async () => {
      const token = await createUserAndToken(api);
      const catalogId = new mongoose.Types.ObjectId();

      const response = await api
        .get(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body?.message).toBe('Catalog not found');
    });

    test('returns 403 when user is not owner', async () => {
      const ownerToken = await createUserAndToken(api);
      const create = await createCatalogRequest(ownerToken, { name: 'My Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const otherUserToken = await createUserAndTokenWithPayload(api, payloadFor('other'));

      const response = await api
        .get(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body?.message).toBe('Only the owner can view collaborators');
    });

    test('returns list of collaborators for owner', async () => {
      const ownerToken = await createUserAndToken(api);
      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const response = await api
        .get(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body?.message).toBe('Collaborators fetched successfully');
      expect(Array.isArray(response.body?.data?.collaborators)).toBe(true);
    });

    test('handles errors when listing collaborators', async () => {
      const ownerToken = await createUserAndToken(api);
      const create = await createCatalogRequest(ownerToken, { name: 'My Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      jest.spyOn(catalogShareModel, 'listCollaborators').mockRejectedValueOnce(new Error('db error'));

      const response = await api
        .get(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    });
  });

  describe('POST /api/catalogs/:catalogId/share', () => {
    test('returns 401 when unauthenticated', async () => {
      const catalogId = new mongoose.Types.ObjectId();
      const response = await api.post(`/api/catalogs/${catalogId}/share`).send({
        inviteeId: new mongoose.Types.ObjectId().toString(),
        role: 'editor',
      });

      expect(response.status).toBe(401);
      expect(response.body?.message).toBe('Authentication required');
    });

    test('returns 404 when catalog not found', async () => {
      const token = await createUserAndToken(api);
      const catalogId = new mongoose.Types.ObjectId();
      const collabPayload = payloadFor('collab');
      const collaborator = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);

      const response = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          inviteeId: collabUser?._id.toString(),
          role: 'editor',
        });

      expect(response.status).toBe(404);
      expect(response.body?.message).toBe('Catalog not found');
    });

    test('returns 403 when user is not owner', async () => {
      const ownerToken = await createUserAndToken(api);
      const create = await createCatalogRequest(ownerToken, { name: 'My Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const otherUserToken = await createUserAndTokenWithPayload(api, payloadFor('other'));
      const collabPayload = payloadFor('collab');
      const collaborator = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);

      const response = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          inviteeId: collabUser?._id.toString(),
          role: 'editor',
        });

      expect(response.status).toBe(403);
      expect(response.body?.message).toBe('Only the owner can share this catalog');
    });

    test('returns 400 when inviting yourself', async () => {
      const ownerToken = await createUserAndToken(api);
      const owner = await userModel.findByGoogleId('test-google-id');
      const create = await createCatalogRequest(ownerToken, { name: 'My Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const response = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: owner?._id.toString(),
          role: 'editor',
        });

      expect(response.status).toBe(400);
      expect(response.body?.message).toBe('Cannot invite yourself to your own catalog');
    });

    test('returns 404 when invitee not found', async () => {
      const ownerToken = await createUserAndToken(api);
      const create = await createCatalogRequest(ownerToken, { name: 'My Catalog' });
      const catalogId = create.body?.data?.catalog?._id;
      const fakeUserId = new mongoose.Types.ObjectId();

      const response = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: fakeUserId.toString(),
          role: 'editor',
        });

      expect(response.status).toBe(404);
      expect(response.body?.message).toBe('Invitee not found');
    });

    test('returns 409 when invitation already exists', async () => {
      const ownerToken = await createUserAndToken(api);
      const collabPayload = payloadFor('collab');
      const collaboratorToken = await createUserAndTokenWithPayload(api, collabPayload);
      const collaborator = await userModel.findByGoogleId(collabPayload.sub);
      if (!collaborator) {
        throw new Error('Collaborator missing');
      }

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      // First invitation
      const firstInvite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collaborator._id.toString(),
          role: 'editor',
        });
      expect(firstInvite.status).toBe(201);

      // Try to invite again
      const secondInvite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collaborator._id.toString(),
          role: 'viewer',
        });

      expect(secondInvite.status).toBe(409);
      expect(secondInvite.body?.message).toBe('An invitation already exists for this user');
    });

    test('restores revoked invitation when re-inviting', async () => {
      const ownerToken = await createUserAndToken(api);
      const collabPayload = payloadFor('collab');
      const collaboratorToken = await createUserAndTokenWithPayload(api, collabPayload);
      const collaborator = await userModel.findByGoogleId(collabPayload.sub);
      if (!collaborator) {
        throw new Error('Collaborator missing');
      }

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      // Create and revoke invitation
      const invite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collaborator._id.toString(),
          role: 'editor',
        });
      const shareId = invite.body?.data?.invitation?._id;

      await api
        .patch(`/api/catalogs/${catalogId}/share/${shareId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ action: 'revoke' });

      // Re-invite (should restore)
      const reInvite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collaborator._id.toString(),
          role: 'viewer',
        });

      expect(reInvite.status).toBe(200);
      expect(reInvite.body?.message).toBe('Invitation re-sent successfully');
      expect(reInvite.body?.data?.invitation?.status).toBe('pending');
    });

    test('sends FCM notification when invitee has token', async () => {
      const ownerToken = await createUserAndToken(api);
      const collabPayload = payloadFor('collab');
      const collaborator = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);
      if (!collabUser) {
        throw new Error('Collaborator missing');
      }

      // Set FCM token for invitee
      await userModel.update(collabUser._id, { fcmToken: 'test-fcm-token' });

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const response = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser._id.toString(),
          role: 'editor',
        });

      expect(response.status).toBe(201);
      expect(response.body?.message).toBe('Invitation sent successfully');
    });

    test('handles FCM notification failure gracefully when inviting', async () => {
      const ownerToken = await createUserAndToken(api);
      const collabPayload = payloadFor('collab');
      const collaborator = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);
      if (!collabUser) {
        throw new Error('Collaborator missing');
      }

      // Set FCM token for invitee
      await userModel.update(collabUser._id, { fcmToken: 'test-fcm-token' });

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      // Mock messaging.send to fail
      const { messaging } = require('../../../src/config/firebase');
      const sendSpy = jest.spyOn(messaging, 'send').mockRejectedValueOnce(new Error('FCM error'));

      const response = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser._id.toString(),
          role: 'editor',
        });

      expect(response.status).toBe(201);
      expect(response.body?.message).toBe('Invitation sent successfully');
      
      sendSpy.mockRestore();
    });

    test('handles errors when inviting collaborator', async () => {
      const ownerToken = await createUserAndToken(api);
      const create = await createCatalogRequest(ownerToken, { name: 'My Catalog' });
      const catalogId = create.body?.data?.catalog?._id;
      const collabPayload = payloadFor('collab');
      const collaborator = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);

      jest
        .spyOn(catalogShareModel, 'createInvitation')
        .mockRejectedValueOnce(new Error('invitation failed'));

      const response = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser?._id.toString(),
          role: 'editor',
        });

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    });
  });

  describe('PATCH /api/catalogs/:catalogId/share/:shareId', () => {
    test('returns 401 when unauthenticated', async () => {
      const catalogId = new mongoose.Types.ObjectId();
      const shareId = new mongoose.Types.ObjectId();
      const response = await api
        .patch(`/api/catalogs/${catalogId}/share/${shareId}`)
        .send({ action: 'revoke' });

      expect(response.status).toBe(401);
      expect(response.body?.message).toBe('Authentication required');
    });

    test('returns 404 when catalog not found', async () => {
      const token = await createUserAndToken(api);
      const catalogId = new mongoose.Types.ObjectId();
      const shareId = new mongoose.Types.ObjectId();

      const response = await api
        .patch(`/api/catalogs/${catalogId}/share/${shareId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'revoke' });

      expect(response.status).toBe(404);
      expect(response.body?.message).toBe('Catalog not found');
    });

    test('returns 403 when user is not owner', async () => {
      const ownerToken = await createUserAndToken(api);
      const create = await createCatalogRequest(ownerToken, { name: 'My Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const collabPayload = payloadFor('collab');
      const collaborator = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);

      const invite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser?._id.toString(),
          role: 'editor',
        });
      const shareId = invite.body?.data?.invitation?._id;

      const response = await api
        .patch(`/api/catalogs/${catalogId}/share/${shareId}`)
        .set('Authorization', `Bearer ${collaborator}`)
        .send({ action: 'revoke' });

      expect(response.status).toBe(403);
      expect(response.body?.message).toBe('Only the owner can update collaborators');
    });

    test('returns 404 when invitation not found', async () => {
      const ownerToken = await createUserAndToken(api);
      const create = await createCatalogRequest(ownerToken, { name: 'My Catalog' });
      const catalogId = create.body?.data?.catalog?._id;
      const fakeShareId = new mongoose.Types.ObjectId();

      const response = await api
        .patch(`/api/catalogs/${catalogId}/share/${fakeShareId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ action: 'revoke' });

      expect(response.status).toBe(404);
      expect(response.body?.message).toBe('Invitation not found');
    });

    test('updates collaborator role', async () => {
      const ownerToken = await createUserAndToken(api);
      const collabPayload = payloadFor('collab');
      const collaborator = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);
      if (!collabUser) {
        throw new Error('Collaborator missing');
      }

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const invite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser._id.toString(),
          role: 'editor',
        });
      const shareId = invite.body?.data?.invitation?._id;

      const response = await api
        .patch(`/api/catalogs/${catalogId}/share/${shareId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'viewer' });

      expect(response.status).toBe(200);
      expect(response.body?.message).toBe('Collaborator updated successfully');
      expect(response.body?.data?.invitation?.role).toBe('viewer');
    });

    test('returns 500 when update fails', async () => {
      const ownerToken = await createUserAndToken(api);
      const collabPayload = payloadFor('collab');
      const collaborator = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);
      if (!collabUser) {
        throw new Error('Collaborator missing');
      }

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const invite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser._id.toString(),
          role: 'editor',
        });
      const shareId = invite.body?.data?.invitation?._id;

      jest.spyOn(catalogShareModel, 'updateRole').mockResolvedValueOnce(null);

      const response = await api
        .patch(`/api/catalogs/${catalogId}/share/${shareId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: 'viewer' });

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Failed to update collaborator');
    });

    test('handles errors when updating collaborator', async () => {
      const ownerToken = await createUserAndToken(api);
      const create = await createCatalogRequest(ownerToken, { name: 'My Catalog' });
      const catalogId = create.body?.data?.catalog?._id;
      const shareId = new mongoose.Types.ObjectId();

      jest.spyOn(catalogShareModel, 'findById').mockRejectedValueOnce(new Error('db error'));

      const response = await api
        .patch(`/api/catalogs/${catalogId}/share/${shareId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ action: 'revoke' });

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    });
  });

  describe('PATCH /api/catalogs/share/:shareId/respond', () => {
    test('returns 401 when unauthenticated', async () => {
      const shareId = new mongoose.Types.ObjectId();
      const response = await api
        .patch(`/api/catalogs/share/${shareId}/respond`)
        .send({ action: 'accept' });

      expect(response.status).toBe(401);
      expect(response.body?.message).toBe('Authentication required');
    });

    test('returns 404 when invitation not found', async () => {
      const token = await createUserAndToken(api);
      const fakeShareId = new mongoose.Types.ObjectId();

      const response = await api
        .patch(`/api/catalogs/share/${fakeShareId}/respond`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'accept' });

      expect(response.status).toBe(404);
      expect(response.body?.message).toBe('Invitation not found');
    });

    test('returns 403 when user is not invitee', async () => {
      const ownerToken = await createUserAndToken(api);
      const collabPayload = payloadFor('collab');
      const collaborator = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);
      if (!collabUser) {
        throw new Error('Collaborator missing');
      }

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const invite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser._id.toString(),
          role: 'editor',
        });
      const shareId = invite.body?.data?.invitation?._id;

      const otherUserToken = await createUserAndTokenWithPayload(api, payloadFor('other'));

      const response = await api
        .patch(`/api/catalogs/share/${shareId}/respond`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ action: 'accept' });

      expect(response.status).toBe(403);
      expect(response.body?.message).toBe('You are not authorized to respond to this invitation');
    });

    test('returns 400 when invitation is not pending', async () => {
      const ownerToken = await createUserAndToken(api);
      const collabPayload = payloadFor('collab');
      const collaboratorToken = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);
      if (!collabUser) {
        throw new Error('Collaborator missing');
      }

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const invite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser._id.toString(),
          role: 'editor',
        });
      const shareId = invite.body?.data?.invitation?._id;

      // Accept first
      await api
        .patch(`/api/catalogs/share/${shareId}/respond`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ action: 'accept' });

      // Try to accept again
      const response = await api
        .patch(`/api/catalogs/share/${shareId}/respond`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ action: 'accept' });

      expect(response.status).toBe(400);
      expect(response.body?.message).toBe('Invitation is no longer pending');
    });

    test('accepts invitation successfully', async () => {
      const ownerToken = await createUserAndToken(api);
      const collabPayload = payloadFor('collab');
      const collaboratorToken = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);
      if (!collabUser) {
        throw new Error('Collaborator missing');
      }

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const invite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser._id.toString(),
          role: 'editor',
        });
      const shareId = invite.body?.data?.invitation?._id;

      const response = await api
        .patch(`/api/catalogs/share/${shareId}/respond`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ action: 'accept' });

      expect(response.status).toBe(200);
      expect(response.body?.message).toBe('Invitation accepted successfully');
      expect(response.body?.data?.invitation?.status).toBe('accepted');
    });

    test('declines invitation successfully', async () => {
      const ownerToken = await createUserAndToken(api);
      const collabPayload = payloadFor('collab');
      const collaboratorToken = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);
      if (!collabUser) {
        throw new Error('Collaborator missing');
      }

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const invite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser._id.toString(),
          role: 'editor',
        });
      const shareId = invite.body?.data?.invitation?._id;

      const response = await api
        .patch(`/api/catalogs/share/${shareId}/respond`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ action: 'decline' });

      expect(response.status).toBe(200);
      expect(response.body?.message).toMatch(/Invitation decline/i);
      expect(response.body?.data?.invitation?.status).toBe('declined');
    });

    test('returns 500 when update fails', async () => {
      const ownerToken = await createUserAndToken(api);
      const collabPayload = payloadFor('collab');
      const collaboratorToken = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);
      if (!collabUser) {
        throw new Error('Collaborator missing');
      }

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const invite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser._id.toString(),
          role: 'editor',
        });
      const shareId = invite.body?.data?.invitation?._id;

      jest.spyOn(catalogShareModel, 'updateStatus').mockResolvedValueOnce(null);

      const response = await api
        .patch(`/api/catalogs/share/${shareId}/respond`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ action: 'accept' });

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Failed to update invitation');
    });

    test('sends FCM notification to owner when invitation is accepted', async () => {
      const ownerToken = await createUserAndToken(api);
      const owner = await userModel.findByGoogleId('test-google-id');
      if (owner) {
        await userModel.update(owner._id, { fcmToken: 'owner-fcm-token' });
      }

      const collabPayload = payloadFor('collab');
      const collaboratorToken = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);
      if (!collabUser) {
        throw new Error('Collaborator missing');
      }

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const invite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser._id.toString(),
          role: 'editor',
        });
      const shareId = invite.body?.data?.invitation?._id;

      const response = await api
        .patch(`/api/catalogs/share/${shareId}/respond`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ action: 'accept' });

      expect(response.status).toBe(200);
    });

    test('handles FCM notification failure when responding to invitation', async () => {
      const ownerToken = await createUserAndToken(api);
      const owner = await userModel.findByGoogleId('test-google-id');
      if (owner) {
        await userModel.update(owner._id, { fcmToken: 'owner-fcm-token' });
      }

      const collabPayload = payloadFor('collab');
      const collaboratorToken = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);
      if (!collabUser) {
        throw new Error('Collaborator missing');
      }

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const invite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser._id.toString(),
          role: 'editor',
        });
      const shareId = invite.body?.data?.invitation?._id;

      // Mock messaging.send to fail
      const { messaging } = require('../../../src/config/firebase');
      const sendSpy = jest.spyOn(messaging, 'send').mockRejectedValueOnce(new Error('FCM error'));

      const response = await api
        .patch(`/api/catalogs/share/${shareId}/respond`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ action: 'accept' });

      expect(response.status).toBe(200);
      expect(response.body?.message).toBe('Invitation accepted successfully');
      
      sendSpy.mockRestore();
    });

    test('handles errors when responding to invitation', async () => {
      const token = await createUserAndToken(api);
      const shareId = new mongoose.Types.ObjectId();

      jest.spyOn(catalogShareModel, 'findById').mockRejectedValueOnce(new Error('db error'));

      const response = await api
        .patch(`/api/catalogs/share/${shareId}/respond`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'accept' });

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    });
  });

  describe('GET /api/catalogs/share/pending', () => {
    test('returns 401 when unauthenticated', async () => {
      const response = await api.get('/api/catalogs/share/pending');

      expect(response.status).toBe(401);
      expect(response.body?.message).toBe('Authentication required');
    });

    test('returns list of pending invitations', async () => {
      const ownerToken = await createUserAndToken(api);
      const collabPayload = payloadFor('collab');
      const collaboratorToken = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);
      if (!collabUser) {
        throw new Error('Collaborator missing');
      }

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser._id.toString(),
          role: 'editor',
        });

      const response = await api
        .get('/api/catalogs/share/pending')
        .set('Authorization', `Bearer ${collaboratorToken}`);

      expect(response.status).toBe(200);
      expect(response.body?.message).toBe('Pending catalog invitations fetched successfully');
      expect(Array.isArray(response.body?.data?.shares)).toBe(true);
    });

    test('handles errors when fetching pending invitations', async () => {
      const token = await createUserAndToken(api);

      jest
        .spyOn(catalogShareModel, 'listPendingInvitations')
        .mockRejectedValueOnce(new Error('db error'));

      const response = await api
        .get('/api/catalogs/share/pending')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    });
  });

  describe('GET /api/catalogs/shared-with/me', () => {
    test('returns 401 when unauthenticated', async () => {
      const response = await api.get('/api/catalogs/shared-with/me');

      expect(response.status).toBe(401);
      expect(response.body?.message).toBe('Authentication required');
    });

    test('returns list of shared catalogs', async () => {
      const ownerToken = await createUserAndToken(api);
      const collabPayload = payloadFor('collab');
      const collaboratorToken = await createUserAndTokenWithPayload(api, collabPayload);
      const collabUser = await userModel.findByGoogleId(collabPayload.sub);
      if (!collabUser) {
        throw new Error('Collaborator missing');
      }

      const create = await createCatalogRequest(ownerToken, { name: 'Shared Catalog' });
      const catalogId = create.body?.data?.catalog?._id;

      const invite = await api
        .post(`/api/catalogs/${catalogId}/share`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          inviteeId: collabUser._id.toString(),
          role: 'editor',
        });
      const shareId = invite.body?.data?.invitation?._id;

      await api
        .post(`/api/catalogs/share/${shareId}/respond`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ action: 'accept' });

      const response = await api
        .get('/api/catalogs/shared-with/me')
        .set('Authorization', `Bearer ${collaboratorToken}`);

      expect(response.status).toBe(200);
      expect(response.body?.message).toBe('Shared catalogs fetched successfully');
      expect(Array.isArray(response.body?.data?.shares)).toBe(true);
    });

    test('handles errors when fetching shared catalogs', async () => {
      const token = await createUserAndToken(api);

      jest.spyOn(catalogShareModel, 'listSharedWithUser').mockRejectedValueOnce(new Error('db error'));

      const response = await api
        .get('/api/catalogs/shared-with/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body?.message).toBe('Internal server error');
    });
  });
});
