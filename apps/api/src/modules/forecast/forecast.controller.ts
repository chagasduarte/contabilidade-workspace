// forecast.controller.ts
// Controller REST para o Motor de Projeção de Fluxo de Caixa

import { Request, Response } from 'express';
import { ForecastService } from './forecast.service';
import { ForecastQueryDto } from './forecast.dto';

export const ForecastController = {
  /**
   * GET /api/forecast
   * Retorna a projeção diária e mensal de fluxo de caixa com Safe to Spend e simulação de compra.
   */
  async getForecast(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.usuarioId;
      if (!userId) {
        res.status(401).json({ erro: 'Usuário não autenticado.' });
        return;
      }

      const query: ForecastQueryDto = {
        months: req.query['months'] ? parseInt(String(req.query['months']), 10) : 3,
        targetExpenseAmount: req.query['targetExpenseAmount']
          ? parseFloat(String(req.query['targetExpenseAmount']))
          : undefined,
        targetExpenseDate: req.query['targetExpenseDate']
          ? String(req.query['targetExpenseDate'])
          : undefined,
      };

      const resultado = await ForecastService.getForecast(userId, query);
      res.status(200).json(resultado);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro ao calcular projeção de fluxo de caixa.';
      res.status(500).json({ erro: message, error: message });
    }
  },
};

