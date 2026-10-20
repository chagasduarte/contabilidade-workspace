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

  async register(req: Request, res: Response): Promise<void> {
    try {
      const { nome, name, email, senha, password } = req.body;
      const finalNome = nome || name;
      const finalSenha = senha || password;

      if (!finalNome || !email || !finalSenha) {
        res.status(400).json({
          erro: 'Nome, e-mail e senha são obrigatórios',
          error: 'Nome, e-mail e senha são obrigatórios',
        });
        return;
      }

      const resultado = await AuthBusiness.register({
        nome: finalNome,
        email,
        senha: finalSenha,
      });

      res.status(201).json(resultado);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao cadastrar usuário';
      const statusCode =
        (error as { statusCode?: number })?.statusCode ||
        (message.includes('já está') ? 409 : 400);

      console.error('[AuthController.register]:', message);
      res.status(statusCode).json({ error: message, erro: message });
    }
  },

  async logout(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'Logout realizado com sucesso',
    });
  },
};
