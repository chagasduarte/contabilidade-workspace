import { Request, Response } from 'express';
import { sendError } from '../../common/utils/error-response';
import { CategoriaBusiness } from './categoria.business';
import { TipoCategoria } from './categoria.types';

export const CategoriaController = {
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const categoria = req.body;
      const response = await CategoriaBusiness.criar(categoria);
      res.status(201).json(response);
    } catch (error: unknown) {
      console.error('[CategoriaController]', error);
      sendError(res, error, 'Erro ao criar categoria');
    }
  },

  async listar(req: Request, res: Response): Promise<void> {
    try {
      const tipo = req.query.tipo as TipoCategoria | undefined;
      const response = await CategoriaBusiness.listar(tipo);
      res.status(200).json(response);
    } catch (error: unknown) {
      console.error('[CategoriaController]', error);
      sendError(res, error, 'Erro ao listar categorias');
    }
  },

  async buscar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const response = await CategoriaBusiness.buscar(id);

      if (!response) {
        res.status(404).json({ error: 'Categoria não encontrada', erro: 'Categoria não encontrada' });
        return;
      }

      res.status(200).json(response);
    } catch (error: unknown) {
      console.error('[CategoriaController]', error);
      sendError(res, error, 'Erro ao buscar categoria');
    }
  },

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const dto = req.body;
      const response = await CategoriaBusiness.atualizar(id, dto);

      if (!response) {
        res.status(404).json({ error: 'Categoria não encontrada', erro: 'Categoria não encontrada' });
        return;
      }

      res.status(200).json(response);
    } catch (error: unknown) {
      console.error('[CategoriaController]', error);
      sendError(res, error, 'Erro ao atualizar categoria');
    }
  },

  async deletar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const response = await CategoriaBusiness.deletar(id);

      if (!response) {
        res.status(404).json({ error: 'Categoria não encontrada', erro: 'Categoria não encontrada' });
        return;
      }

      res.status(200).json(response);
    } catch (error: unknown) {
      console.error('[CategoriaController]', error);
      sendError(res, error, 'Erro ao deletar categoria');
    }
  },
};


