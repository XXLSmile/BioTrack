import { Router } from 'express';

import { authenticateToken } from './auth/auth.middleware';
import authRoutes from './auth/auth.routes';
import hobbiesRoutes from './hobbies/hobbies.routes';
import mediaRoutes from './media/media.routes';
import usersRoutes from './user/user.routes';

const router = Router();

router.use('/auth', authRoutes);

router.use('/hobbies', authenticateToken, hobbiesRoutes);

router.use('/user', authenticateToken, usersRoutes);

router.use('/media', authenticateToken, mediaRoutes);

export default router;
