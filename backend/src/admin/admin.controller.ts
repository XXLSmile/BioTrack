// ADMIN CONTROLLER - For development/testing
import { Request, Response } from 'express';
import { userModel } from '../user/user.model';
import logger from '../logger.util';

export class AdminController {
  // Create a test user manually (DEV ONLY)
  async createTestUser(req: Request, res: Response) {
    try {
      const { googleId, email, name, username } = req.body;

      if (!googleId || !email || !name || !username) {
        return res.status(400).json({
          message: 'googleId, email, name, and username are required',
        });
      }

      // Check if user already exists
      const existing = await userModel.findByGoogleId(googleId);
      if (existing) {
        return res.status(409).json({
          message: 'User with this googleId already exists',
        });
      }

      // Check username availability
      const isAvailable = await userModel.isUsernameAvailable(username);
      if (!isAvailable) {
        return res.status(409).json({
          message: 'Username already taken',
        });
      }

      // Create user with placeholder profile picture for test accounts
      const user = await userModel.create({
        googleId,
        email,
        name,
        profilePicture: 'https://via.placeholder.com/150',
      });
      
      // Update username separately
      await userModel.update(user._id, { username: username.toLowerCase() });

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
