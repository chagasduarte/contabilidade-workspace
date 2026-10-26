import { pool } from '../../core/config/database';
import {
  CategoriaEntity,
  CreateCategoriaDto,
  TipoCategoria,
  UpdateCategoriaDto,
} from './categoria.types';

// Visibilidade: categorias do usuário + globais (userid NULL, padrão do sistema).
// Escrita (UPDATE/DELETE): somente as do próprio usuário.
export const CategoriaRepository = {
  async criar(categoria: CreateCategoriaDto, userid: number): Promise<CategoriaEntity> {
    const { nome, icone, cor, tipo } = categoria;
    const result = await pool.query<CategoriaEntity>(
      'INSERT INTO categoria (nome, icone, cor, tipo, userid) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nome, icone || null, cor || '#3880ff', tipo || 'despesa', userid]
    );
    return result.rows[0];
  },

  async listar(userid: number, tipo?: TipoCategoria): Promise<CategoriaEntity[]> {
    if (tipo) {
      const result = await pool.query<CategoriaEntity>(
        'SELECT * FROM categoria WHERE (userid = $1 OR userid IS NULL) AND tipo = $2 ORDER BY nome ASC',
        [userid, tipo]
      );
      return result.rows;
    }
    const result = await pool.query<CategoriaEntity>(
      'SELECT * FROM categoria WHERE (userid = $1 OR userid IS NULL) ORDER BY tipo ASC, nome ASC',
      [userid]
    );
    return result.rows;
  },

  async buscar(id: number | string, userid: number): Promise<CategoriaEntity | undefined> {
    const result = await pool.query<CategoriaEntity>(
      'SELECT * FROM categoria WHERE id = $1 AND (userid = $2 OR userid IS NULL)',
      [id, userid]
    );
    return result.rows[0];
  },

  /** true se a categoria existe e é global (usado para responder 403 em vez de 404). */
  async existeGlobal(id: number | string): Promise<boolean> {
    const result = await pool.query('SELECT 1 FROM categoria WHERE id = $1 AND userid IS NULL', [id]);
    return result.rows.length > 0;
  },

  async atualizar(
    id: number | string,
    dto: UpdateCategoriaDto,
    userid: number
  ): Promise<CategoriaEntity | undefined> {
    const { nome, icone, cor, tipo } = dto;
    const result = await pool.query<CategoriaEntity>(
      `UPDATE categoria
       SET nome = COALESCE($1, nome),
           icone = COALESCE($2, icone),
           cor = COALESCE($3, cor),
           tipo = COALESCE($4, tipo)
       WHERE id = $5 AND userid = $6
       RETURNING *`,
      [nome ?? null, icone ?? null, cor ?? null, tipo ?? null, id, userid]
    );
    return result.rows[0];
  },

  async deletar(id: number | string, userid: number): Promise<CategoriaEntity | undefined> {
    const result = await pool.query<CategoriaEntity>(
      'DELETE FROM categoria WHERE id = $1 AND userid = $2 RETURNING *',
      [id, userid]
    );
    return result.rows[0];
  },
};
