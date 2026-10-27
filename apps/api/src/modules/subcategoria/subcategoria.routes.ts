import { Router } from 'express';
import { SubcategoriaController } from './subcategoria.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', SubcategoriaController.listar);
router.post('/', SubcategoriaController.criar);
router.get('/categoria/:idcategoria', SubcategoriaController.listarPorCategoria);
router.get('/:id', SubcategoriaController.buscar);
router.put('/:id', SubcategoriaController.atualizar);
router.delete('/:id', SubcategoriaController.deletar);

export default router;

