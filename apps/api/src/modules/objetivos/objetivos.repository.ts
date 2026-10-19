import { pool } from '../../core/config/database';
import { ObjetivoEntity, CreateObjetivoDto } from './objetivos.types';

export const ObjetivosRepository = {
  async criar(objetivo: CreateObjetivoDto, userid: number): Promise<ObjetivoEntity> {
    const { nome, tipo, valor_objetivo, valor_mensal, data_final } = objetivo;
    const result = await pool.query<ObjetivoEntity>(
      `INSERT INTO objetivos (
        usuario_id,
        nome,
        tipo,
        valor_objetivo,
        valor_mensal,
        data_final
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [userid, nome, tipo, valor_objetivo, valor_mensal, data_final]
    );
    return result.rows[0];
  },

  async listar(userid: number): Promise<ObjetivoEntity[]> {
    const result = await pool.query<ObjetivoEntity>(
      'SELECT * FROM objetivos WHERE usuario_id = $1 ORDER BY id DESC',
      [userid]
    );
    return result.rows;
  },

  async buscar(objetivoid: number | string): Promise<ObjetivoEntity | undefined> {
    const result = await pool.query<ObjetivoEntity>(
      'SELECT * FROM objetivos WHERE id = $1',
      [objetivoid]
    );
    return result.rows[0];
  },
};

