// settlement.controller.ts
// Controller REST para liquidação/efetivação de obrigações pendentes

import { Request, Response } from 'express';
import {
  SettlementConflictError,
  SettlementNotFoundError,
  SettlementService,
  SettlementValidationError,
} from './settlement.service';
import { SettleLoanInstallmentDto, SettlePlannedTransactionDto } from './settlement.dto';

export const SettlementController = {
  /**
   * POST /api/planned-transactions/:id/settle
   * Efetiva o pagamento/recebimento de uma obrigação prevista avulsa.
   */
  async settlePlannedTransaction(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.usuarioId;
      if (!userId) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const { id } = req.params;
      const dto: SettlePlannedTransactionDto = {
        valor_pago: req.body.valor_pago !== undefined && req.body.valor_pago !== null
          ? Number(req.body.valor_pago)
          : undefined,
        data_pagamento: req.body.data_pagamento,
        idcategoria: req.body.idcategoria !== undefined && req.body.idcategoria !== null
          ? Number(req.body.idcategoria)
          : undefined,
        descricao: req.body.descricao,
      };

      const resultado = await SettlementService.settlePlannedTransaction(id, dto, userId);
      res.status(200).json(resultado);
    } catch (error: unknown) {
      if (error instanceof SettlementValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      if (error instanceof SettlementNotFoundError) {
        res.status(404).json({ erro: error.message, error: error.message });
        return;
      }
      if (error instanceof SettlementConflictError) {
        res.status(409).json({ erro: error.message, error: error.message });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Erro ao efetivar transação planejada.';
      res.status(500).json({ erro: message, error: message });
    }
  },

  /**
   * POST /api/loans/installments/:id/settle
   * Efetiva a liquidação de uma parcela de empréstimo.
   */
  async settleLoanInstallment(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.usuarioId;
      if (!userId) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const { id } = req.params;
      const dto: SettleLoanInstallmentDto = {
        valor_pago: req.body.valor_pago !== undefined && req.body.valor_pago !== null
          ? Number(req.body.valor_pago)
          : undefined,
        data_pagamento: req.body.data_pagamento,
        idcategoria: req.body.idcategoria !== undefined && req.body.idcategoria !== null
          ? Number(req.body.idcategoria)
          : undefined,
        descricao: req.body.descricao,
      };

      const resultado = await SettlementService.settleLoanInstallment(id, dto, userId);
      res.status(200).json(resultado);
    } catch (error: unknown) {
      if (error instanceof SettlementValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      if (error instanceof SettlementNotFoundError) {
        res.status(404).json({ erro: error.message, error: error.message });
        return;
      }
      if (error instanceof SettlementConflictError) {
        res.status(409).json({ erro: error.message, error: error.message });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Erro ao liquidar parcela de empréstimo.';
      res.status(500).json({ erro: message, error: message });
    }
  },
};

