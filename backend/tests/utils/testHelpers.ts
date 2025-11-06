import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import { userModel } from '../../src/user/user.model';
import type { IUser } from '../../src/user/user.types';

let userCounter = 0;

export const createTestUser = async (
  overrides: Partial<IUser> = {}
): Promise<IUser> => {
  userCounter += 1;
  const suffix = userCounter;

  const defaultData = {
    googleId: `google-${suffix}`,
    email: `user${suffix}@example.com`,
    name: `Test User ${suffix}`,
    profilePicture: undefined,
  };

  return userModel.create({
    ...defaultData,
    ...overrides,
  } as unknown as IUser);
};

export const authHeaderForUser = (user: IUser): Record<string, string> => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, {
    expiresIn: '1h',
  });

  return {
    Authorization: `Bearer ${token}`,
  };
};

export const toObjectId = (id: string | mongoose.Types.ObjectId) =>
  typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
