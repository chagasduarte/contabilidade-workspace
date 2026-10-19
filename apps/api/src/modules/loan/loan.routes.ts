import { Router } from 'express';
import { LoanController } from './loan.controller';
import { SettlementController } from '../settlement/settlement.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

// Todas as rotas de empréstimos requerem autenticação
router.use(authMiddleware);

// POST /loans - Cria contrato e cronograma de parcelas
router.post('/', LoanController.criar);

// POST /loans/pagamentos - Efetiva pagamento/amortização de parcela
router.post('/pagamentos', LoanController.registrarPagamento);

// POST /loans/installments/:id/settle - Efetiva liquidação da parcela e gera transação contábil
router.post('/installments/:id/settle', SettlementController.settleLoanInstallment);

// GET /loans/:id/resumo - Consulta progresso financeiro e economia
router.get('/:id/resumo', LoanController.obterResumo);

// GET /loans - Lista os empréstimos do usuário autenticado
router.get('/', LoanController.listar);

// GET /loans/:id - Busca detalhes e parcelas de um empréstimo específico
router.get('/:id', LoanController.buscarPorId);

export default router;

