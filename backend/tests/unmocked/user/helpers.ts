import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import { userModel } from '../../../src/models/user/user.model';
import type { IUser } from '../../../src/types/user.types';

interface CustomUserOptions {
  username?: string;
  name?: string;
  isPublicProfile?: boolean;
}

export const createCustomUser = async (options: CustomUserOptions = {}): Promise<IUser> => {
  const baseEmail = `custom-user-${Date.now()}@example.com`;
  const googleInfo = {
    googleId: new mongoose.Types.ObjectId().toHexString(),
    email: baseEmail,
    name: options.name ?? 'Custom User',
    profilePicture: undefined,
  };

  const created = await userModel.create(googleInfo as never);
  const updates: Partial<IUser> = {};

  if (options.username) {
    updates.username = options.username;
  }

  if (typeof options.isPublicProfile === 'boolean') {
    updates.isPublicProfile = options.isPublicProfile;
  }

  if (Object.keys(updates).length > 0) {
    await userModel.update(created._id, updates);
  }

  const refreshed = await userModel.findById(created._id);
  if (!refreshed) {
    throw new Error('Failed to refresh custom user');
  }
  return refreshed;
};

export const signTokenForUser = (user: IUser): string => {
  const secret = process.env.JWT_SECRET ?? 'test-jwt-secret';
  return jwt.sign({ id: user._id }, secret, {
    expiresIn: '19h',
  });
};
