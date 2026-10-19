import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/resumo', DashboardController.getResumo);
router.get('/despesas', DashboardController.getDespesasUnificadas);
router.get('/transacoes', DashboardController.getTransacoesFiltradas);
router.get('/projecao', DashboardController.buscaProjecao);
router.get('/agrupamento', DashboardController.buscaAgrupamentoCategoria);

export default router;

