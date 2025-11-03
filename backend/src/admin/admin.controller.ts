// ADMIN CONTROLLER - For development/testing
import { Request, Response } from 'express';
import { z } from 'zod';

import { userModel } from '../user/user.model';
import logger from '../logger.util';
import { GoogleUserInfo } from '../user/user.types';

const createTestUserSchema = z.object({
  googleId: z.string().min(1, 'googleId is required'),
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'Name is required'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-z0-9_]+$/, 'Username must be lowercase letters, numbers, and underscores'),
});

export class AdminController {
  // Create a test user manually (DEV ONLY)
  async createTestUser(req: Request, res: Response) {
    try {
      const { googleId, email, name, username } = createTestUserSchema.parse(req.body);
      const normalizedUsername = username.toLowerCase();

      // Check if user already exists
      const existing = await userModel.findByGoogleId(googleId);
      if (existing) {
        return res.status(409).json({
          message: 'User with this googleId already exists',
        });
      }

      // Check username availability
      const isAvailable = await userModel.isUsernameAvailable(normalizedUsername);
      if (!isAvailable) {
        return res.status(409).json({
          message: 'Username already taken',
        });
      }

      const userPayload: GoogleUserInfo = {
        googleId,
        email,
        name,
        profilePicture: 'https://via.placeholder.com/150',
      };

      const user = await userModel.create(userPayload);
      
      // Update username separately
      await userModel.update(user._id, { username: normalizedUsername });

      logger.info(`Test user created: ${email}`);

      return res.status(201).json({
        message: 'Test user created successfully',
        data: { user },
      });
    } catch (error) {
      logger.error('Failed to create test user:', error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to create user',
      });
    }
  }
}

export const adminController = new AdminController();
