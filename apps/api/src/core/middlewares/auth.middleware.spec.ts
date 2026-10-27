import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authMiddleware } from './auth.middleware';
import { UserRepository } from '../../modules/user/user.repository';
import { ENV } from '../config/env';

vi.mock('../../modules/user/user.repository', () => ({
  UserRepository: { buscaPorId: vi.fn() },
}));

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sem header → 401', async () => {
    const res = mockRes();
    const next = vi.fn();
    await authMiddleware({ headers: {} } as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('token inválido ou expirado → 401 (403 fica para proibição de negócio)', async () => {
    const expirado = jwt.sign({ id: 1 }, ENV.JWT_SECRET, { expiresIn: -10 });
    for (const token of ['lixo', expirado, jwt.sign({ id: 1 }, 'outra-chave')]) {
      const res = mockRes();
      await authMiddleware({ headers: { authorization: `Bearer ${token}` } } as never, res as never, vi.fn());
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ erro: 'Token inválido ou expirado' });
    }
  });

  it('token válido de usuário existente segue com usuarioId', async () => {
    vi.mocked(UserRepository.buscaPorId).mockResolvedValueOnce({ id: 7, nome: 'a', senha_hash: 'x' });
    const req = { headers: { authorization: `Bearer ${jwt.sign({ id: 7 }, ENV.JWT_SECRET)}` } } as never as { usuarioId?: number };
    const next = vi.fn();

    await authMiddleware(req as never, mockRes() as never, next);

    expect(next).toHaveBeenCalled();
    expect(req.usuarioId).toBe(7);
  });
});
