import { Request, Response } from 'express';
import { sendError } from '../../common/utils/error-response';
import { SubcategoriaBusiness } from './subcategoria.business';

export const SubcategoriaController = {
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const subcategoria = req.body;
      const response = await SubcategoriaBusiness.criar(subcategoria);
      res.status(201).json(response);
    } catch (error: unknown) {
      console.error('[SubcategoriaController]', error);
      sendError(res, error, 'Erro ao criar subcategoria');
    }
  },

  async listar(_req: Request, res: Response): Promise<void> {
    try {
      const response = await SubcategoriaBusiness.listar();
      res.status(200).json(response);
    } catch (error: unknown) {
      console.error('[SubcategoriaController]', error);
      sendError(res, error, 'Erro ao listar subcategorias');
    }
  },

  async listarPorCategoria(req: Request, res: Response): Promise<void> {
    try {
      const { idcategoria } = req.params;
      const response = await SubcategoriaBusiness.listarPorCategoria(idcategoria);
      res.status(200).json(response);
    } catch (error: unknown) {
      console.error('[SubcategoriaController]', error);
      sendError(res, error, 'Erro ao listar subcategorias por categoria');
    }
  },

  async buscar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const response = await SubcategoriaBusiness.buscar(id);

      if (!response) {
        res.status(404).json({ error: 'Subcategoria não encontrada', erro: 'Subcategoria não encontrada' });
        return;
      }

      res.status(200).json(response);
    } catch (error: unknown) {
      console.error('[SubcategoriaController]', error);
      sendError(res, error, 'Erro ao buscar subcategoria');
    }
  },

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const dto = req.body;
      const response = await SubcategoriaBusiness.atualizar(id, dto);

      if (!response) {
        res.status(404).json({ error: 'Subcategoria não encontrada', erro: 'Subcategoria não encontrada' });
        return;
      }

      res.status(200).json(response);
    } catch (error: unknown) {
      console.error('[SubcategoriaController]', error);
      sendError(res, error, 'Erro ao atualizar subcategoria');
    }
  },

  async deletar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const response = await SubcategoriaBusiness.deletar(id);

      if (!response) {
        res.status(404).json({ error: 'Subcategoria não encontrada', erro: 'Subcategoria não encontrada' });
        return;
      }

      res.status(200).json(response);
    } catch (error: unknown) {
      console.error('[SubcategoriaController]', error);
      sendError(res, error, 'Erro ao deletar subcategoria');
    }
  },
};

