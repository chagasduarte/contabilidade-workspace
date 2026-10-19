// planned-transaction.controller.ts
// Controller REST para Planned Transactions (Receitas e Despesas previstas)

import { Request, Response } from 'express';
import {
  PlannedTransactionBusiness,
  PlannedTransactionNotFoundError,
  PlannedTransactionValidationError,
} from './planned-transaction.business';
import {
  CreatePlannedTransactionDto,
  PlannedTransactionFilterDto,
  UpdatePlannedTransactionDto,
} from './planned-transaction.dto';

export const PlannedTransactionController = {
  /**
   * POST /api/planned-transactions
   * Cadastra uma nova transação planejada.
   */
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const dto: CreatePlannedTransactionDto = {
        descricao: req.body.descricao,
        tipo: req.body.tipo,
        valor: Number(req.body.valor),
        data_prevista: req.body.data_prevista,
        idcategoria:
          req.body.idcategoria !== undefined && req.body.idcategoria !== null
            ? Number(req.body.idcategoria)
            : undefined,
        recorrencia: req.body.recorrencia,
        data_limite_recorrencia: req.body.data_limite_recorrencia,
        status: req.body.status,
        parent_recurrence_id: req.body.parent_recurrence_id,
      };

      const resultado = await PlannedTransactionBusiness.criar(dto, userid);
      res.status(201).json(resultado);
    } catch (error: unknown) {
      if (error instanceof PlannedTransactionValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Erro ao cadastrar transação planejada.';
      res.status(500).json({ erro: message, error: message });
    }
  },

  /**
   * GET /api/planned-transactions
   * Lista transações planejadas com filtros opcionais (status, tipo, dataInicio, dataFim, idcategoria).
   */
  async listar(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const query = req.query;
      const filtros: PlannedTransactionFilterDto = {
        status: query['status'] ? String(query['status']) : undefined,
        tipo: query['tipo'] ? String(query['tipo']) : undefined,
        dataInicio: (query['dataInicio'] || query['data_inicio'] || query['inicio'])
          ? String(query['dataInicio'] || query['data_inicio'] || query['inicio'])
          : undefined,
        dataFim: (query['dataFim'] || query['data_fim'] || query['fim'])
          ? String(query['dataFim'] || query['data_fim'] || query['fim'])
          : undefined,
        idcategoria: (query['idcategoria'] || query['categoria_id'] || query['categoria'])
          ? String(query['idcategoria'] || query['categoria_id'] || query['categoria'])
          : undefined,
      };

      const transacoes = await PlannedTransactionBusiness.listar(filtros, userid);
      res.status(200).json(transacoes);
    } catch (error: unknown) {
      if (error instanceof PlannedTransactionValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Erro ao listar transações planejadas.';
      res.status(500).json({ erro: message, error: message });
    }
  },

  /**
   * GET /api/planned-transactions/:id
   * Obtém detalhes de uma transação planejada específica por ID.
   */
  async obterPorId(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const { id } = req.params;
      const resultado = await PlannedTransactionBusiness.buscarPorId(id, userid);
      res.status(200).json(resultado);
    } catch (error: unknown) {
      if (error instanceof PlannedTransactionNotFoundError) {
        res.status(404).json({ erro: error.message, error: error.message });
        return;
      }
      if (error instanceof PlannedTransactionValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Erro ao obter transação planejada.';
      res.status(500).json({ erro: message, error: message });
    }
  },

  /**
   * PUT /api/planned-transactions/:id
   * Atualiza parcialmente dados de uma transação planejada.
   */
  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const { id } = req.params;
      const dto: UpdatePlannedTransactionDto = {};

      if (req.body.descricao !== undefined) dto.descricao = req.body.descricao;
      if (req.body.tipo !== undefined) dto.tipo = req.body.tipo;
      if (req.body.valor !== undefined) dto.valor = Number(req.body.valor);
      if (req.body.data_prevista !== undefined) dto.data_prevista = req.body.data_prevista;
      if (req.body.idcategoria !== undefined) {
        dto.idcategoria =
          req.body.idcategoria !== null && req.body.idcategoria !== ''
            ? Number(req.body.idcategoria)
            : null;
      }
      if (req.body.recorrencia !== undefined) dto.recorrencia = req.body.recorrencia;
      if (req.body.data_limite_recorrencia !== undefined) {
        dto.data_limite_recorrencia = req.body.data_limite_recorrencia || null;
      }
      if (req.body.status !== undefined) dto.status = req.body.status;
      if (req.body.updateMode !== undefined) dto.updateMode = req.body.updateMode;

      const resultado = await PlannedTransactionBusiness.atualizar(id, dto, userid);
      res.status(200).json(resultado);
    } catch (error: unknown) {
      if (error instanceof PlannedTransactionNotFoundError) {
        res.status(404).json({ erro: error.message, error: error.message });
        return;
      }
      if (error instanceof PlannedTransactionValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Erro ao atualizar transação planejada.';
      res.status(500).json({ erro: message, error: message });
    }
  },

  /**
   * DELETE /api/planned-transactions/:id
   * Remove a transação planejada (física por padrão ou lógica se ?soft=true).
   */
  async deletar(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const { id } = req.params;
      const isSoft =
        req.query['soft'] === 'true' ||
        req.query['soft'] === '1' ||
        req.query['logica'] === 'true';

      const resultado = await PlannedTransactionBusiness.deletar(id, userid, isSoft);
      res.status(200).json(resultado);
    } catch (error: unknown) {
      if (error instanceof PlannedTransactionNotFoundError) {
        res.status(404).json({ erro: error.message, error: error.message });
        return;
      }
      if (error instanceof PlannedTransactionValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Erro ao excluir transação planejada.';
      res.status(500).json({ erro: message, error: message });
    }
  },
};

