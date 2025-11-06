import { Router } from 'express';

import { authenticateToken } from './auth/auth.middleware';
import authRoutes from './auth/auth.routes';
import usersRoutes from './user/user.routes';
import catalogRoutes from './catalog/catalog.routes';
import recognitionRoutes from './recognition/recognition.routes';
import friendRoutes from './friends/friend.routes';

const router = Router();

router.use('/auth', authRoutes);

router.use('/user', authenticateToken, usersRoutes);

router.use('/catalogs', authenticateToken, catalogRoutes);
router.use('/recognition', recognitionRoutes);
router.use('/friends', friendRoutes);

export default router;
