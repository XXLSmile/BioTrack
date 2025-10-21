import { Router } from 'express';

import { authenticateToken } from './auth/auth.middleware';
import authRoutes from './auth/auth.routes';
import usersRoutes from './user/user.routes';
import catalogRoutes from './catalog/catalog.routes';
import adminRoutes from './admin/admin.routes';
import recognitionRoutes from './recognition/recognition.routes';
import friendRoutes from './friends/friend.routes';

const router = Router();

router.use('/auth', authRoutes);

router.use('/user', authenticateToken, usersRoutes);

//router.use('/media', authenticateToken, mediaRoutes);
router.use('/catalogs', authenticateToken, catalogRoutes);
router.use('/recognition', recognitionRoutes);
router.use('/friends', friendRoutes);

// Admin routes (for development/testing only - remove in production!)
router.use('/admin', adminRoutes);

export default router;
