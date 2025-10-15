import mongoose, { Document } from 'mongoose';
import z from 'zod';
import { HOBBIES } from '../hobbies/hobbies';

// User model
// ------------------------------------------------------------
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  googleId: string;
  email: string;
  name: string;
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
}

// Zod schemas
// ------------------------------------------------------------
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  googleId: z.string().min(1),
  profilePicture: z.string().optional(),

});

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  // BioTrack specific fields
  location: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  isPublicProfile: z.boolean().optional(),
  favoriteSpecies: z.array(z.string()).optional(),
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
