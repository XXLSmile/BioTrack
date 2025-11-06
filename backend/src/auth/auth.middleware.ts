import { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { userModel } from '../user/user.model';
import logger from '../logger.util';

const authenticateTokenImpl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // DEVELOPMENT BYPASS: Skip authentication if DISABLE_AUTH is set to 'true'
    if (process.env.DISABLE_AUTH === 'true') {
      // Use a test user ID or create one
      const testUserId = process.env.TEST_USER_ID;
      
      if (testUserId) {
        const user = await userModel.findById(new mongoose.Types.ObjectId(testUserId));
        if (user) {
          req.user = user;
          next();
          return;
        }
      }
      
      // If no test user found, just proceed without user (will fail on endpoints that need req.user)
      logger.warn('⚠️ AUTHENTICATION DISABLED - No test user set. Set TEST_USER_ID in .env');
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      res.status(401).json({
        error: 'Access denied',
        message: 'No token provided',
      });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({
        error: 'Server misconfiguration',
        message: 'JWT secret is not configured',
      });
      return;
    }

    const decoded = jwt.verify(token, secret);

    const rawId =
      typeof decoded === 'object' && decoded !== null && 'id' in decoded
        ? (decoded as { id: unknown }).id
        : undefined;

    let userObjectId: mongoose.Types.ObjectId | undefined;

    if (typeof rawId === 'string') {
      if (!mongoose.Types.ObjectId.isValid(rawId)) {
        res.status(401).json({
          error: 'Invalid token',
          message: 'Token verification failed',
        });
        return;
      }
      userObjectId = new mongoose.Types.ObjectId(rawId);
    } else if (rawId instanceof mongoose.Types.ObjectId) {
      userObjectId = rawId;
    } else {
      res.status(401).json({
        error: 'Invalid token',
        message: 'Token verification failed',
      });
      return;
    }

    const user = await userModel.findById(userObjectId);

    if (!user) {
      res.status(401).json({
        error: 'User not found',
        message: 'Token is valid but user no longer exists',
      });
      return;
    }

    req.user = user;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Token expired',
        message: 'Please login again',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Invalid token',
        message: 'Token is malformed or expired',
      });
      return;
    }

    next(error);
  }
};

export const authenticateToken: RequestHandler = (req, res, next) => {
  void authenticateTokenImpl(req, res, next).catch(next);
};
