import { Router } from 'express';
import { PlanejamentoController } from './planejamento.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', PlanejamentoController.criar);
router.put('/:id', PlanejamentoController.atualizar);
router.delete('/:id', PlanejamentoController.deletar);
router.get('/agrupados', PlanejamentoController.listarAgrupado);
router.get('/resumo', PlanejamentoController.resumo);
router.get('/', PlanejamentoController.listar);
router.get('/:id', PlanejamentoController.buscar);

export default router;

