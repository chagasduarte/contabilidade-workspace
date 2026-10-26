import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserBusiness } from './user.business';
import { UserRepository } from './user.repository';

vi.mock('./user.repository', () => ({
  UserRepository: {
    buscaPorNome: vi.fn(),
    buscaPorEmail: vi.fn(),
    atualizarPerfil: vi.fn(),
  },
}));

const eu = { id: 7, nome: 'Ana', email: 'ana@x.com', senha_hash: 'h', avatar: null };
const statusDe = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return (e as { statusCode?: number }).statusCode;
  }
};

describe('UserBusiness.atualizarPerfil (PUT /user/me)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(UserRepository.buscaPorNome).mockResolvedValue(undefined);
    vi.mocked(UserRepository.buscaPorEmail).mockResolvedValue(undefined);
  });

  it('atualiza nome e email normalizados e não devolve senha_hash', async () => {
    vi.mocked(UserRepository.atualizarPerfil).mockResolvedValueOnce({ ...eu, nome: 'Ana Maria', email: 'ana.m@x.com' });

    const res = await UserBusiness.atualizarPerfil(7, { nome: '  Ana Maria ', email: ' Ana.M@X.com ' });

    expect(UserRepository.atualizarPerfil).toHaveBeenCalledWith(7, { nome: 'Ana Maria', email: 'ana.m@x.com' });
    expect(res).toEqual({ id: 7, nome: 'Ana Maria', email: 'ana.m@x.com', avatar: null });
  });

  it('nome ou email já usados por OUTRO usuário -> 409', async () => {
    vi.mocked(UserRepository.buscaPorNome).mockResolvedValueOnce({ ...eu, id: 8 });
    expect(await statusDe(UserBusiness.atualizarPerfil(7, { nome: 'Bia' }))).toBe(409);

    vi.mocked(UserRepository.buscaPorEmail).mockResolvedValueOnce({ ...eu, id: 8 });
    expect(await statusDe(UserBusiness.atualizarPerfil(7, { email: 'bia@x.com' }))).toBe(409);
    expect(UserRepository.atualizarPerfil).not.toHaveBeenCalled();
  });

  it('manter o próprio nome/email (só mudando maiúsculas) não é conflito', async () => {
    vi.mocked(UserRepository.buscaPorNome).mockResolvedValueOnce(eu);
    vi.mocked(UserRepository.atualizarPerfil).mockResolvedValueOnce({ ...eu, nome: 'ANA' });
    expect(await statusDe(UserBusiness.atualizarPerfil(7, { nome: 'ANA' }))).toBe('ok');
  });

  it('corrida: violação do índice único (23505) também vira 409', async () => {
    vi.mocked(UserRepository.atualizarPerfil).mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    expect(await statusDe(UserBusiness.atualizarPerfil(7, { email: 'novo@x.com' }))).toBe(409);
  });

  it.each([
    [{ nome: 'A' }],
    [{ email: 'sem-arroba' }],
    [{}],
  ])('dados inválidos %o -> 400', async (dados) => {
    expect(await statusDe(UserBusiness.atualizarPerfil(7, dados))).toBe(400);
  });
});
