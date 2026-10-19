import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../user/user.repository';
import { ENV } from '../../core/config/env';
import { AuthResponseDto } from './auth.types';

export const AuthBusiness = {
  async login(identificador: string, senha: string): Promise<AuthResponseDto> {
    if (!identificador || !senha) {
      throw new Error('Nome/email e senha são obrigatórios');
    }

    const usuario = await UserRepository.buscaPorNomeOuEmail(identificador);
    if (!usuario) {
      throw new Error('Usuário não encontrado');
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
      throw new Error('Senha incorreta');
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
};

