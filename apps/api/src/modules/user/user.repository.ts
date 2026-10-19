import { pool } from '../../core/config/database';
import { UserEntity } from './user.types';

let tableChecked = false;

export const UserRepository = {
  async ensureTableExists(): Promise<void> {
    if (tableChecked) return;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id SERIAL PRIMARY KEY,
          nome VARCHAR(255) NOT NULL UNIQUE,
          senha_hash VARCHAR(255) NOT NULL,
          email VARCHAR(255) NULL,
          avatar TEXT NULL,
          criado_em TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_uniq 
          ON usuarios(LOWER(email)) WHERE email IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_nome_uniq 
          ON usuarios(LOWER(nome));
      `);
      tableChecked = true;
    } catch (err) {
      console.warn('[UserRepository] Aviso ao verificar/criar tabela usuarios:', err);
    }
  },

  async buscaPorNome(nome: string): Promise<UserEntity | undefined> {
    await this.ensureTableExists();
    const result = await pool.query<UserEntity>(
      'SELECT * FROM usuarios WHERE LOWER(TRIM(nome)) = LOWER(TRIM($1)) LIMIT 1',
      [nome]
    );
    return result.rows[0];
  },

  async buscaPorEmail(email: string): Promise<UserEntity | undefined> {
    await this.ensureTableExists();
    const result = await pool.query<UserEntity>(
      'SELECT * FROM usuarios WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1',
      [email]
    );
    return result.rows[0];
  },

  async buscaPorNomeOuEmail(identificador: string): Promise<UserEntity | undefined> {
    await this.ensureTableExists();
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
    await this.ensureTableExists();
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
    await this.ensureTableExists();
    const { nome, senha_hash, email, avatar } = user;
    const result = await pool.query<UserEntity>(
      `INSERT INTO usuarios (nome, senha_hash, email, avatar) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [nome.trim(), senha_hash, email ? email.trim().toLowerCase() : null, avatar || null]
    );
    return result.rows[0];
  },

  async updateAvatar(userId: number, avatar: string): Promise<UserEntity | undefined> {
    await this.ensureTableExists();
    const result = await pool.query<UserEntity>(
      'UPDATE usuarios SET avatar = $1 WHERE id = $2 RETURNING *',
      [avatar, userId]
    );
    return result.rows[0];
  },

  async buscaAvatar(userId: number): Promise<{ avatar: string | null } | undefined> {
    await this.ensureTableExists();
    const result = await pool.query<{ avatar: string | null }>(
      'SELECT avatar FROM usuarios WHERE id = $1 LIMIT 1',
      [userId]
    );
    return result.rows[0];
  },
};
