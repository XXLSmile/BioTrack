import mongoose, { Document } from 'mongoose';
import z from 'zod';

// User model
// ------------------------------------------------------------
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  googleId: string;
  email: string;
  name: string;
  username: string;              // Unique username (required, no spaces)
  profilePicture?: string;
  // BioTrack specific fields
  observationCount: number;
  speciesDiscovered: number;
  favoriteSpecies?: string[];
  location?: string;
  region?: string;
  isPublicProfile: boolean;
  badges: string[];
  friendCount: number;
  createdAt: Date;
  updatedAt: Date;
  fcmToken?: string | null;       // Firebase Cloud Messaging token for push notifications
}

// Zod schemas
// ------------------------------------------------------------
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-z0-9_]+$/, 'Username must be lowercase letters, numbers, and underscores only'),
  googleId: z.string().min(1),
  profilePicture: z.string().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  username: z.string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/, 'Username must be lowercase letters, numbers, and underscores only')
    .optional(),
  // BioTrack specific fields
  location: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  isPublicProfile: z.boolean().optional(),
  favoriteSpecies: z.array(z.string()).optional(),
  fcmToken: z.string().nullable().optional(),
});

// Request types
// ------------------------------------------------------------
export type GetProfileResponse = {
  message: string;
  data?: {
    user: IUser;
  };
};

export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;

// Generic types
// ------------------------------------------------------------
export type GoogleUserInfo = {
  googleId: string;
  email: string;
  name: string;
  profilePicture?: string;
};
