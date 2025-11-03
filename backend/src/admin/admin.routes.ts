import { Router, Request, Response } from 'express';
import type { NextFunction } from 'express';
import mongoose from 'mongoose';
import { userModel } from '../user/user.model';
import { adminController } from './admin.controller';

const router = Router();

type ReqOf<T> = T extends (req: infer Req, res: any, next: any) => any ? Req : never;
type ResOf<T> = T extends (req: any, res: infer Res, next: any) => any ? Res : never;

const wrapController = <T extends (req: any, res: any, next: NextFunction) => any>(fn: T) => {
  return (req: ReqOf<T>, res: ResOf<T>, next: NextFunction): void => {
    const maybePromise = fn(req, res, next);
    if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === 'function') {
      void (maybePromise as Promise<unknown>).catch(next);
    }
  };
};

// TEMPORARY ADMIN ROUTES - Remove in production!
// These are for development/testing only

/**
 * GET /admin/users
 * List all users (for testing only)
 */
const listUsers = wrapController(async (req: Request, res: Response, _next: NextFunction) => {
  try {
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
});

/**
 * GET /admin/users/:userId
 * Get specific user details
 */
const getUser = wrapController(async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);
    const user = await userModel.findById(userId);

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
});

/**
 * GET /admin/stats
 * Get database statistics
 */
const getStats = wrapController(async (req: Request, res: Response, _next: NextFunction) => {
  try {
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
});

/**
 * POST /admin/create-user
 * Manually create a test user (DEV ONLY)
 */
const createTestUser = wrapController(adminController.createTestUser.bind(adminController));

router.get('/users', listUsers);
router.get('/users/:userId', getUser);
router.get('/stats', getStats);
router.post('/create-user', createTestUser);

export default router;
