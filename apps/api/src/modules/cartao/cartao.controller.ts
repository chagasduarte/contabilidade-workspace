import { Request, Response } from 'express';
import { CartaoBusiness } from './cartao.business';

export const CartaoController = {
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const cartao = req.body;
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const response = await CartaoBusiness.criar(cartao, userid);
      res.status(201).json(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar cartão';
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

      const response = await CartaoBusiness.listar(userid);
      res.status(200).json(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao listar cartões';
      res.status(400).json({ error: message, erro: message });
    }
  },
};

