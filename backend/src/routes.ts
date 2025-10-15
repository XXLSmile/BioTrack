import { Router } from 'express';

import { authenticateToken } from './auth/auth.middleware';
import authRoutes from './auth/auth.routes';
import usersRoutes from './user/user.routes';
import adminRoutes from './admin/admin.routes';
import identifyRoutes from './identify/identify.routes';

const router = Router();

router.use('/auth', authRoutes);

router.use('/user', authenticateToken, usersRoutes);

router.use('/identify', identifyRoutes);

// Admin routes (for development/testing only - remove in production!)
router.use('/admin', adminRoutes);

export default router;
