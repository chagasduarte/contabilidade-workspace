import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthBusiness } from './auth.business';
import { UserRepository } from '../user/user.repository';
import bcrypt from 'bcryptjs';

vi.mock('../user/user.repository', () => ({
  UserRepository: {
    buscaPorNomeOuEmail: vi.fn(),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

describe('AuthBusiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve lançar erro se credenciais forem vazias', async () => {
    await expect(AuthBusiness.login('', '')).rejects.toThrow(
      'Nome/email e senha são obrigatórios'
    );
  });

  it('deve lançar erro se usuário não for encontrado', async () => {
    vi.mocked(UserRepository.buscaPorNomeOuEmail).mockResolvedValueOnce(undefined);

    await expect(AuthBusiness.login('usuario_inexistente', '123456')).rejects.toThrow(
      'Usuário não encontrado'
    );
  });

  it('deve lançar erro se a senha estiver incorreta', async () => {
    vi.mocked(UserRepository.buscaPorNomeOuEmail).mockResolvedValueOnce({
      id: 1,
      nome: 'Teste',
      email: 'teste@exemplo.com',
      senha_hash: 'hash_invalido',
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

    await expect(AuthBusiness.login('teste@exemplo.com', 'senha_errada')).rejects.toThrow(
      'Senha incorreta'
    );
  });

  it('deve autenticar e retornar token JWT e dados do usuário quando a senha for válida', async () => {
    vi.mocked(UserRepository.buscaPorNomeOuEmail).mockResolvedValueOnce({
      id: 1,
      nome: 'Carlos',
      email: 'carlos@exemplo.com',
      senha_hash: 'hash_valido',
      avatar: 'uploads/carlos.png',
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

    const result = await AuthBusiness.login('carlos@exemplo.com', 'senha123');

    expect(result.token).toBeDefined();
    expect(result.usuario.id).toBe(1);
    expect(result.usuario.nome).toBe('Carlos');
    expect(result.usuario.email).toBe('carlos@exemplo.com');
  });
});

