import { Router, Request, Response } from 'express';
import { userModel } from '../user/user.model';
import { adminController } from './admin.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// TEMPORARY ADMIN ROUTES - Remove in production!
// These are for development/testing only

/**
 * GET /admin/users
 * List all users (for testing only)
 */
router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  try {
    const mongoose = require('mongoose');
    const User = mongoose.model('User');
    const users = await User.find({}).limit(50).select('-googleId');

    res.json({
      message: 'Users fetched successfully',
      count: users.length,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch users',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * GET /admin/users/:userId
 * Get specific user details
 */
router.get('/users/:userId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const user = await userModel.findById(new (require('mongoose').Types.ObjectId)(req.params.userId));

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      message: 'User fetched successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * GET /admin/stats
 * Get database statistics
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  try {
    const mongoose = require('mongoose');

    const userCount = await mongoose.model('User').countDocuments();

    res.json({
      message: 'Database stats',
      data: {
        totalUsers: userCount,
        database: 'biotrack',
        collections: ['users', 'observations', 'species'],
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch stats',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * POST /admin/create-user
 * Manually create a test user (DEV ONLY)
 */
router.post('/create-user', asyncHandler(adminController.createTestUser.bind(adminController)));

export default router;
