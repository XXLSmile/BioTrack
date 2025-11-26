import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  CatalogShareRole,
  InviteCollaboratorRequest,
  inviteCollaboratorSchema,
  RespondToInvitationRequest,
  respondToInvitationSchema,
  UpdateCollaboratorRequest,
  updateCollaboratorSchema,
} from '../types/catalogShare.types';
import { catalogModel } from '../models/catalog/catalog.model';
import { catalogShareModel } from '../models/catalog/catalogShare.model';
import { userModel } from '../models/user/user.model';
import logger from '../utils/logger.util';
import { messaging } from '../config/firebase';

export class CatalogShareController {
  async listCollaborators(
    req: Request<{ catalogId: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const { catalogId } = req.params;

      const catalog = await catalogModel.findById(catalogId);
      if (!catalog) {
        return res.status(404).json({ message: 'Catalog not found' });
      }

      if (!catalog.owner.equals(user._id)) {
        return res.status(403).json({ message: 'Only the owner can view collaborators' });
      }

      const collaborators = await catalogShareModel.listCollaborators(catalog._id);

      res.status(200).json({
        message: 'Collaborators fetched successfully',
        data: { collaborators },
      });
    } catch (error) {
      logger.error('Failed to list collaborators:', error);
      next(error);
    }
  }

