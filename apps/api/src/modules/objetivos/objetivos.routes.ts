import { Router } from 'express';
import { ObjetivosController } from './objetivos.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', ObjetivosController.listar);
router.post('/', ObjetivosController.criar);

export default router;

