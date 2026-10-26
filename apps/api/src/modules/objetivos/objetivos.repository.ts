import { pool } from '../../core/config/database';
import { ObjetivoEntity, CreateObjetivoDto, UpdateObjetivoDto } from './objetivos.types';

// data_final como texto (YYYY-MM-DD) para não sofrer conversão de fuso; numéricos convertidos em mapear()
const COLUNAS = `id, usuario_id, nome, tipo, valor_objetivo, valor_mensal, valor_acumulado,
                 TO_CHAR(data_final, 'YYYY-MM-DD') AS data_final, criado_em`;

function mapear(row: Record<string, unknown>): ObjetivoEntity {
  return {
    id: Number(row['id']),
    usuario_id: Number(row['usuario_id']),
    nome: String(row['nome']),
    tipo: String(row['tipo']),
    valor_objetivo: Number(row['valor_objetivo']),
    valor_mensal: Number(row['valor_mensal']),
    valor_acumulado: Number(row['valor_acumulado'] ?? 0),
    data_final: String(row['data_final']),
    criado_em: (row['criado_em'] as Date | null) ?? null,
  };
}

export const ObjetivosRepository = {
  async criar(objetivo: CreateObjetivoDto, userid: number): Promise<ObjetivoEntity> {
    const result = await pool.query(
      `INSERT INTO objetivos (usuario_id, nome, tipo, valor_objetivo, valor_mensal, valor_acumulado, data_final)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUNAS}`,
      [
        userid,
        objetivo.nome,
        objetivo.tipo,
        objetivo.valor_objetivo,
        objetivo.valor_mensal ?? 0,
        objetivo.valor_acumulado ?? 0,
        objetivo.data_final,
      ]
    );
    return mapear(result.rows[0]);
  },

  async listar(userid: number): Promise<ObjetivoEntity[]> {
    const result = await pool.query(
      `SELECT ${COLUNAS} FROM objetivos WHERE usuario_id = $1 ORDER BY id DESC`,
      [userid]
    );
    return result.rows.map(mapear);
  },

  async buscar(objetivoid: number | string, userid: number): Promise<ObjetivoEntity | undefined> {
    const result = await pool.query(
      `SELECT ${COLUNAS} FROM objetivos WHERE id = $1 AND usuario_id = $2`,
      [objetivoid, userid]
    );
    return result.rows[0] ? mapear(result.rows[0]) : undefined;
  },

  /** Atualização parcial: campos ausentes (undefined) mantêm o valor atual. */
  async atualizar(
    objetivoid: number | string,
    dto: UpdateObjetivoDto,
    userid: number
  ): Promise<ObjetivoEntity | undefined> {
    const result = await pool.query(
      `UPDATE objetivos
       SET nome = COALESCE($1, nome),
           tipo = COALESCE($2, tipo),
           valor_objetivo = COALESCE($3, valor_objetivo),
           valor_mensal = COALESCE($4, valor_mensal),
           valor_acumulado = COALESCE($5, valor_acumulado),
           data_final = COALESCE($6::date, data_final)
       WHERE id = $7 AND usuario_id = $8
       RETURNING ${COLUNAS}`,
      [
        dto.nome ?? null,
        dto.tipo ?? null,
        dto.valor_objetivo ?? null,
        dto.valor_mensal ?? null,
        dto.valor_acumulado ?? null,
        dto.data_final ?? null,
        objetivoid,
        userid,
      ]
    );
    return result.rows[0] ? mapear(result.rows[0]) : undefined;
  },

  async deletar(objetivoid: number | string, userid: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM objetivos WHERE id = $1 AND usuario_id = $2', [
      objetivoid,
      userid,
    ]);
    return (result.rowCount ?? 0) > 0;
  },
};
