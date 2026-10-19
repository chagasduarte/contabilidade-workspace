import { pool } from '../../core/config/database';
import { SubcategoriaEntity, CreateSubcategoriaDto } from './subcategoria.types';

export const SubcategoriaRepository = {
  async criar(subcategoria: CreateSubcategoriaDto): Promise<SubcategoriaEntity> {
    const { idcategoria, nome, icone } = subcategoria;
    const result = await pool.query<SubcategoriaEntity>(
      'INSERT INTO subcategoria (idcategoria, nome, icone) VALUES ($1, $2, $3) RETURNING *',
      [idcategoria, nome, icone || null]
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

  async deletar(subcategoriaId: number | string): Promise<SubcategoriaEntity | undefined> {
    const result = await pool.query<SubcategoriaEntity>(
      'DELETE FROM subcategoria WHERE id = $1 RETURNING *',
      [subcategoriaId]
    );
    return result.rows[0];
  },
};

