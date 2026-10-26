import { Request, Response } from 'express';
import { AiBusiness } from './ai.business';
import { AiError } from './ai.types';

export const AiController = {
  async processMessage(req: Request, res: Response): Promise<void> {
    try {
      const { message, base64Image } = req.body ?? {};
      const response = await AiBusiness.processMessage(message, base64Image);
      res.status(200).json(response);
    } catch (error: unknown) {
      if (error instanceof AiError) {
        res.status(error.status).json({ erro: error.message, error: error.message, codigo: error.codigo });
        return;
      }
      // Falha inesperada: registra o detalhe, responde mensagem genérica
      console.error('Erro no processamento da IA:', error);
      const message = 'Erro interno ao processar a mensagem com a IA.';
      res.status(500).json({ erro: message, error: message, codigo: 'IA_INDISPONIVEL' });
    }
  },
};
