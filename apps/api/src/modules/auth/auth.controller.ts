import { Request, Response } from 'express';
import { AuthBusiness } from './auth.business';

export const AuthController = {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { nome, email, senha } = req.body;
      const identificador = nome || email;

      if (!identificador || !senha) {
        res.status(400).json({ erro: 'Nome e senha são obrigatórios' });
        return;
      }

      const resultado = await AuthBusiness.login(identificador, senha);
      res.status(200).json(resultado);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro na autenticação';
      console.error('[AuthController.login]:', message);
      res.status(401).json({ error: message, erro: message });
    }
  },
};
