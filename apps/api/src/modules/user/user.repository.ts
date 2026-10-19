import { pool } from '../../core/config/database';
import { UserEntity } from './user.types';

export const UserRepository = {
  async buscaPorNome(nome: string): Promise<UserEntity | undefined> {
    const result = await pool.query<UserEntity>(
      'SELECT * FROM usuarios WHERE nome = $1 LIMIT 1',
      [nome]
    );
    return result.rows[0];
  },

  async buscaPorNomeOuEmail(identificador: string): Promise<UserEntity | undefined> {
    const result = await pool.query<UserEntity>(
      'SELECT * FROM usuarios WHERE nome = $1 LIMIT 1',
      [identificador]
    );
    return result.rows[0];
  },

  async buscaPorId(id: number): Promise<UserEntity | undefined> {
    const result = await pool.query<UserEntity>(
      'SELECT * FROM usuarios WHERE id = $1 LIMIT 1',
      [id]
    );
    return result.rows[0];
  },

  async criar(user: { nome: string; senha_hash: string; email?: string }): Promise<UserEntity> {
    const { nome, senha_hash } = user;
    const result = await pool.query<UserEntity>(
      'INSERT INTO usuarios (nome, senha_hash) VALUES ($1, $2) RETURNING *',
      [nome, senha_hash]
    );
    return result.rows[0];
  },

  async updateAvatar(userId: number, avatar: string): Promise<UserEntity | undefined> {
    const result = await pool.query<UserEntity>(
      'UPDATE usuarios SET avatar = $1 WHERE id = $2 RETURNING *',
      [avatar, userId]
    );
    return result.rows[0];
  },

  async buscaAvatar(userId: number): Promise<{ avatar: string | null } | undefined> {
    const result = await pool.query<{ avatar: string | null }>(
      'SELECT avatar FROM usuarios WHERE id = $1 LIMIT 1',
      [userId]
    );
    return result.rows[0];
  },
};
