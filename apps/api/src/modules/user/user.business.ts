import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { UserRepository } from './user.repository';
import { CreateUserDto, UserResponse } from './user.types';

export const UserBusiness = {
  async criar(
    usuario: CreateUserDto,
    file?: Express.Multer.File
  ): Promise<UserResponse> {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(usuario.senha, salt);

    const user = await UserRepository.criar({
      nome: usuario.nome,
      email: usuario.email,
      senha_hash: hash,
    });

    if (file) {
      await this.uploadAvatar(user.id, file);
      user.avatar = `uploads/${file.filename}`;
    }

    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      avatar: user.avatar,
    };
  },

  async uploadAvatar(
    userId: number,
    file: Express.Multer.File
  ): Promise<void> {
    if (!file) throw new Error('Arquivo não recebido');

    const avatarData = await UserRepository.buscaAvatar(userId);
    if (avatarData?.avatar) {
      const oldPath = path.join(process.cwd(), 'public', avatarData.avatar);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          console.warn('Erro ao remover avatar antigo:', e);
        }
      }
    }

    const filePath = `uploads/${file.filename}`;
    const userUpdated = await UserRepository.updateAvatar(userId, filePath);
    if (!userUpdated) throw new Error('Usuário não encontrado');
  },

  async getAvatar(userId: number): Promise<{ avatar: string | null } | undefined> {
    return await UserRepository.buscaAvatar(userId);
  },

  async buscarPorId(userId: number): Promise<UserResponse | undefined> {
    const user = await UserRepository.buscaPorId(userId);
    if (!user) return undefined;
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      avatar: user.avatar,
    };
  },
};

