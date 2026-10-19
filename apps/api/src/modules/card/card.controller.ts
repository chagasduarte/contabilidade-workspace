// card.controller.ts

import { Request, Response } from 'express';
import {
  CardBusiness,
  CardValidationError,
  CardNotFoundError,
  InvoiceNotFoundError,
} from './card.business';
import { CreateCardDto, CreateTransactionDto, PayInvoiceDto } from './card.dto';

export const CardController = {
  /**
   * POST /cards
   * Cadastra um novo cartão de crédito para o usuário autenticado.
   */
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.usuarioId;
      if (!usuarioId) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const dto: CreateCardDto = {
        nome: req.body.nome,
        bandeira: req.body.bandeira,
        limite_total: Number(req.body.limite_total),
        dia_fechamento: Number(req.body.dia_fechamento),
        dia_vencimento: Number(req.body.dia_vencimento),
        cor_identificacao: req.body.cor_identificacao,
      };

      const resultado = await CardBusiness.criarCartao(dto, usuarioId);
      res.status(201).json(resultado);
    } catch (error: unknown) {
      if (error instanceof CardValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Erro ao cadastrar cartão.';
      res.status(500).json({ erro: message, error: message });
    }
  },

  /**
   * GET /cards
   * Lista todos os cartões do usuário com limite total, comprometido e disponível.
   */
  async listar(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.usuarioId;
      if (!usuarioId) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const cartoes = await CardBusiness.listarCartoes(usuarioId);
      res.status(200).json(cartoes);
    } catch (error: unknown) {
      if (error instanceof CardValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Erro ao listar cartões.';
      res.status(500).json({ erro: message, error: message });
    }
  },

  /**
   * GET /cards/:id
   * Retorna os detalhes de um cartão específico incluindo seus limites e faturas.
   */
  async obterPorId(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.usuarioId;
      if (!usuarioId) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const { id } = req.params;
      const resultado = await CardBusiness.obterDetalhesCartao(id, usuarioId);
      res.status(200).json(resultado);
    } catch (error: unknown) {
      if (error instanceof CardNotFoundError) {
        res.status(404).json({ erro: error.message, error: error.message });
        return;
      }
      if (error instanceof CardValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Erro ao buscar cartão.';
      res.status(500).json({ erro: message, error: message });
    }
  },

  /**
   * GET /cards/:id/faturas
   * Lista faturas do cartão (com suporte a filtro opcional por ano).
   */
  async listarFaturas(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.usuarioId;
      if (!usuarioId) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const { id } = req.params;
      const ano = req.query['ano'] ? parseInt(String(req.query['ano']), 10) : undefined;

      const faturas = await CardBusiness.listarFaturasCartao(id, usuarioId, ano);
      res.status(200).json(faturas);
    } catch (error: unknown) {
      if (error instanceof CardNotFoundError) {
        res.status(404).json({ erro: error.message, error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Erro ao listar faturas.';
      res.status(500).json({ erro: message, error: message });
    }
  },

  /**
   * GET /cards/faturas/:faturaId
   * Detalhes de uma fatura com seus lançamentos (`invoice_items`).
   */
  async obterFatura(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.usuarioId;
      if (!usuarioId) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const { faturaId } = req.params;
      const resultado = await CardBusiness.obterDetalhesFatura(faturaId, usuarioId);
      res.status(200).json(resultado);
    } catch (error: unknown) {
      if (error instanceof InvoiceNotFoundError || error instanceof CardNotFoundError) {
        res.status(404).json({ erro: error.message, error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Erro ao obter fatura.';
      res.status(500).json({ erro: message, error: message });
    }
  },

  /**
   * POST /cards/transacoes
   * Lança nova compra (à vista ou parcelada) com decomposição automática em faturas.
   */
  async lancarTransacao(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.usuarioId;
      if (!usuarioId) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const dto: CreateTransactionDto = {
        cartao_id: req.body.cartao_id,
        descricao: req.body.descricao,
        valor_total: Number(req.body.valor_total),
        quantidade_parcelas: Number(req.body.quantidade_parcelas || 1),
        data_compra: req.body.data_compra || new Date(),
        categoria_id: req.body.categoria_id ? Number(req.body.categoria_id) : undefined,
      };

      const resultado = await CardBusiness.lancarTransacao(dto, usuarioId);
      res.status(201).json(resultado);
    } catch (error: unknown) {
      if (error instanceof CardValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      if (error instanceof CardNotFoundError) {
        res.status(404).json({ erro: error.message, error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Erro ao lançar transação no cartão.';
      res.status(500).json({ erro: message, error: message });
    }
  },

  /**
   * POST /cards/faturas/:faturaId/pagar
   * Liquida fatura, atualizando status para 'PAID' e recompondo o limite disponível.
   */
  async pagarFatura(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.usuarioId;
      if (!usuarioId) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const { faturaId } = req.params;
      const dto: PayInvoiceDto = {
        fatura_id: faturaId,
        valor_pago: req.body.valor_pago ? Number(req.body.valor_pago) : undefined,
        data_pagamento: req.body.data_pagamento,
      };

      const resultado = await CardBusiness.pagarFatura(faturaId, usuarioId, dto);
      res.status(200).json(resultado);
    } catch (error: unknown) {
      if (error instanceof CardValidationError) {
        res.status(400).json({ erro: error.message, error: error.message });
        return;
      }
      if (error instanceof InvoiceNotFoundError || error instanceof CardNotFoundError) {
        res.status(404).json({ erro: error.message, error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Erro ao pagar fatura.';
      res.status(500).json({ erro: message, error: message });
    }
  },
};

