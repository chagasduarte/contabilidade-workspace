// card.routes.ts

import { Router } from 'express';
import { CardController } from './card.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

// Todas as rotas de cartões exigem autenticação
router.use(authMiddleware);

// POST /cards - Cadastrar cartão de crédito
router.post('/', CardController.criar);

// GET /cards - Listar cartões do usuário com limites consolidado
router.get('/', CardController.listar);

// POST /cards/transacoes - Lançar nova compra (à vista ou parcelada)
router.post('/transacoes', CardController.lancarTransacao);

// GET /cards/faturas/:faturaId - Detalhes de uma fatura com seus lançamentos (invoice_items)
router.get('/faturas/:faturaId', CardController.obterFatura);

// POST /cards/faturas/:faturaId/pagar - Liquidar fatura
router.post('/faturas/:faturaId/pagar', CardController.pagarFatura);

// GET /cards/:id/faturas - Listar faturas do cartão (com navegação por mês/ano)
router.get('/:id/faturas', CardController.listarFaturas);

// GET /cards/:id - Detalhes de um cartão específico
router.get('/:id', CardController.obterPorId);

// PUT /cards/:id - Editar dados do cartão
router.put('/:id', CardController.atualizar);

export default router;

