import { pool } from '../../core/config/database';
import {
  SubcategoriaEntity,
  CreateSubcategoriaDto,
  UpdateSubcategoriaDto,
} from './subcategoria.types';

export const SubcategoriaRepository = {
  async criar(subcategoria: CreateSubcategoriaDto): Promise<SubcategoriaEntity> {
    const { idcategoria, nome, icone, cor } = subcategoria;
    const result = await pool.query<SubcategoriaEntity>(
      'INSERT INTO subcategoria (idcategoria, nome, icone, cor) VALUES ($1, $2, $3, $4) RETURNING *',
      [idcategoria, nome, icone || null, cor || '#3880ff']
    );
    return result.rows[0];
  },

  async listar(): Promise<SubcategoriaEntity[]> {
    const result = await pool.query<SubcategoriaEntity>(
      'SELECT * FROM subcategoria ORDER BY nome ASC'
    );
    return result.rows;
  },

  async listarPorCategoria(idcategoria: number | string): Promise<SubcategoriaEntity[]> {
    const result = await pool.query<SubcategoriaEntity>(
      'SELECT * FROM subcategoria WHERE idcategoria = $1 ORDER BY nome ASC',
      [idcategoria]
    );
    return result.rows;
  },

  async buscar(subcategoriaId: number | string): Promise<SubcategoriaEntity | undefined> {
    const result = await pool.query<SubcategoriaEntity>(
      'SELECT * FROM subcategoria WHERE id = $1',
      [subcategoriaId]
    );
    return result.rows[0];
  },

  async atualizar(
    id: number | string,
    dto: UpdateSubcategoriaDto
  ): Promise<SubcategoriaEntity | undefined> {
    const { idcategoria, nome, icone, cor } = dto;
    const result = await pool.query<SubcategoriaEntity>(
      `UPDATE subcategoria
       SET idcategoria = COALESCE($1, idcategoria),
           nome = COALESCE($2, nome),
           icone = COALESCE($3, icone),
           cor = COALESCE($4, cor)
       WHERE id = $5
       RETURNING *`,
      [idcategoria ?? null, nome ?? null, icone ?? null, cor ?? null, id]
    );
    return result.rows[0];
  },

  async deletar(subcategoriaId: number | string): Promise<SubcategoriaEntity | undefined> {
    const result = await pool.query<SubcategoriaEntity>(
      'DELETE FROM subcategoria WHERE id = $1 RETURNING *',
      [subcategoriaId]
    );
    return result.rows[0];
  },
};


