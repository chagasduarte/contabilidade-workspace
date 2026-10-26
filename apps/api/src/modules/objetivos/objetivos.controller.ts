import { Request, Response } from 'express';
import { ObjetivosBusiness } from './objetivos.business';
import { ObjetivoNotFoundError, ObjetivoValidationError } from './objetivos.types';

function usuarioAutenticado(req: Request, res: Response): number | undefined {
  const userid = req.usuarioId;
  if (!userid) {
    res.status(401).json({ erro: 'Usuário não autenticado' });
  }
  return userid;
}

/** 400 validação, 404 inexistente/de outro usuário, 500 genérico (sem mensagem do banco). */
function responderErro(res: Response, error: unknown, fallback: string): void {
  if (error instanceof ObjetivoValidationError || error instanceof ObjetivoNotFoundError) {
    const status = error instanceof ObjetivoValidationError ? 400 : 404;
    res.status(status).json({ erro: error.message, error: error.message });
    return;
  }
  console.error('[ObjetivosController]', error);
  res.status(500).json({ erro: fallback, error: fallback });
}

export const ObjetivosController = {
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;
      res.status(201).json(await ObjetivosBusiness.criar(req.body, userid));
    } catch (error: unknown) {
      responderErro(res, error, 'Erro ao criar objetivo');
    }
  },

  async listar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;
      res.status(200).json(await ObjetivosBusiness.listar(userid));
    } catch (error: unknown) {
      responderErro(res, error, 'Erro ao listar objetivos');
    }
  },

  async buscar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;
      res.status(200).json(await ObjetivosBusiness.buscar(req.params.id, userid));
    } catch (error: unknown) {
      responderErro(res, error, 'Erro ao buscar objetivo');
    }
  },

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;
      res.status(200).json(await ObjetivosBusiness.atualizar(req.params.id, req.body, userid));
    } catch (error: unknown) {
      responderErro(res, error, 'Erro ao atualizar objetivo');
    }
  },

  /** POST /objetivos/:id/aportes { valor } — soma atômica ao valor acumulado. */
  async aportar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;
      res.status(200).json(await ObjetivosBusiness.aportar(req.params.id, req.body, userid));
    } catch (error: unknown) {
      responderErro(res, error, 'Erro ao registrar aporte');
    }
  },

  async deletar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;
      await ObjetivosBusiness.deletar(req.params.id, userid);
      res.status(204).send();
    } catch (error: unknown) {
      responderErro(res, error, 'Erro ao excluir objetivo');
    }
  },
};
