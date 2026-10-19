import { Request, Response } from 'express';
import { SubcategoriaBusiness } from './subcategoria.business';

export const SubcategoriaController = {
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const subcategoria = req.body;
      const response = await SubcategoriaBusiness.criar(subcategoria);
      res.status(201).json(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar subcategoria';
      res.status(400).json({ error: message, erro: message });
    }
  },

  async listar(_req: Request, res: Response): Promise<void> {
    try {
      const response = await SubcategoriaBusiness.listar();
      res.status(200).json(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao listar subcategorias';
      res.status(400).json({ error: message, erro: message });
    }
  },

  async listarPorCategoria(req: Request, res: Response): Promise<void> {
    try {
      const { idcategoria } = req.params;
      const response = await SubcategoriaBusiness.listarPorCategoria(idcategoria);
      res.status(200).json(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao listar subcategorias por categoria';
      res.status(400).json({ error: message, erro: message });
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
      const message = error instanceof Error ? error.message : 'Erro ao buscar subcategoria';
      res.status(400).json({ error: message, erro: message });
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
      const message = error instanceof Error ? error.message : 'Erro ao deletar subcategoria';
      res.status(400).json({ error: message, erro: message });
    }
  },
};