  async inviteCollaborator(
    req: Request<{ catalogId: string }, unknown, InviteCollaboratorRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const { catalogId } = req.params;
      const invitePayload = inviteCollaboratorSchema.parse(req.body) as InviteCollaboratorRequest;
      const inviteeId: string = invitePayload.inviteeId;
      const role: CatalogShareRole = invitePayload.role;

      const catalog = await catalogModel.findById(catalogId);
      if (!catalog) {
        return res.status(404).json({ message: 'Catalog not found' });
      }

      if (!catalog.owner.equals(user._id)) {
        return res.status(403).json({ message: 'Only the owner can share this catalog' });
      }

      const inviteeObjectId = new mongoose.Types.ObjectId(inviteeId);
      if (inviteeObjectId.equals(user._id)) {
        return res.status(400).json({ message: 'Cannot invite yourself to your own catalog' });
      }

      const invitee = await userModel.findById(inviteeObjectId);
      if (!invitee) {
        return res.status(404).json({ message: 'Invitee not found' });
      }

      const existing = await catalogShareModel.findByCatalogAndInvitee(catalog._id, inviteeObjectId);
      if (existing) {
        if (existing.status === 'revoked') {
          // Restore a revoked invitation
          existing.status = 'pending';
          existing.role = role;
          await existing.save();
          return res.status(200).json({
            message: 'Invitation re-sent successfully',
            data: { invitation: existing },
          });
        }

        return res.status(409).json({
          message: 'An invitation already exists for this user',
          data: { invitation: existing },
        });
      }

      const invitation = await catalogShareModel.createInvitation(
        catalog._id,
        catalog.owner,
        inviteeObjectId,
        user._id,
        role
      );

      // Send FCM notification to invitee if they have an FCM token
      if (invitee.fcmToken) {
        try {
          await messaging.send({
          token: invitee.fcmToken,
          notification: {
            title: "Catalog Invitation 📘",
            body: `${user.name || user.username} invited you to collaborate on "${catalog.name}"`,
          },
          data: {
            type: "CATALOG_INVITE_RECEIVED",
            catalogId: catalog._id.toString(),
            inviterId: user._id.toString(),
          },
          });
          logger.info(`Sent catalog invitation notification to ${invitee.username}`);
        } catch (err) {
          logger.warn(`Failed to send catalog invitation notification to ${invitee.username}:`, err);
        }
      }

      res.status(201).json({
        message: 'Invitation sent successfully',
        data: { invitation },
      });
    } catch (error) {
      logger.error('Failed to invite collaborator:', error);
      next(error);
    }
  }

  async updateCollaborator(
    req: Request<{ catalogId: string; shareId: string }, unknown, UpdateCollaboratorRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const { catalogId, shareId } = req.params;
      const updatePayload = updateCollaboratorSchema.parse(req.body) as UpdateCollaboratorRequest;

      const catalog = await catalogModel.findById(catalogId);
      if (!catalog) {
        return res.status(404).json({ message: 'Catalog not found' });
      }

      if (!catalog.owner.equals(user._id)) {
        return res.status(403).json({ message: 'Only the owner can update collaborators' });
      }

      const shareObjectId = new mongoose.Types.ObjectId(shareId);
      const share = await catalogShareModel.findById(shareObjectId);
      if (!share?.catalog.equals(catalog._id)) {
        return res.status(404).json({ message: 'Invitation not found' });
      }

      let updatedShare: typeof share | null = share;

      if (updatePayload.action === 'revoke') {
        updatedShare = await catalogShareModel.revokeInvitation(shareObjectId);
      } else if (updatePayload.role) {
        const nextRole: CatalogShareRole = updatePayload.role;
        updatedShare = await catalogShareModel.updateRole(shareObjectId, nextRole);
      }

      if (!updatedShare) {
        return res.status(500).json({ message: 'Failed to update collaborator' });
      }

      res.status(200).json({
        message: 'Collaborator updated successfully',
        data: { invitation: updatedShare },
      });
    } catch (error) {
      logger.error('Failed to update collaborator:', error);
      next(error);
    }
  }

  async respondToInvitation(
    req: Request<{ shareId: string }, unknown, RespondToInvitationRequest>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const { shareId } = req.params;
      const { action } = respondToInvitationSchema.parse(req.body);

      const shareObjectId = new mongoose.Types.ObjectId(shareId);
      const invitation = await catalogShareModel.findById(shareObjectId);

      if (!invitation) {
        return res.status(404).json({ message: 'Invitation not found' });
      }

      if (!invitation.invitee.equals(user._id)) {
        return res.status(403).json({ message: 'You are not authorized to respond to this invitation' });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: 'Invitation is no longer pending' });
      }

      const newStatus = action === 'accept' ? 'accepted' : 'declined';
      const updated = await catalogShareModel.updateStatus(shareObjectId, newStatus);

      if (!updated) {
        return res.status(500).json({ message: 'Failed to update invitation' });
      }

      try {
        const catalog = await catalogModel.findById(invitation.catalog.toString());
        if (catalog) {
          const owner = await userModel.findById(catalog.owner);
          if (owner?.fcmToken) {
            const title =
              newStatus === 'accepted'
                ? 'Invitation Accepted ✅'
                : 'Invitation Declined 🚫';

            const body =
              newStatus === 'accepted'
                ? `${user.name || user.username} accepted your invitation to "${catalog.name}"`
                : `${user.name || user.username} declined your invitation to "${catalog.name}"`;

            await messaging.send({
              token: owner.fcmToken,
              notification: { title, body },
              data: {
                type:
                  newStatus === 'accepted'
                    ? 'CATALOG_INVITE_ACCEPTED'
                    : 'CATALOG_INVITE_DECLINED',
                catalogId: catalog._id.toString(),
                inviteeId: user._id.toString(),
              },
            });

            logger.info(`Sent catalog ${newStatus} notification to ${owner.username}`);
          }
        }
      } catch (err) {
        logger.warn('Failed to send catalog invitation response notification:', err);
      }

      res.status(200).json({
        message: `Invitation ${action}ed successfully`,
        data: { invitation: updated },
      });
    } catch (error) {
      logger.error('Failed to respond to invitation:', error);
      next(error);
    }
  }


  async listPendingInvitations(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const invitations = await catalogShareModel.listPendingInvitations(user._id);

      res.status(200).json({
        message: 'Pending catalog invitations fetched successfully',
        data: { shares: invitations },
      });
    } catch (error) {
      logger.error('Failed to fetch pending catalog invitations:', error);
      next(error);
    }
  }

  async listSharedWithMe(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const shares = await catalogShareModel.listSharedWithUser(user._id);

      res.status(200).json({
        message: 'Shared catalogs fetched successfully',
        data: { shares },
      });
    } catch (error) {
      logger.error('Failed to fetch shared catalogs:', error);
      next(error);
    }
  }
}

export const catalogShareController = new CatalogShareController();
