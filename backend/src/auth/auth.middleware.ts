import { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { userModel } from '../user/user.model';

export const authenticateToken: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const run = async () => {
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
        console.warn('⚠️ AUTHENTICATION DISABLED - No test user set. Set TEST_USER_ID in .env');
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

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        id: mongoose.Types.ObjectId;
      };

      if (!decoded || !decoded.id) {
        res.status(401).json({
          error: 'Invalid token',
          message: 'Token verification failed',
        });
        return;
      }

      const user = await userModel.findById(decoded.id);

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
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          error: 'Invalid token',
          message: 'Token is malformed or expired',
        });
        return;
      }

      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          error: 'Token expired',
          message: 'Please login again',
        });
        return;
      }

      next(error);
    }
  };

  void run();
};
