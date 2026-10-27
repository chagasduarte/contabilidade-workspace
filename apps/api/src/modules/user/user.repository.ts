import { pool } from '../../core/config/database';
import { UserEntity } from './user.types';

export const UserRepository = {
  async buscaPorNome(nome: string): Promise<UserEntity | undefined> {
    const result = await pool.query<UserEntity>(
      'SELECT * FROM usuarios WHERE LOWER(TRIM(nome)) = LOWER(TRIM($1)) LIMIT 1',
      [nome]
    );
    return result.rows[0];
  },

  async buscaPorEmail(email: string): Promise<UserEntity | undefined> {
    const result = await pool.query<UserEntity>(
      'SELECT * FROM usuarios WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1',
      [email]
    );
    return result.rows[0];
  },

  async buscaPorNomeOuEmail(identificador: string): Promise<UserEntity | undefined> {
    const trimmed = identificador.trim().toLowerCase();
    const result = await pool.query<UserEntity>(
      `SELECT * FROM usuarios 
       WHERE LOWER(TRIM(nome)) = $1 
          OR (email IS NOT NULL AND LOWER(TRIM(email)) = $1)
       LIMIT 1`,
      [trimmed]
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

  async criar(user: {
    nome: string;
    senha_hash: string;
    email?: string | null;
    avatar?: string | null;
  }): Promise<UserEntity> {
    const { nome, senha_hash, email, avatar } = user;
    const result = await pool.query<UserEntity>(
      `INSERT INTO usuarios (nome, senha_hash, email, avatar) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [nome.trim(), senha_hash, email ? email.trim().toLowerCase() : null, avatar || null]
    );
    return result.rows[0];
  },

  /** Atualiza nome/email (campos null mantêm o atual). Unicidade garantida pelos índices LOWER() da 007. */
  async atualizarPerfil(
    userId: number,
    dados: { nome?: string | null; email?: string | null }
  ): Promise<UserEntity | undefined> {
    const result = await pool.query<UserEntity>(
      `UPDATE usuarios
       SET nome = COALESCE($1, nome),
           email = COALESCE($2, email)
       WHERE id = $3
       RETURNING *`,
      [dados.nome ?? null, dados.email ?? null, userId]
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
