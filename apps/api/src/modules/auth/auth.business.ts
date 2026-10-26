import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../user/user.repository';
import { ENV } from '../../core/config/env';
import { AuthResponseDto, RegisterDto } from './auth.types';

const CREDENCIAIS_INVALIDAS = 'Usuário ou senha inválidos';

export const AuthBusiness = {
  async login(identificador: string, senha: string): Promise<AuthResponseDto> {
    if (!identificador || !senha) {
      throw new Error('Nome/email e senha são obrigatórios');
    }

    // Mensagem única para usuário inexistente ou senha errada (evita enumeração de usuários)
    const usuario = await UserRepository.buscaPorNomeOuEmail(identificador);
    if (!usuario) {
      throw new Error(CREDENCIAIS_INVALIDAS);
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
      throw new Error(CREDENCIAIS_INVALIDAS);
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
      },
      ENV.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return {
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        avatar: usuario.avatar,
      },
    };
  },

  async register(dados: RegisterDto): Promise<AuthResponseDto> {
    const nome = dados?.nome?.trim();
    const email = dados?.email?.trim().toLowerCase();
    const senha = dados?.senha;

    if (!nome || nome.length < 2) {
      const err = new Error('O nome deve conter pelo menos 2 caracteres');
      (err as unknown as { statusCode: number }).statusCode = 400;
      throw err;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const err = new Error('Informe um e-mail válido');
      (err as unknown as { statusCode: number }).statusCode = 400;
      throw err;
    }

    if (!senha || senha.length < 4) {
      const err = new Error('A senha deve conter pelo menos 4 caracteres');
      (err as unknown as { statusCode: number }).statusCode = 400;
      throw err;
    }

    // Validação de unicidade de e-mail
    const usuarioPorEmail = await UserRepository.buscaPorEmail(email);
    if (usuarioPorEmail) {
      const err = new Error('Este e-mail já está cadastrado');
      (err as unknown as { statusCode: number }).statusCode = 409;
      throw err;
    }

    // Validação de unicidade de nome de usuário
    const usuarioPorNome = await UserRepository.buscaPorNome(nome);
    if (usuarioPorNome) {
      const err = new Error('Este nome de usuário já está em uso');
      (err as unknown as { statusCode: number }).statusCode = 409;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const senha_hash = await bcrypt.hash(senha, salt);

    const novoUsuario = await UserRepository.criar({
      nome,
      email,
      senha_hash,
      avatar: null,
    });

    const token = jwt.sign(
      {
        id: novoUsuario.id,
        nome: novoUsuario.nome,
        email: novoUsuario.email,
      },
      ENV.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return {
      token,
      usuario: {
        id: novoUsuario.id,
        nome: novoUsuario.nome,
        email: novoUsuario.email,
        avatar: novoUsuario.avatar,
      },
      message: 'Usuário cadastrado com sucesso',
    };
  },
};

