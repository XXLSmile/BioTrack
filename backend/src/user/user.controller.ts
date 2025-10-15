import { NextFunction, Request, Response } from 'express';

import { GetProfileResponse, UpdateProfileRequest } from '../user/user.types';
import logger from '../logger.util';
import { MediaService } from '../media/media.service';
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

      await MediaService.deleteAllUserImages(user._id.toString());

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
}
