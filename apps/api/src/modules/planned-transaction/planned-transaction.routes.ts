// planned-transaction.routes.ts
// Definição de rotas autenticadas para Planned Transactions

import { Router } from 'express';
import { PlannedTransactionController } from './planned-transaction.controller';
import { SettlementController } from '../settlement/settlement.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

// Todas as rotas de transações planejadas exigem autenticação prévia
router.use(authMiddleware);

// POST /api/planned-transactions - Cadastra nova transação planejada
router.post('/', PlannedTransactionController.criar);

// GET /api/planned-transactions - Lista transações com filtros (status, tipo, dataInicio, dataFim, idcategoria)
router.get('/', PlannedTransactionController.listar);

// POST /api/planned-transactions/:id/settle - Efetivação/Liquidação contábil da obrigação
router.post('/:id/settle', SettlementController.settlePlannedTransaction);

// GET /api/planned-transactions/:id - Obtém detalhes por ID
router.get('/:id', PlannedTransactionController.obterPorId);

// PUT /api/planned-transactions/:id - Atualiza dados parciais
router.put('/:id', PlannedTransactionController.atualizar);

// DELETE /api/planned-transactions/:id - Remove (física ou lógica com ?soft=true)
router.delete('/:id', PlannedTransactionController.deletar);

export default router;

