import { pool } from '../../core/config/database';
import {
  CategoriaEntity,
  CreateCategoriaDto,
  TipoCategoria,
  UpdateCategoriaDto,
} from './categoria.types';

export const CategoriaRepository = {
  async criar(categoria: CreateCategoriaDto): Promise<CategoriaEntity> {
    const { nome, icone, cor, tipo } = categoria;
    const result = await pool.query<CategoriaEntity>(
      'INSERT INTO categoria (nome, icone, cor, tipo) VALUES ($1, $2, $3, $4) RETURNING *',
      [nome, icone || null, cor || '#3880ff', tipo || 'despesa']
    );
    return result.rows[0];
  },

  async listar(tipo?: TipoCategoria): Promise<CategoriaEntity[]> {
    if (tipo) {
      const result = await pool.query<CategoriaEntity>(
        'SELECT * FROM categoria WHERE tipo = $1 ORDER BY nome ASC',
        [tipo]
      );
      return result.rows;
    }
    const result = await pool.query<CategoriaEntity>(
      'SELECT * FROM categoria ORDER BY tipo ASC, nome ASC'
    );
    return result.rows;
  },

  async buscar(id: number | string): Promise<CategoriaEntity | undefined> {
    const result = await pool.query<CategoriaEntity>(
      'SELECT * FROM categoria WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async atualizar(
    id: number | string,
    dto: UpdateCategoriaDto
  ): Promise<CategoriaEntity | undefined> {
    const { nome, icone, cor, tipo } = dto;
    const result = await pool.query<CategoriaEntity>(
      `UPDATE categoria
       SET nome = COALESCE($1, nome),
           icone = COALESCE($2, icone),
           cor = COALESCE($3, cor),
           tipo = COALESCE($4, tipo)
       WHERE id = $5
       RETURNING *`,
      [nome ?? null, icone ?? null, cor ?? null, tipo ?? null, id]
    );
    return result.rows[0];
  },

  async deletar(id: number | string): Promise<CategoriaEntity | undefined> {
    const result = await pool.query<CategoriaEntity>(
      'DELETE FROM categoria WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  },
};


