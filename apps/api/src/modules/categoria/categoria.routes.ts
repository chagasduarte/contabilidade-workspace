import { Router } from 'express';
import { CategoriaController } from './categoria.controller';

const router = Router();

router.get('/', CategoriaController.listar);
router.post('/', CategoriaController.criar);
router.get('/:id', CategoriaController.buscar);
router.put('/:id', CategoriaController.atualizar);
router.delete('/:id', CategoriaController.deletar);


export default router;

