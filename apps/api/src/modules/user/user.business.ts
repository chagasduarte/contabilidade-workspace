// Tipo global Express.Multer.File (usado abaixo) vem de @types/multer
/// <reference types="multer" />
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { UserRepository } from './user.repository';
import { CreateUserDto, UserEntity, UserResponse } from './user.types';

export const UserBusiness = {
  async criar(
    usuario: CreateUserDto,
    file?: Express.Multer.File
  ): Promise<UserResponse> {
    const nome = usuario.nome?.trim();
    const email = usuario.email?.trim().toLowerCase();
    const senha = usuario.senha;

    if (!nome) throw new Error('Nome é obrigatório');
    if (!senha) throw new Error('Senha é obrigatória');

    if (email) {
      const existeEmail = await UserRepository.buscaPorEmail(email);
      if (existeEmail) {
        const err = new Error('Este e-mail já está cadastrado');
        (err as unknown as { statusCode: number }).statusCode = 409;
        throw err;
      }
    }

    const existeNome = await UserRepository.buscaPorNome(nome);
    if (existeNome) {
      const err = new Error('Este nome de usuário já está em uso');
      (err as unknown as { statusCode: number }).statusCode = 409;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(senha, salt);

    const user = await UserRepository.criar({
      nome,
      email: email || null,
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

  /**
   * PUT /user/me: atualiza nome e/ou email do usuário autenticado.
   * Duplicado (outro usuário, sem diferenciar maiúsculas) -> 409; inválido -> 400.
   */
  async atualizarPerfil(
    userId: number,
    dados: { nome?: unknown; email?: unknown }
  ): Promise<UserResponse> {
    const erro = (message: string, statusCode: number) => {
      const err = new Error(message);
      (err as unknown as { statusCode: number }).statusCode = statusCode;
      return err;
    };

    const atualizacao: { nome?: string; email?: string } = {};

    if (dados?.nome !== undefined) {
      const nome = typeof dados.nome === 'string' ? dados.nome.trim() : '';
      if (nome.length < 2 || nome.length > 255) {
        throw erro('O nome deve conter entre 2 e 255 caracteres', 400);
      }
      const outro = await UserRepository.buscaPorNome(nome);
      if (outro && outro.id !== userId) throw erro('Este nome de usuário já está em uso', 409);
      atualizacao.nome = nome;
    }

    if (dados?.email !== undefined) {
      const email = typeof dados.email === 'string' ? dados.email.trim().toLowerCase() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
        throw erro('Informe um e-mail válido', 400);
      }
      const outro = await UserRepository.buscaPorEmail(email);
      if (outro && outro.id !== userId) throw erro('Este e-mail já está cadastrado', 409);
      atualizacao.email = email;
    }

    if (atualizacao.nome === undefined && atualizacao.email === undefined) {
      throw erro('Informe nome e/ou email para atualizar', 400);
    }

    let user: UserEntity | undefined;
    try {
      user = await UserRepository.atualizarPerfil(userId, atualizacao);
    } catch (e) {
      // Corrida entre a checagem e o UPDATE: o índice único decide
      if ((e as { code?: string }).code === '23505') {
        throw erro('Nome de usuário ou e-mail já está em uso', 409);
      }
      throw e;
    }
    if (!user) throw erro('Usuário não encontrado', 404);

    return { id: user.id, nome: user.nome, email: user.email, avatar: user.avatar };
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

