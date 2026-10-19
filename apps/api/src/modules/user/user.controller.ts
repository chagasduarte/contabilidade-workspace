import { Request, Response } from 'express';
import { UserBusiness } from './user.business';
import { ENV } from '../../core/config/env';

export const UserController = {
  async criar(req: Request, res: Response): Promise<void> {
    try {
      const user = req.body;
      if (!user.nome || !user.senha) {
        res.status(400).json({ erro: 'Nome e senha são obrigatórios' });
        return;
      }

      const resultado = await UserBusiness.criar(user, req.file);
      res.status(201).json(resultado);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar usuário';
      res.status(400).json({ erro: message });
    }
  },

  async uploadAvatar(req: Request, res: Response): Promise<void> {
    try {
      const userid = req.usuarioId;
      if (!userid) {
        res.status(401).json({ erro: 'Usuário não autenticado' });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ erro: 'Nenhum arquivo enviado' });
        return;
      }

      await UserBusiness.uploadAvatar(userid, file);
      res.status(200).json({ message: 'Avatar atualizado com sucesso' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar avatar';
      res.status(400).json({ erro: message });
    }
  },

  async getAvatar(req: Request, res: Response): Promise<void> {
    try {
      const paramId = req.params.id ? Number(req.params.id) : undefined;
      const targetUserId = paramId ?? req.usuarioId;

      if (!targetUserId) {
        res.status(200).json({ avatarUrl: `${ENV.BASE_URL}/uploads/noImage.png` });
        return;
      }

      if (req.usuarioId && paramId && req.usuarioId !== paramId) {
        res.status(403).json({ erro: 'Você não pode acessar essa informação' });
        return;
      }

      const resultado = await UserBusiness.getAvatar(targetUserId);
      if (!resultado?.avatar) {
        res.status(200).json({ avatarUrl: `${ENV.BASE_URL}/uploads/noImage.png` });
        return;
      }

      const avatarUrl = resultado.avatar.startsWith('http')
        ? resultado.avatar
        : `${ENV.BASE_URL}/${resultado.avatar}`;

      res.status(200).json({ avatarUrl });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao buscar avatar';
      res.status(400).json({ erro: message });
    }
  },
};

