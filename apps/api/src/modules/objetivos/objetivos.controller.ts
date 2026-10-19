import { Request, Response } from 'express';
import { ObjetivosBusiness } from './objetivos.business';

export const ObjetivosController = {
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const objetivo = req.body;
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const response = await ObjetivosBusiness.criar(objetivo, userid);
      res.status(201).json(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar objetivo';
      res.status(400).json({ error: message, erro: message });
    }
  },

  async listar(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const response = await ObjetivosBusiness.listar(userid);
      res.status(200).json(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao listar objetivos';
      res.status(400).json({ error: message, erro: message });
    }
  },
};

