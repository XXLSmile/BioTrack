import mongoose, { Schema } from 'mongoose';
import logger from '../../utils/logger.util';
import {
  CatalogShareRole,
  CatalogShareStatus,
  ICatalogShare,
} from '../../types/catalogShare.types';

const catalogShareSchema = new Schema<ICatalogShare>(
  {
    catalog: {
      type: Schema.Types.ObjectId,
      ref: 'Catalog',
      required: true,
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    invitee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['viewer', 'editor'],
      default: 'viewer',
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'revoked'],
      default: 'pending',
      index: true,
    },
    respondedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

catalogShareSchema.index(
  { catalog: 1, invitee: 1 },
  { unique: true }
);

export class CatalogShareModel {
  private share: mongoose.Model<ICatalogShare>;

  constructor() {
    this.share =
      (mongoose.models.CatalogShare as mongoose.Model<ICatalogShare> | undefined) ??
      mongoose.model<ICatalogShare>('CatalogShare', catalogShareSchema);
  }

  async createInvitation(
    catalogId: mongoose.Types.ObjectId,
    ownerId: mongoose.Types.ObjectId,
    inviteeId: mongoose.Types.ObjectId,
    invitedById: mongoose.Types.ObjectId,
    role: CatalogShareRole
  ): Promise<ICatalogShare> {
    try {
      return await this.share.create({
        catalog: catalogId,
        owner: ownerId,
        invitee: inviteeId,
        invitedBy: invitedById,
        role,
        status: 'pending',
      });
    } catch (error) {
      logger.error('Failed to create catalog invitation:', error);
      throw new Error('Failed to create catalog invitation');
    }
  }

  async findByCatalogAndInvitee(
    catalogId: mongoose.Types.ObjectId,
    inviteeId: mongoose.Types.ObjectId
  ): Promise<ICatalogShare | null> {
    return this.share.findOne({
      catalog: catalogId,
      invitee: inviteeId,
    });
  }

  async findById(shareId: mongoose.Types.ObjectId): Promise<ICatalogShare | null> {
    return this.share.findById(shareId);
  }

  async listCollaborators(catalogId: mongoose.Types.ObjectId): Promise<ICatalogShare[]> {
    return this.share
      .find({ catalog: catalogId, status: { $ne: 'revoked' } })
      .populate('invitee', 'name username profilePicture')
      .populate('invitedBy', 'name username profilePicture');
  }


  async listPendingInvitations(
    inviteeId: mongoose.Types.ObjectId
  ): Promise<ICatalogShare[]> {
    return this.share
      .find({ invitee: inviteeId, status: 'pending' })
      .populate('catalog')
      .populate('invitedBy', 'name username profilePicture');
  }

  async listSharedWithUser(userId: mongoose.Types.ObjectId): Promise<ICatalogShare[]> {
    return this.share
      .find({ invitee: userId, status: 'accepted' })
      .populate('catalog');
  }

  async updateStatus(
    shareId: mongoose.Types.ObjectId,
    status: CatalogShareStatus
  ): Promise<ICatalogShare | null> {
    try {
      return this.share.findByIdAndUpdate(
        shareId,
        {
          status,
          respondedAt: new Date(),
        },
        { new: true }
      );
    } catch (error) {
      logger.error('Failed to update catalog share status:', error);
      throw new Error('Failed to update catalog share');
    }
  }

  async updateRole(
    shareId: mongoose.Types.ObjectId,
    role: CatalogShareRole
  ): Promise<ICatalogShare | null> {
    try {
      return this.share.findByIdAndUpdate(
        shareId,
        {
          role,
        },
        { new: true }
      );
    } catch (error) {
      logger.error('Failed to update collaborator role:', error);
      throw new Error('Failed to update collaborator role');
    }
  }

  async revokeInvitation(shareId: mongoose.Types.ObjectId): Promise<ICatalogShare | null> {
    try {
      return this.share.findByIdAndUpdate(
        shareId,
        {
          status: 'revoked',
          respondedAt: new Date(),
        },
        { new: true }
      );
    } catch (error) {
      logger.error('Failed to revoke catalog invitation:', error);
      throw new Error('Failed to revoke catalog invitation');
    }
  }

  async getUserAccess(
    catalogId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<ICatalogShare | null> {
    return this.share.findOne({
      catalog: catalogId,
      invitee: userId,
      status: 'accepted',
    });
  }
}

export const catalogShareModel = new CatalogShareModel();
