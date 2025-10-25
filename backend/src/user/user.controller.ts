import { NextFunction, Request, Response } from 'express';

import mongoose from 'mongoose';

import { GetProfileResponse, UpdateProfileRequest } from '../user/user.types';
import logger from '../logger.util';
import { userModel } from '../user/user.model';

export class UserController {
  getProfile(req: Request, res: Response<GetProfileResponse>) {
    const user = req.user!;

    res.status(200).json({
      message: 'Profile fetched successfully',
      data: { user },
    });
  }

  async updateProfile(
    req: Request<unknown, unknown, UpdateProfileRequest>,
    res: Response<GetProfileResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { username } = req.body;

      // Check if username is being changed and if it's available
      if (username && username !== user.username) {
        const isAvailable = await userModel.isUsernameAvailable(username);
        if (!isAvailable) {
          return res.status(409).json({
            message: 'Username already taken. Please choose a different username.',
          });
        }
      }

      const updatedUser = await userModel.update(user._id, req.body);

      if (!updatedUser) {
        return res.status(404).json({
          message: 'User not found',
        });
      }

      res.status(200).json({
        message: 'User info updated successfully',
        data: { user: updatedUser },
      });
    } catch (error) {
      logger.error('Failed to update user info:', error);

      if (error instanceof Error) {
        // Handle duplicate username error from MongoDB
        if (error.message.includes('duplicate key') || error.message.includes('E11000')) {
          return res.status(409).json({
            message: 'Username already taken. Please choose a different username.',
          });
        }

        return res.status(500).json({
          message: error.message || 'Failed to update user info',
        });
      }

      next(error);
    }
  }

  async deleteProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;


      await userModel.delete(user._id);

      res.status(200).json({
        message: 'User deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete user:', error);

      if (error instanceof Error) {
        return res.status(500).json({
          message: error.message || 'Failed to delete user',
        });
      }

      next(error);
    }
  }

  // BioTrack specific endpoints
  async getUserByUsername(req: Request, res: Response, next: NextFunction) {
    try {
      const { username } = req.params;

      // Search by username (no spaces!)
      const user = await userModel.findByUsername(username);

      if (!user) {
        return res.status(404).json({
          message: 'User not found',
        });
      }

      // Only show public profiles or own profile
      const requestingUser = req.user;
      if (!user.isPublicProfile && (!requestingUser || requestingUser._id.toString() !== user._id.toString())) {
        return res.status(403).json({
          message: 'This profile is private',
        });
      }

      // Don't expose sensitive info for other users
      const publicProfile = {
        _id: user._id,
        name: user.name,
        username: user.username,
        profilePicture: user.profilePicture,
        location: user.location,
        region: user.region,
        observationCount: user.observationCount,
        speciesDiscovered: user.speciesDiscovered,
        badges: user.badges,
        friendCount: user.friendCount,
        createdAt: user.createdAt,
      };

      res.status(200).json({
        message: 'User profile fetched successfully',
        data: { user: publicProfile },
      });
    } catch (error) {
      logger.error('Failed to fetch user profile by username:', error);
      next(error);
    }
  }

  async getUserByName(req: Request, res: Response, next: NextFunction) {
    try {
      const { username } = req.params;

      // Search by name (case-insensitive)
      const user = await userModel.findByName(username);

      if (!user) {
        return res.status(404).json({
          message: 'User not found',
        });
      }

      // Only show public profiles or own profile
      const requestingUser = req.user;
      if (!user.isPublicProfile && (!requestingUser || requestingUser._id.toString() !== user._id.toString())) {
        return res.status(403).json({
          message: 'This profile is private',
        });
      }

      // Don't expose sensitive info for other users
      const publicProfile = {
        _id: user._id,
        name: user.name,
        profilePicture: user.profilePicture,
        location: user.location,
        region: user.region,
        observationCount: user.observationCount,
        speciesDiscovered: user.speciesDiscovered,
        badges: user.badges,
        friendCount: user.friendCount,
        createdAt: user.createdAt,
      };

      res.status(200).json({
        message: 'User profile fetched successfully',
        data: { user: publicProfile },
      });
    } catch (error) {
      logger.error('Failed to fetch user profile by name:', error);
      next(error);
    }
  }

  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      const user = await userModel.findById(new (require('mongoose').Types.ObjectId)(userId));

      if (!user) {
        return res.status(404).json({
          message: 'User not found',
        });
      }

      // Only show public profiles or own profile
      const requestingUser = req.user;
      if (!user.isPublicProfile && (!requestingUser || requestingUser._id.toString() !== userId)) {
        return res.status(403).json({
          message: 'This profile is private',
        });
      }

      // Don't expose sensitive info for other users
      const publicProfile = {
        _id: user._id,
        name: user.name,
        profilePicture: user.profilePicture,
        location: user.location,
        region: user.region,
        observationCount: user.observationCount,
        speciesDiscovered: user.speciesDiscovered,
        badges: user.badges,
        friendCount: user.friendCount,
        createdAt: user.createdAt,
      };

      res.status(200).json({
        message: 'User profile fetched successfully',
        data: { user: publicProfile },
      });
    } catch (error) {
      logger.error('Failed to fetch user profile:', error);
      next(error);
    }
  }

  async searchUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { query } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          message: 'Search query is required',
        });
      }

      const excludeUserId = req.user?._id
        ? req.user._id instanceof mongoose.Types.ObjectId
          ? req.user._id
          : new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const users = await userModel.searchByName(query, 10, excludeUserId);
      const currentUserId = req.user?._id?.toString();

      // Filter to only show public profiles
      const publicUsers = users
        .filter(user => user.isPublicProfile)
        .filter(user => {
          if (!currentUserId) {
            return true;
          }
          return user._id.toString() !== currentUserId;
        })
        .map(user => ({
          _id: user._id,
          name: user.name,
          profilePicture: user.profilePicture,
          location: user.location,
          observationCount: user.observationCount,
          speciesDiscovered: user.speciesDiscovered,
        }));

      res.status(200).json({
        message: 'Search completed successfully',
        data: { users: publicUsers, count: publicUsers.length },
      });
    } catch (error) {
      logger.error('Failed to search users:', error);
      next(error);
    }
  }

  async getUserStats(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;

      const stats = await userModel.getUserStats(user._id);

      if (!stats) {
        return res.status(404).json({
          message: 'User stats not found',
        });
      }

      res.status(200).json({
        message: 'User stats fetched successfully',
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to fetch user stats:', error);

      if (error instanceof Error) {
        return res.status(500).json({
          message: error.message || 'Failed to fetch user stats',
        });
      }

      next(error);
    }
  }

  async addFavoriteSpecies(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { speciesName } = req.body;

      if (!speciesName) {
        return res.status(400).json({
          message: 'Species name is required',
        });
      }

      await userModel.addFavoriteSpecies(user._id, speciesName);

      res.status(200).json({
        message: 'Favorite species added successfully',
      });
    } catch (error) {
      logger.error('Failed to add favorite species:', error);
      next(error);
    }
  }

  async removeFavoriteSpecies(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { speciesName } = req.body;

      if (!speciesName) {
        return res.status(400).json({
          message: 'Species name is required',
        });
      }

      await userModel.removeFavoriteSpecies(user._id, speciesName);

      res.status(200).json({
        message: 'Favorite species removed successfully',
      });
    } catch (error) {
      logger.error('Failed to remove favorite species:', error);
      next(error);
    }
  }

  async checkUsernameAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const { username } = req.query;

      if (!username || typeof username !== 'string') {
        return res.status(400).json({
          message: 'Username is required',
        });
      }

      // Validate username format
      if (!/^[a-z0-9_]+$/.test(username)) {
        return res.status(400).json({
          message: 'Invalid username format. Use only lowercase letters, numbers, and underscores.',
          available: false,
        });
      }

      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({
          message: 'Username must be between 3 and 30 characters.',
          available: false,
        });
      }

      const isAvailable = await userModel.isUsernameAvailable(username);

      res.status(200).json({
        message: isAvailable ? 'Username is available' : 'Username is already taken',
        available: isAvailable,
        username: username.toLowerCase(),
      });
    } catch (error) {
      logger.error('Failed to check username availability:', error);
      next(error);
    }
  }

  async updateFcmToken(req: Request, res: Response) {
  const user = req.user!;
  const { token } = req.body;

  await userModel.update(user._id, { fcmToken: token });

  res.status(200).json({ message: "Token updated" });
}


}
