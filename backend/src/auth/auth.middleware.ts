import { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { userModel } from '../user/user.model';

export const resolveUserObjectId = (
  rawId: unknown
): mongoose.Types.ObjectId | undefined => {
  if (typeof rawId === 'string') {
    if (!mongoose.Types.ObjectId.isValid(rawId)) {
      return undefined;
    }

    return new mongoose.Types.ObjectId(rawId);
  }

  if (rawId instanceof mongoose.Types.ObjectId) {
    return rawId;
  }

  return undefined;
};

const authenticateTokenImpl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
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

    const userObjectId = resolveUserObjectId(rawId);

    if (!userObjectId) {
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

    throw error;
  }
};

export const authenticateToken: RequestHandler = (req, res, next) => {
  authenticateTokenImpl(req, res, next).catch((error: unknown) => {
    next(error);
  });
};
