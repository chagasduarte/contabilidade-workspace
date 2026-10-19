import { Request, Response } from 'express';
import { PlanejamentoBusiness } from './planejamento.business';

export const PlanejamentoController = {
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const planejamento = await PlanejamentoBusiness.criar(req.body, userid);
      res.status(201).json(planejamento);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar planejamento';
      res.status(400).json({ erro: message, error: message });
    }
  },

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const planejamento = await PlanejamentoBusiness.atualizar(id, req.body, userid);
      res.status(200).json(planejamento);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar planejamento';
      res.status(400).json({ erro: message, error: message });
    }
  },

  async deletar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      await PlanejamentoBusiness.deletar(id, userid);
      res.status(204).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao deletar planejamento';
      res.status(400).json({ erro: message, error: message });
    }
  },

  async listarAgrupado(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }
      const { mes, ano } = req.query as { mes?: string; ano?: string };

      const planejamentos = await PlanejamentoBusiness.listarAgrupado(mes, ano, userid);
      res.status(200).json(planejamentos);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao listar planejamentos agrupados';
      res.status(500).json({ erro: message, error: message });
    }
  },

  async listar(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }
      const { mes, ano } = req.query as { mes?: string; ano?: string };

      const planejamentos = await PlanejamentoBusiness.listar(mes, ano, userid);
      res.status(200).json(planejamentos);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao listar planejamentos';
      res.status(500).json({ erro: message, error: message });
    }
  },

  async buscar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const planejamento = await PlanejamentoBusiness.buscar(id, userid);
      res.status(200).json(planejamento);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Planejamento não encontrado';
      res.status(404).json({ erro: message, error: message });
    }
  },
};

