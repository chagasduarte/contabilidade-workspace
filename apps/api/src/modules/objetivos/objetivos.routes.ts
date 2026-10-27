import { Router } from 'express';
import { ObjetivosController } from './objetivos.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', ObjetivosController.listar);
router.post('/', ObjetivosController.criar);
router.get('/:id', ObjetivosController.buscar);
router.put('/:id', ObjetivosController.atualizar);
router.post('/:id/aportes', ObjetivosController.aportar);
router.delete('/:id', ObjetivosController.deletar);

export default router;

