import { Request, Response } from 'express';
import { PlanejamentoBusiness } from './planejamento.business';
import { PlanejamentoNotFoundError, PlanejamentoValidationError } from './planejamento.types';

function usuarioAutenticado(req: Request, res: Response): number | undefined {
  const userid = req.usuarioId;
  if (!userid) {
    res.status(401).json({ erro: 'Usuário não autenticado' });
  }
  return userid;
}

/** 400 validação, 404 inexistente/de outro usuário, 500 genérico (sem mensagem do banco). */
function responderErro(res: Response, error: unknown, fallback: string): void {
  if (error instanceof PlanejamentoValidationError || error instanceof PlanejamentoNotFoundError) {
    const status = error instanceof PlanejamentoValidationError ? 400 : 404;
    res.status(status).json({ erro: error.message, error: error.message });
    return;
  }
  console.error('[PlanejamentoController]', error);
  res.status(500).json({ erro: fallback, error: fallback });
}

export const PlanejamentoController = {
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;
      res.status(201).json(await PlanejamentoBusiness.criar(req.body, userid));
    } catch (error: unknown) {
      responderErro(res, error, 'Erro ao criar planejamento');
    }
  },

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;
      res.status(200).json(await PlanejamentoBusiness.atualizar(req.params.id, req.body, userid));
    } catch (error: unknown) {
      responderErro(res, error, 'Erro ao atualizar planejamento');
    }
  },

  async deletar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;
      await PlanejamentoBusiness.deletar(req.params.id, userid);
      res.status(204).send();
    } catch (error: unknown) {
      responderErro(res, error, 'Erro ao deletar planejamento');
    }
  },

  async listarAgrupado(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;
      res.status(200).json(await PlanejamentoBusiness.listarAgrupado(req.query.mes, req.query.ano, userid));
    } catch (error: unknown) {
      responderErro(res, error, 'Erro ao listar planejamentos agrupados');
    }
  },

  async listar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;
      res.status(200).json(await PlanejamentoBusiness.listar(req.query.mes, req.query.ano, userid));
    } catch (error: unknown) {
      responderErro(res, error, 'Erro ao listar planejamentos');
    }
  },

  async buscar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;
      res.status(200).json(await PlanejamentoBusiness.buscar(req.params.id, userid));
    } catch (error: unknown) {
      responderErro(res, error, 'Erro ao buscar planejamento');
    }
  },

  /** GET /planejamento/resumo?mes&ano&tipo — planejado x realizado por categoria. */
  async resumo(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;
      res.status(200).json(await PlanejamentoBusiness.resumo(req.query.mes, req.query.ano, req.query.tipo, userid));
    } catch (error: unknown) {
      responderErro(res, error, 'Erro ao gerar resumo do planejamento');
    }
  },
};
