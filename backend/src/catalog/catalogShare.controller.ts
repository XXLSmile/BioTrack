import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  InviteCollaboratorRequest,
  inviteCollaboratorSchema,
  RespondToInvitationRequest,
  respondToInvitationSchema,
  UpdateCollaboratorRequest,
  updateCollaboratorSchema,
} from './catalogShare.types';
import { catalogModel } from './catalog.model';
import { catalogShareModel } from './catalogShare.model';
import { userModel } from '../user/user.model';
import logger from '../logger.util';

export class CatalogShareController {
  async listCollaborators(
    req: Request<{ catalogId: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
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
      const user = req.user!;
      const { catalogId } = req.params;
      const { inviteeId, role } = inviteCollaboratorSchema.parse(req.body);

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
      const user = req.user!;
      const { catalogId, shareId } = req.params;
      const body = updateCollaboratorSchema.parse(req.body);

      const catalog = await catalogModel.findById(catalogId);
      if (!catalog) {
        return res.status(404).json({ message: 'Catalog not found' });
      }

      if (!catalog.owner.equals(user._id)) {
        return res.status(403).json({ message: 'Only the owner can update collaborators' });
      }

      const shareObjectId = new mongoose.Types.ObjectId(shareId);
      const share = await catalogShareModel.findById(shareObjectId);
      if (!share || !share.catalog.equals(catalog._id)) {
        return res.status(404).json({ message: 'Invitation not found' });
      }

      let updatedShare: typeof share | null = share;

      if (body.action === 'revoke') {
        updatedShare = await catalogShareModel.revokeInvitation(shareObjectId);
      } else if (body.role) {
        updatedShare = await catalogShareModel.updateRole(shareObjectId, body.role);
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
      const user = req.user!;
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

      res.status(200).json({
        message: `Invitation ${action}ed successfully`,
        data: { invitation: updated },
      });
    } catch (error) {
      logger.error('Failed to respond to invitation:', error);
      next(error);
    }
  }

  async listSharedWithMe(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
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
