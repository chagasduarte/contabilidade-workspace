// forecast.routes.ts
// Rotas autenticadas para o Motor de Projeção de Fluxo de Caixa

import { Router } from 'express';
import { ForecastController } from './forecast.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

// Todas as rotas de projeção de fluxo de caixa exigem autenticação prévia
router.use(authMiddleware);

// GET /api/forecast - Projeção de fluxo de caixa, saldo seguro e simulação de compra
router.get('/', ForecastController.getForecast);

export default router;

