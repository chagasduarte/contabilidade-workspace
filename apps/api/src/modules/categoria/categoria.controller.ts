import { Request, Response } from 'express';
import { CategoriaBusiness } from './categoria.business';
import {
  CategoriaConflictError,
  CategoriaForbiddenError,
  CategoriaNotFoundError,
  CategoriaValidationError,
  TipoCategoria,
} from './categoria.types';

/**
 * Traduz erros de categoria/subcategoria em status HTTP:
 * 400 validação, 403 categoria global, 404 inexistente/de outro usuário, 409 nome duplicado.
 */
export function responderErroCategoria(res: Response, error: unknown, fallback: string, contexto: string): void {
  const status =
    error instanceof CategoriaValidationError
      ? 400
      : error instanceof CategoriaForbiddenError
      ? 403
      : error instanceof CategoriaNotFoundError
      ? 404
      : error instanceof CategoriaConflictError
      ? 409
      : 500;

  if (status === 500) {
    console.error(`[${contexto}]`, error);
    // Não expõe mensagem crua do banco ao cliente
    res.status(500).json({ error: fallback, erro: fallback });
    return;
  }

  const message = (error as Error).message;
  res.status(status).json({ error: message, erro: message });
}

function usuarioAutenticado(req: Request, res: Response): number | undefined {
  const userid = req.usuarioId;
  if (!userid) {
    res.status(401).json({ erro: 'Usuário não autenticado' });
  }
  return userid;
}

export const CategoriaController = {
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;

      const response = await CategoriaBusiness.criar(req.body, userid);
      res.status(201).json(response);
    } catch (error: unknown) {
      responderErroCategoria(res, error, 'Erro ao criar categoria', 'CategoriaController');
    }
  },

  async listar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;

      const tipo = req.query.tipo as TipoCategoria | undefined;
      const response = await CategoriaBusiness.listar(userid, tipo);
      res.status(200).json(response);
    } catch (error: unknown) {
      responderErroCategoria(res, error, 'Erro ao listar categorias', 'CategoriaController');
    }
  },

  async buscar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;

      const response = await CategoriaBusiness.buscar(req.params.id, userid);
      if (!response) {
        res.status(404).json({ error: 'Categoria não encontrada', erro: 'Categoria não encontrada' });
        return;
      }

      res.status(200).json(response);
    } catch (error: unknown) {
      responderErroCategoria(res, error, 'Erro ao buscar categoria', 'CategoriaController');
    }
  },

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;

      const response = await CategoriaBusiness.atualizar(req.params.id, req.body, userid);
      res.status(200).json(response);
    } catch (error: unknown) {
      responderErroCategoria(res, error, 'Erro ao atualizar categoria', 'CategoriaController');
    }
  },

  async deletar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;

      const response = await CategoriaBusiness.deletar(req.params.id, userid);
      res.status(200).json(response);
    } catch (error: unknown) {
      responderErroCategoria(res, error, 'Erro ao deletar categoria', 'CategoriaController');
    }
  },
};
