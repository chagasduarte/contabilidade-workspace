import { Router } from 'express';
import { AiController } from './ai.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/chat', AiController.processMessage);

export default router;

