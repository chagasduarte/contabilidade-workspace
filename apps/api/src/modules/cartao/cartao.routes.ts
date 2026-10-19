import { Router } from 'express';
import { CartaoController } from './cartao.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', CartaoController.listar);
router.post('/', CartaoController.criar);

export default router;

