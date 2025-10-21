import mongoose, { Schema } from 'mongoose';
import logger from '../logger.util';
import { FriendshipStatus, IFriendship } from './friend.types';

const friendshipSchema = new Schema<IFriendship>(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    addressee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'blocked'],
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

friendshipSchema.index(
  { requester: 1, addressee: 1 },
  { unique: true }
);

export class FriendshipModel {
  private friendship: mongoose.Model<IFriendship>;

  constructor() {
    this.friendship = mongoose.model<IFriendship>('Friendship', friendshipSchema);
  }

  async createRequest(
    requesterId: mongoose.Types.ObjectId,
    addresseeId: mongoose.Types.ObjectId
  ): Promise<IFriendship> {
    try {
      const request = await this.friendship.create({
        requester: requesterId,
        addressee: addresseeId,
        status: 'pending',
      });

      return request;
    } catch (error) {
      logger.error('Failed to create friend request:', error);
      throw new Error('Failed to create friend request');
    }
  }

  async findRequestBetween(
    userA: mongoose.Types.ObjectId,
    userB: mongoose.Types.ObjectId
  ): Promise<IFriendship | null> {
    return this.friendship.findOne({
      $or: [
        { requester: userA, addressee: userB },
        { requester: userB, addressee: userA },
      ],
    });
  }

  async getPendingForUser(
    userId: mongoose.Types.ObjectId
  ): Promise<IFriendship[]> {
    return this.friendship
      .find({ addressee: userId, status: 'pending' })
      .populate('requester', 'name username profilePicture');
  }

  async getOutgoingForUser(
    userId: mongoose.Types.ObjectId
  ): Promise<IFriendship[]> {
    return this.friendship
      .find({ requester: userId, status: 'pending' })
      .populate('addressee', 'name username profilePicture');
  }

  async getFriendsForUser(
    userId: mongoose.Types.ObjectId
  ): Promise<IFriendship[]> {
    return this.friendship
      .find({
        status: 'accepted',
        $or: [{ requester: userId }, { addressee: userId }],
      })
      .populate('requester', 'name username profilePicture')
      .populate('addressee', 'name username profilePicture');
  }

  async findById(id: mongoose.Types.ObjectId): Promise<IFriendship | null> {
    return this.friendship.findById(id);
  }

  async updateRequestStatus(
    requestId: mongoose.Types.ObjectId,
    status: FriendshipStatus
  ): Promise<IFriendship | null> {
    try {
      const updated = await this.friendship.findByIdAndUpdate(
        requestId,
        { status, respondedAt: new Date() },
        { new: true }
      );
      return updated;
    } catch (error) {
      logger.error('Failed to update friend request:', error);
      throw new Error('Failed to update friend request');
    }
  }

  async deleteFriendship(friendshipId: mongoose.Types.ObjectId): Promise<void> {
    try {
      await this.friendship.findByIdAndDelete(friendshipId);
    } catch (error) {
      logger.error('Failed to delete friendship:', error);
      throw new Error('Failed to delete friendship');
    }
  }
}

export const friendshipModel = new FriendshipModel();
