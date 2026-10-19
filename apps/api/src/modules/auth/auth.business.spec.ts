import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthBusiness } from './auth.business';
import { UserRepository } from '../user/user.repository';
import bcrypt from 'bcryptjs';

vi.mock('../user/user.repository', () => ({
  UserRepository: {
    buscaPorNomeOuEmail: vi.fn(),
    buscaPorEmail: vi.fn(),
    buscaPorNome: vi.fn(),
    criar: vi.fn(),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    genSalt: vi.fn().mockResolvedValue('mock-salt' as never),
    hash: vi.fn().mockResolvedValue('mock-hash' as never),
  },
}));

describe('AuthBusiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
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

  describe('register', () => {
    it('deve lançar erro se nome for vazio ou curto', async () => {
      await expect(
        AuthBusiness.register({ nome: 'A', email: 'teste@exemplo.com', senha: 'senha' })
      ).rejects.toThrow('O nome deve conter pelo menos 2 caracteres');
    });

    it('deve lançar erro se email for inválido', async () => {
      await expect(
        AuthBusiness.register({ nome: 'Carlos', email: 'email-invalido', senha: 'senha' })
      ).rejects.toThrow('Informe um e-mail válido');
    });

    it('deve lançar erro se senha for curta', async () => {
      await expect(
        AuthBusiness.register({ nome: 'Carlos', email: 'carlos@exemplo.com', senha: '12' })
      ).rejects.toThrow('A senha deve conter pelo menos 4 caracteres');
    });

    it('deve lançar erro se email já estiver cadastrado', async () => {
      vi.mocked(UserRepository.buscaPorEmail).mockResolvedValueOnce({
        id: 1,
        nome: 'Outro',
        email: 'carlos@exemplo.com',
        senha_hash: 'hash',
      });

      await expect(
        AuthBusiness.register({ nome: 'Carlos', email: 'carlos@exemplo.com', senha: 'senha123' })
      ).rejects.toThrow('Este e-mail já está cadastrado');
    });

    it('deve lançar erro se nome de usuário já estiver em uso', async () => {
      vi.mocked(UserRepository.buscaPorEmail).mockResolvedValueOnce(undefined);
      vi.mocked(UserRepository.buscaPorNome).mockResolvedValueOnce({
        id: 1,
        nome: 'carlos',
        email: 'outro@exemplo.com',
        senha_hash: 'hash',
      });

      await expect(
        AuthBusiness.register({ nome: 'carlos', email: 'novo@exemplo.com', senha: 'senha123' })
      ).rejects.toThrow('Este nome de usuário já está em uso');
    });

    it('deve registrar com sucesso, criar usuário com hash e retornar token e dados', async () => {
      vi.mocked(UserRepository.buscaPorEmail).mockResolvedValueOnce(undefined);
      vi.mocked(UserRepository.buscaPorNome).mockResolvedValueOnce(undefined);
      vi.mocked(UserRepository.criar).mockResolvedValueOnce({
        id: 10,
        nome: 'Novo Usuario',
        email: 'novo@exemplo.com',
        senha_hash: 'mock-hash',
        avatar: null,
      });

      const result = await AuthBusiness.register({
        nome: 'Novo Usuario',
        email: 'novo@exemplo.com',
        senha: 'senha-segura-123',
      });

      expect(result.token).toBeDefined();
      expect(result.usuario.id).toBe(10);
      expect(result.usuario.nome).toBe('Novo Usuario');
      expect(result.usuario.email).toBe('novo@exemplo.com');
      expect(result.message).toBe('Usuário cadastrado com sucesso');
    });
  });
});

