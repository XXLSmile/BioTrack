import { Router } from 'express';

import { authenticateToken } from './middlewares/auth.middleware';
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/user.routes';
import catalogRoutes from './routes/catalog.routes';
import recognitionRoutes from './routes/recognition.routes';
import friendRoutes from './routes/friend.routes';

const router = Router();

router.use('/auth', authRoutes);

router.use('/user', authenticateToken, usersRoutes);

router.use('/catalogs', authenticateToken, catalogRoutes);
router.use('/recognition', recognitionRoutes);
router.use('/friends', friendRoutes);

export default router;
