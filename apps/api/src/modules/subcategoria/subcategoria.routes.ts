import { Router } from 'express';
import { SubcategoriaController } from './subcategoria.controller';

const router = Router();

router.get('/', SubcategoriaController.listar);
router.post('/', SubcategoriaController.criar);
router.get('/categoria/:idcategoria', SubcategoriaController.listarPorCategoria);
router.get('/:id', SubcategoriaController.buscar);
router.delete('/:id', SubcategoriaController.deletar);

export default router;

