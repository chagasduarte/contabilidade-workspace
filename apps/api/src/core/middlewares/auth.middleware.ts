import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { UserRepository } from '../../modules/user/user.repository';

interface TokenPayload {
  id: number;
  nome?: string;
  email?: string;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ erro: 'Token não informado' });
    return;
  }

  const parts = authHeader.split(' ');
  const token = parts.length === 2 ? parts[1] : parts[0];

  if (!token) {
    res.status(401).json({ erro: 'Token inválido ou ausente' });
    return;
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as TokenPayload;
    const user = await UserRepository.buscaPorId(decoded.id);

    if (!user) {
      res.status(401).json({ erro: 'Usuário não encontrado' });
      return;
    }

    req.usuarioId = decoded.id;
    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Token inválido ou expirado';
    console.error('Erro ao verificar token:', message);
    res.status(403).json({ erro: 'Token inválido ou expirado' });
  }
}

