import mongoose from 'mongoose';
import { z } from 'zod';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface IFriendship extends mongoose.Document {
  requester: mongoose.Types.ObjectId;
  addressee: mongoose.Types.ObjectId;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
  respondedAt?: Date;
}

export const createFriendRequestSchema = z.object({
  targetUserId: z.string().min(1, 'Target user ID is required'),
});

export type CreateFriendRequest = z.infer<typeof createFriendRequestSchema>;

export const respondFriendRequestSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

export type RespondFriendRequest = z.infer<typeof respondFriendRequestSchema>;

export interface FriendRecommendation {
  user: {
    _id: mongoose.Types.ObjectId;
    name?: string | null;
    username?: string | null;
    profilePicture?: string | null;
    location?: string | null;
    region?: string | null;
    favoriteSpecies?: string[];
  };
  mutualFriends: Array<{
    _id: mongoose.Types.ObjectId;
    name?: string | null;
    username?: string | null;
  }>;
  sharedSpecies: string[];
  locationMatch: boolean;
  distanceKm?: number;
  score: number;
}
