import { Request, Response } from 'express';
import { SubcategoriaBusiness } from './subcategoria.business';
import { responderErroCategoria } from '../categoria/categoria.controller';

function usuarioAutenticado(req: Request, res: Response): number | undefined {
  const userid = req.usuarioId;
  if (!userid) {
    res.status(401).json({ erro: 'Usuário não autenticado' });
  }
  return userid;
}

export const SubcategoriaController = {
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;

      const response = await SubcategoriaBusiness.criar(req.body, userid);
      res.status(201).json(response);
    } catch (error: unknown) {
      responderErroCategoria(res, error, 'Erro ao criar subcategoria', 'SubcategoriaController');
    }
  },

  async listar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;

      const response = await SubcategoriaBusiness.listar(userid);
      res.status(200).json(response);
    } catch (error: unknown) {
      responderErroCategoria(res, error, 'Erro ao listar subcategorias', 'SubcategoriaController');
    }
  },

  async listarPorCategoria(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;

      const response = await SubcategoriaBusiness.listarPorCategoria(req.params.idcategoria, userid);
      res.status(200).json(response);
    } catch (error: unknown) {
      responderErroCategoria(res, error, 'Erro ao listar subcategorias por categoria', 'SubcategoriaController');
    }
  },

  async buscar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;

      const response = await SubcategoriaBusiness.buscar(req.params.id, userid);
      if (!response) {
        res.status(404).json({ error: 'Subcategoria não encontrada', erro: 'Subcategoria não encontrada' });
        return;
      }

      res.status(200).json(response);
    } catch (error: unknown) {
      responderErroCategoria(res, error, 'Erro ao buscar subcategoria', 'SubcategoriaController');
    }
  },

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;

      const response = await SubcategoriaBusiness.atualizar(req.params.id, req.body, userid);
      res.status(200).json(response);
    } catch (error: unknown) {
      responderErroCategoria(res, error, 'Erro ao atualizar subcategoria', 'SubcategoriaController');
    }
  },

  async deletar(req: Request, res: Response): Promise<void> {
    try {
      const userid = usuarioAutenticado(req, res);
      if (!userid) return;

      const response = await SubcategoriaBusiness.deletar(req.params.id, userid);
      res.status(200).json(response);
    } catch (error: unknown) {
      responderErroCategoria(res, error, 'Erro ao deletar subcategoria', 'SubcategoriaController');
    }
  },
};
