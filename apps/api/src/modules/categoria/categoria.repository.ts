import { pool } from '../../core/config/database';
import { CategoriaEntity, CreateCategoriaDto } from './categoria.types';

export const CategoriaRepository = {
  async criar(categoria: CreateCategoriaDto): Promise<CategoriaEntity> {
    const { nome, icone } = categoria;
    const result = await pool.query<CategoriaEntity>(
      'INSERT INTO categoria (nome, icone) VALUES ($1, $2) RETURNING *',
      [nome, icone || null]
    );
    return result.rows[0];
  },

  async listar(): Promise<CategoriaEntity[]> {
    const result = await pool.query<CategoriaEntity>(
      'SELECT * FROM categoria ORDER BY nome ASC'
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

  async deletar(id: number | string): Promise<CategoriaEntity | undefined> {
    const result = await pool.query<CategoriaEntity>(
      'DELETE FROM categoria WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  },
};

