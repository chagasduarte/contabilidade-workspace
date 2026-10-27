import { pool } from '../../core/config/database';
import {
  SubcategoriaEntity,
  CreateSubcategoriaDto,
  UpdateSubcategoriaDto,
} from './subcategoria.types';

// Visibilidade: subcategorias do usuário + globais (userid NULL).
// Escrita (UPDATE/DELETE): somente as do próprio usuário.
export const SubcategoriaRepository = {
  async criar(subcategoria: CreateSubcategoriaDto, userid: number): Promise<SubcategoriaEntity> {
    const { idcategoria, nome, icone, cor } = subcategoria;
    const result = await pool.query<SubcategoriaEntity>(
      'INSERT INTO subcategoria (idcategoria, nome, icone, cor, userid) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [idcategoria, nome, icone || null, cor || '#3880ff', userid]
    );
    return result.rows[0];
  },

  async listar(userid: number): Promise<SubcategoriaEntity[]> {
    const result = await pool.query<SubcategoriaEntity>(
      'SELECT * FROM subcategoria WHERE (userid = $1 OR userid IS NULL) ORDER BY nome ASC',
      [userid]
    );
    return result.rows;
  },

  async listarPorCategoria(idcategoria: number | string, userid: number): Promise<SubcategoriaEntity[]> {
    const result = await pool.query<SubcategoriaEntity>(
      'SELECT * FROM subcategoria WHERE idcategoria = $1 AND (userid = $2 OR userid IS NULL) ORDER BY nome ASC',
      [idcategoria, userid]
    );
    return result.rows;
  },

  async buscar(subcategoriaId: number | string, userid: number): Promise<SubcategoriaEntity | undefined> {
    const result = await pool.query<SubcategoriaEntity>(
      'SELECT * FROM subcategoria WHERE id = $1 AND (userid = $2 OR userid IS NULL)',
      [subcategoriaId, userid]
    );
    return result.rows[0];
  },

  /** true se a subcategoria existe e é global (usado para responder 403 em vez de 404). */
  async existeGlobal(id: number | string): Promise<boolean> {
    const result = await pool.query('SELECT 1 FROM subcategoria WHERE id = $1 AND userid IS NULL', [id]);
    return result.rows.length > 0;
  },

  async atualizar(
    id: number | string,
    dto: UpdateSubcategoriaDto,
    userid: number
  ): Promise<SubcategoriaEntity | undefined> {
    const { idcategoria, nome, icone, cor } = dto;
    const result = await pool.query<SubcategoriaEntity>(
      `UPDATE subcategoria
       SET idcategoria = COALESCE($1, idcategoria),
           nome = COALESCE($2, nome),
           icone = COALESCE($3, icone),
           cor = COALESCE($4, cor)
       WHERE id = $5 AND userid = $6
       RETURNING *`,
      [idcategoria ?? null, nome ?? null, icone ?? null, cor ?? null, id, userid]
    );
    return result.rows[0];
  },

  async deletar(subcategoriaId: number | string, userid: number): Promise<SubcategoriaEntity | undefined> {
    const result = await pool.query<SubcategoriaEntity>(
      'DELETE FROM subcategoria WHERE id = $1 AND userid = $2 RETURNING *',
      [subcategoriaId, userid]
    );
    return result.rows[0];
  },
};
