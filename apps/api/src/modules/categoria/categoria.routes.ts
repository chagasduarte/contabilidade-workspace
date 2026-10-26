import { Router } from 'express';
import { CategoriaController } from './categoria.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', CategoriaController.listar);
router.post('/', CategoriaController.criar);
router.get('/:id', CategoriaController.buscar);
router.put('/:id', CategoriaController.atualizar);
router.delete('/:id', CategoriaController.deletar);


export default router;

