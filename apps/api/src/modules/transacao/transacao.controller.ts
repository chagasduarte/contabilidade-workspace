import { Request, Response } from 'express';
import { TransacaoBusiness } from './transacao.business';
import { TransacaoNotFoundError } from './transacao.types';
import { responderPaginado } from '../../common/utils/paginacao';

export const TransacaoController = {
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const transacao = await TransacaoBusiness.criar(req.body, userid);
      res.status(201).json(transacao);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar transação';
      res.status(400).json({ erro: message, error: message });
    }
  },

  async criarParcelada(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const transacao = await TransacaoBusiness.criarParcelada(req.body, userid);
      res.status(201).json(transacao);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar parcelas';
      res.status(400).json({ erro: message, error: message });
    }
  },

  async listar(req: Request, res: Response): Promise<void> {
    try {
      const { mes, ano, cardId } = req.query as {
        mes?: string;
        ano?: string;
        cardId?: string;
      };
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const mesNum = mes ? parseInt(mes, 10) : null;
      const anoNum = ano ? parseInt(ano, 10) : null;

      const transacoes = await TransacaoBusiness.listar(mesNum, anoNum, userid, cardId);
      res.json(transacoes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao listar transações';
      res.status(500).json({ erro: message, error: message });
    }
  },

  async listarEntradas(req: Request, res: Response): Promise<void> {
    try {
      const { mes, ano } = req.query as { mes?: string; ano?: string };
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const mesNum = mes ? parseInt(mes, 10) : null;
      const anoNum = ano ? parseInt(ano, 10) : null;

      const transacoes = await TransacaoBusiness.listarEntradas(mesNum, anoNum, userid);
      res.json(transacoes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao listar entradas';
      res.status(500).json({ erro: message, error: message });
    }
  },

  async buscar(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      const transacao = await TransacaoBusiness.buscarPorId(req.params.id, userid);
      res.json(transacao);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Transação não encontrada';
      res.status(404).json({ erro: message, error: message });
    }
  },

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const transacao = await TransacaoBusiness.atualizar(req.params.id, req.body, userid);
      res.json(transacao);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar transação';
      // Inexistente ou de outro usuário -> 404; demais erros (validação) -> 400
      res.status(error instanceof TransacaoNotFoundError ? 404 : 400).json({ erro: message, error: message });
    }
  },

  async excluir(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      await TransacaoBusiness.excluir(req.params.id, userid);
      res.status(204).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao excluir transação';
      res.status(404).json({ erro: message, error: message });
    }
  },

  async listaDespesasParceladas(req: Request, res: Response): Promise<void> {
    try {
      const { mes, ano } = req.query as { mes?: string; ano?: string };
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const mesNum = mes ? parseInt(mes, 10) : null;
      const anoNum = ano ? parseInt(ano, 10) : null;

      const despesas = await TransacaoBusiness.listaDespesasParceladas(mesNum, anoNum, userid);
      res.json(despesas);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao listar despesas parceladas';
      res.status(404).json({ erro: message, error: message });
    }
  },

  async agrupamentoTipo(req: Request, res: Response): Promise<void> {
    try {
      const { mes, ano, tipo, status } = req.query as {
        mes?: string;
        ano?: string;
        tipo?: string;
        status?: string;
      };
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const mesNum = mes ? parseInt(mes, 10) : null;
      const anoNum = ano ? parseInt(ano, 10) : null;

      const agrupamento = await TransacaoBusiness.agrupamentoTipo(
        status || null,
        mesNum,
        anoNum,
        tipo || null,
        userid
      );
      res.json(agrupamento);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao agrupar por tipo';
      res.status(404).json({ erro: message, error: message });
    }
  },

  async receber(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      await TransacaoBusiness.uptopago(id, userid);
      res.status(200).json('ok');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao marcar como pago';
      res.status(404).json({ erro: message, error: message });
    }
  },

  async listaDespesa(req: Request, res: Response): Promise<void> {
    try {
      const { descricao } = req.query as { descricao?: string };
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const result = await TransacaoBusiness.listaDespesa(descricao || '', userid);
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao listar despesas';
      res.status(404).json({ erro: message, error: message });
    }
  },

  async linhaTemporal(req: Request, res: Response): Promise<void> {
    try {
      const { ano } = req.query as { ano?: string };
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const result = await TransacaoBusiness.linhaTemporal(ano || new Date().getFullYear(), userid);
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao buscar linha temporal';
      res.status(404).json({ erro: message, error: message });
    }
  },

  async buscaPorDia(req: Request, res: Response): Promise<void> {
    try {
      const { dia, mes, ano } = req.query as {
        dia?: string;
        mes?: string;
        ano?: string;
      };
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const result = await TransacaoBusiness.buscaPorDia(
        dia || '1',
        mes || String(new Date().getMonth() + 1),
        ano || String(new Date().getFullYear()),
        userid
      );
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao buscar por dia';
      res.status(404).json({ erro: message, error: message });
    }
  },

  async saveNewUser(req: Request, res: Response): Promise<void> {
    try {
      const { entradas, saidas } = req.body;
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const result = await TransacaoBusiness.saveNewuser({ entradas, saidas }, userid);
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao inicializar transações do usuário';
      res.status(404).json({ erro: message, error: message });
    }
  },

  async extrato(req: Request, res: Response): Promise<void> {
    try {
      const { limit, mes, ano, cursor, paginado } = req.query as {
        limit?: string;
        mes?: string;
        ano?: string;
        cursor?: string;
        paginado?: string;
      };
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      // ?cursor implica paginado (mesma regra de lerPaginacao em planned-transactions e loans)
      const querPaginado = paginado === 'true' || paginado === '1' || Boolean(cursor);
      const { items, next_cursor, totais } = await TransacaoBusiness.extrato(
        { limit, mes, ano, cursor, paginado: querPaginado },
        userid
      );

      // Retrocompatível: sem ?paginado=true continua devolvendo o array; o cursor vai no header
      responderPaginado(res, items, next_cursor, querPaginado, totais ? { totais } : {});
    } catch (erro: unknown) {
      const message = erro instanceof Error ? erro.message : 'Erro ao gerar extrato';
      res.status(400).json({ erro: message, error: message });
    }
  },
};

