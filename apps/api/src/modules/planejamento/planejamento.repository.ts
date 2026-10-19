import { pool } from '../../core/config/database';
import {
  PlanejamentoEntity,
  CreatePlanejamentoDto,
  UpdatePlanejamentoDto,
} from './planejamento.types';

export const PlanejamentoRepository = {
  async criar(
    planejamento: CreatePlanejamentoDto,
    userid: number
  ): Promise<PlanejamentoEntity> {
    const {
      categoria,
      subcategoria,
      valor,
      tipo,
      categoriaid,
      subcategoriaid,
      data,
    } = planejamento;

    const result = await pool.query<PlanejamentoEntity>(
      `INSERT INTO planejamento (categoria, subcategoria, valor, tipo, categoriaid, subcategoriaid, data, userid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        categoria,
        subcategoria || null,
        valor,
        tipo,
        categoriaid,
        subcategoriaid || null,
        data,
        userid,
      ]
    );

    return result.rows[0];
  },

  async atualizar(
    id: number | string,
    planejamento: UpdatePlanejamentoDto,
    userid: number
  ): Promise<PlanejamentoEntity | undefined> {
    const {
      categoria,
      subcategoria,
      valor,
      tipo,
      categoriaid,
      subcategoriaid,
    } = planejamento;

    const result = await pool.query<PlanejamentoEntity>(
      `UPDATE planejamento
         SET categoria = $1,
             subcategoria = $2,
             valor = $3,
             tipo = $4,
             categoriaid = $5,
             subcategoriaid = $6
       WHERE id = $7 AND userid = $8
       RETURNING *`,
      [
        categoria,
        subcategoria || null,
        valor,
        tipo,
        categoriaid,
        subcategoriaid || null,
        id,
        userid,
      ]
    );

    return result.rows[0];
  },

  async deletar(id: number | string, userid: number): Promise<void> {
    await pool.query(
      'DELETE FROM planejamento WHERE id = $1 AND userid = $2',
      [id, userid]
    );
  },

  async listar(userid: number): Promise<PlanejamentoEntity[]> {
    const result = await pool.query<PlanejamentoEntity>(
      'SELECT * FROM planejamento WHERE userid = $1 ORDER BY id DESC',
      [userid]
    );
    return result.rows;
  },

  async buscar(
    mes?: number | string | null,
    ano?: number | string | null,
    id?: number | string | null,
    tipo?: string | null,
    categoriaid?: number | string | null,
    subcategoriaid?: number | string | null,
    userid?: number
  ): Promise<PlanejamentoEntity[]> {
    const params: unknown[] = [];
    let query = 'SELECT * FROM planejamento WHERE 1 = 1';

    if (mes) {
      params.push(mes);
      query += ` AND extract(month from data) = $${params.length}`;
    }
    if (ano) {
      params.push(ano);
      query += ` AND extract(year from data) = $${params.length}`;
    }
    if (id) {
      params.push(id);
      query += ` AND id = $${params.length}`;
    }
    if (tipo) {
      params.push(tipo);
      query += ` AND tipo = $${params.length}`;
    }
    if (categoriaid) {
      params.push(categoriaid);
      query += ` AND categoriaid = $${params.length}`;
    }
    if (subcategoriaid) {
      params.push(subcategoriaid);
      query += ` AND subcategoriaid = $${params.length}`;
    }

    if (userid) {
      params.push(userid);
      query += ` AND userid = $${params.length}`;
    }

    query += ' ORDER BY data DESC';

    const result = await pool.query<PlanejamentoEntity>(query, params);
    return result.rows;
  },

  async buscarPorId(id: number | string, userid: number): Promise<PlanejamentoEntity | undefined> {
    const result = await pool.query<PlanejamentoEntity>(
      'SELECT * FROM planejamento WHERE id = $1 AND userid = $2 LIMIT 1',
      [id, userid]
    );
    return result.rows[0];
  },
};

