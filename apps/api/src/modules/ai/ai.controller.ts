import { Request, Response } from 'express';
import { AiBusiness } from './ai.business';

export const AiController = {
  async processMessage(req: Request, res: Response): Promise<void> {
    try {
      const { message, base64Image } = req.body;

      if (!message) {
        res.status(400).json({ erro: 'A mensagem é obrigatória.' });
        return;
      }

      const response = await AiBusiness.processMessage(message, base64Image);
      res.status(200).json(response);
    } catch (error: unknown) {
      console.error('Erro no processamento da IA:', error);
      const message = error instanceof Error ? error.message : 'Erro interno ao processar a mensagem com a IA.';
      res.status(500).json({ erro: message, error: message });
    }
  },
};

