import { Request, Response } from 'express';
import {
  LoanBusiness,
  LoanNotFoundError,
  InstallmentNotFoundError,
  LoanValidationError,
} from './loan.business';
import { CreateLoanDto, RegisterPaymentDto } from './loan.dto';
import { normalizeUserIdToUuid } from './loan.repository';
import { lerPaginacao, responderPaginado, PaginacaoInvalidaError } from '../../common/utils/paginacao';

export const LoanController = {
  /**
   * POST /loans
   * Cria o contrato de empréstimo e seu cronograma inicial de parcelas.
   */
  async criar(req: Request, res: Response): Promise<void> {
    try {
      // Identidade vem exclusivamente do token (nunca do body)
      const usuarioId = req.usuarioId;
      if (!usuarioId) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const dto: CreateLoanDto = {
        user_id: normalizeUserIdToUuid(usuarioId),
        institution_name: req.body.institution_name ?? req.body.instituicao,
        principal_amount: Number(req.body.principal_amount ?? req.body.valor_principal),
        monthly_interest_rate: Number(req.body.monthly_interest_rate ?? req.body.taxa_juros_mensal),
        total_installments: Number(req.body.total_installments ?? req.body.quantidade_parcelas),
        installment_amount: Number(req.body.installment_amount ?? req.body.valor_parcela),
        first_due_date: req.body.first_due_date ?? req.body.primeiro_vencimento,

        // Aliases para compatibilidade
        usuario_id: usuarioId,
        instituicao: req.body.institution_name ?? req.body.instituicao,
        valor_principal: Number(req.body.principal_amount ?? req.body.valor_principal),
        taxa_juros_mensal: Number(req.body.monthly_interest_rate ?? req.body.taxa_juros_mensal),
        quantidade_parcelas: Number(req.body.total_installments ?? req.body.quantidade_parcelas),
        valor_parcela: Number(req.body.installment_amount ?? req.body.valor_parcela),
        primeiro_vencimento: req.body.first_due_date ?? req.body.primeiro_vencimento,
      };

      const resultado = await LoanBusiness.criarEmprestimo(dto);
      res.status(201).json(resultado);
    } catch (error: unknown) {
      if (error instanceof LoanValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Erro ao criar empréstimo.';
      res.status(400).json({ erro: message, error: message });
    }
  },

  /**
   * POST /loans/pagamentos
   * Registra a amortização/pagamento de uma parcela com validações financeiras.
   */
  async registrarPagamento(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.usuarioId;
      if (!usuarioId) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const dto: RegisterPaymentDto = {
        loan_id: req.body.loan_id ?? req.body.emprestimo_id,
        installment_id: req.body.installment_id ?? req.body.parcela_id,
        amount_paid: Number(req.body.amount_paid ?? req.body.valor_pago),
        discount_amount:
          req.body.discount_amount !== undefined
            ? Number(req.body.discount_amount)
            : req.body.valor_desconto !== undefined
            ? Number(req.body.valor_desconto)
            : undefined,
        penalty_interest:
          req.body.penalty_interest !== undefined
            ? Number(req.body.penalty_interest)
            : req.body.multa_juros !== undefined
            ? Number(req.body.multa_juros)
            : undefined,
        payment_method: req.body.payment_method ?? req.body.metodo_pagamento,
        payment_date: req.body.payment_date ?? req.body.data_pagamento,

        // Aliases para compatibilidade
        emprestimo_id: req.body.loan_id ?? req.body.emprestimo_id,
        parcela_id: req.body.installment_id ?? req.body.parcela_id,
        valor_pago: Number(req.body.amount_paid ?? req.body.valor_pago),
        valor_desconto:
          req.body.discount_amount !== undefined
            ? Number(req.body.discount_amount)
            : req.body.valor_desconto !== undefined
            ? Number(req.body.valor_desconto)
            : undefined,
        multa_juros:
          req.body.penalty_interest !== undefined
            ? Number(req.body.penalty_interest)
            : req.body.multa_juros !== undefined
            ? Number(req.body.multa_juros)
            : undefined,
        metodo_pagamento: req.body.payment_method ?? req.body.metodo_pagamento,
        data_pagamento: req.body.payment_date ?? req.body.data_pagamento,
      };

      const resultado = await LoanBusiness.registrarPagamento(dto, usuarioId);
      res.status(201).json(resultado);
    } catch (error: unknown) {
      if (
        error instanceof LoanNotFoundError ||
        error instanceof InstallmentNotFoundError
      ) {
        res.status(404).json({ erro: error.message, error: error.message });
        return;
      }
      if (error instanceof LoanValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Erro ao registrar pagamento.';
      res.status(500).json({ erro: message, error: message });
    }
  },

  /**
   * GET /loans/:id/resumo
   * Retorna o resumo consolidado do progresso financeiro e da economia obtida.
   */
  async obterResumo(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const usuarioId = req.usuarioId;

      const resumo = await LoanBusiness.obterResumo(id, usuarioId);
      res.status(200).json(resumo);
    } catch (error: unknown) {
      if (error instanceof LoanNotFoundError) {
        res.status(404).json({ erro: error.message, error: error.message });
        return;
      }
      if (error instanceof LoanValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Erro ao obter resumo do empréstimo.';
      res.status(500).json({ erro: message, error: message });
    }
  },

  /**
   * GET /loans
   * Lista todos os empréstimos pertencentes ao usuário logado.
   */
  async listar(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.usuarioId;
      if (!usuarioId) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      // Paginação opcional: sem ?paginado/?cursor a resposta continua sendo o array completo
      const paginacao = lerPaginacao(req.query as Record<string, unknown>);
      if (paginacao.paginado && paginacao.limit) {
        const { items, next_cursor } = await LoanBusiness.listarPaginaPorUsuario(
          usuarioId,
          paginacao.cursor,
          paginacao.limit
        );
        responderPaginado(res, items, next_cursor, true);
        return;
      }

      const emprestimos = await LoanBusiness.listarPorUsuario(usuarioId);
      res.status(200).json(emprestimos);
    } catch (error: unknown) {
      if (error instanceof PaginacaoInvalidaError || error instanceof LoanValidationError) {
        res.status(400).json({ erro: (error as Error).message, error: (error as Error).message });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Erro ao listar empréstimos.';
      res.status(500).json({ erro: message, error: message });
    }
  },

  /**
   * GET /loans/:id
   * Busca detalhes e parcelas de um empréstimo específico.
   */
  async buscarPorId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const usuarioId = req.usuarioId;

      const resultado = await LoanBusiness.buscarPorId(id, usuarioId);
      res.status(200).json(resultado);
    } catch (error: unknown) {
      if (error instanceof LoanNotFoundError) {
        res.status(404).json({ erro: error.message, error: error.message });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Erro ao buscar empréstimo.';
      res.status(500).json({ erro: message, error: message });
    }
  },
};
