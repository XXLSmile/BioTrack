import mongoose, { Schema } from 'mongoose';
import { z } from 'zod';

import { HOBBIES } from '../hobbies/hobbies';
import {
  createUserSchema,
  GoogleUserInfo,
  IUser,
  updateProfileSchema,
} from './user.types';
import logger from '../logger.util';

const userSchema = new Schema<IUser>(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    profilePicture: {
      type: String,
      required: false,
      trim: true,
    },
    // BioTrack specific fields
    observationCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    speciesDiscovered: {
      type: Number,
      default: 0,
      min: 0,
    },
    favoriteSpecies: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    region: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    isPublicProfile: {
      type: Boolean,
      default: true,
    },
    badges: {
      type: [String],
      default: [],
    },
    friendCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export class UserModel {
  private user: mongoose.Model<IUser>;

  constructor() {
    this.user = mongoose.model<IUser>('User', userSchema);
  }

  async create(userInfo: GoogleUserInfo): Promise<IUser> {
    try {
      const validatedData = createUserSchema.parse(userInfo);

      return await this.user.create(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Validation error:', error.issues);
        throw new Error('Invalid update data');
      }
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  async update(
    userId: mongoose.Types.ObjectId,
    user: Partial<IUser>
  ): Promise<IUser | null> {
    try {
      const validatedData = updateProfileSchema.parse(user);

      const updatedUser = await this.user.findByIdAndUpdate(
        userId,
        validatedData,
        {
          new: true,
        }
      );
      return updatedUser;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  async delete(userId: mongoose.Types.ObjectId): Promise<void> {
    try {
      await this.user.findByIdAndDelete(userId);
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  async findById(_id: mongoose.Types.ObjectId): Promise<IUser | null> {
    try {
      const user = await this.user.findOne({ _id });

      if (!user) {
        return null;
      }

      return user;
    } catch (error) {
      console.error('Error finding user by Google ID:', error);
      throw new Error('Failed to find user');
    }
  }

  async findByGoogleId(googleId: string): Promise<IUser | null> {
    try {
      const user = await this.user.findOne({ googleId });

      if (!user) {
        return null;
      }

      return user;
    } catch (error) {
      console.error('Error finding user by Google ID:', error);
      throw new Error('Failed to find user');
    }
  }

  // BioTrack specific methods
  async incrementObservationCount(userId: mongoose.Types.ObjectId): Promise<void> {
    try {
      await this.user.findByIdAndUpdate(userId, {
        $inc: { observationCount: 1 },
      });
    } catch (error) {
      logger.error('Error incrementing observation count:', error);
      throw new Error('Failed to update observation count');
    }
  }

  async incrementSpeciesDiscovered(userId: mongoose.Types.ObjectId): Promise<void> {
    try {
      await this.user.findByIdAndUpdate(userId, {
        $inc: { speciesDiscovered: 1 },
      });
    } catch (error) {
      logger.error('Error incrementing species discovered:', error);
      throw new Error('Failed to update species discovered');
    }
  }

  async addFavoriteSpecies(userId: mongoose.Types.ObjectId, speciesName: string): Promise<void> {
    try {
      await this.user.findByIdAndUpdate(userId, {
        $addToSet: { favoriteSpecies: speciesName },
      });
    } catch (error) {
      logger.error('Error adding favorite species:', error);
      throw new Error('Failed to add favorite species');
    }
  }

  async removeFavoriteSpecies(userId: mongoose.Types.ObjectId, speciesName: string): Promise<void> {
    try {
      await this.user.findByIdAndUpdate(userId, {
        $pull: { favoriteSpecies: speciesName },
      });
    } catch (error) {
      logger.error('Error removing favorite species:', error);
      throw new Error('Failed to remove favorite species');
    }
  }

  async addBadge(userId: mongoose.Types.ObjectId, badgeName: string): Promise<void> {
    try {
      await this.user.findByIdAndUpdate(userId, {
        $addToSet: { badges: badgeName },
      });
    } catch (error) {
      logger.error('Error adding badge:', error);
      throw new Error('Failed to add badge');
    }
  }

  async incrementFriendCount(userId: mongoose.Types.ObjectId): Promise<void> {
    try {
      await this.user.findByIdAndUpdate(userId, {
        $inc: { friendCount: 1 },
      });
    } catch (error) {
      logger.error('Error incrementing friend count:', error);
      throw new Error('Failed to update friend count');
    }
  }

  async decrementFriendCount(userId: mongoose.Types.ObjectId): Promise<void> {
    try {
      await this.user.findByIdAndUpdate(userId, {
        $inc: { friendCount: -1 },
      });
    } catch (error) {
      logger.error('Error decrementing friend count:', error);
      throw new Error('Failed to update friend count');
    }
  }

  async getUserStats(userId: mongoose.Types.ObjectId): Promise<{
    observationCount: number;
    speciesDiscovered: number;
    friendCount: number;
    badges: string[];
  } | null> {
    try {
      const user = await this.user.findById(userId).select('observationCount speciesDiscovered friendCount badges');
      if (!user) {
        return null;
      }
      return {
        observationCount: user.observationCount,
        speciesDiscovered: user.speciesDiscovered,
        friendCount: user.friendCount,
        badges: user.badges,
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw new Error('Failed to get user stats');
    }
  }
}

export const userModel = new UserModel();
