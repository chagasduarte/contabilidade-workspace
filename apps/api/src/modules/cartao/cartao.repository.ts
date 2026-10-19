import { pool } from '../../core/config/database';
import { CartaoEntity, CreateCartaoDto } from './cartao.types';

export const CartaoRepository = {
  async criar(cartao: CreateCartaoDto, userid: number): Promise<CartaoEntity> {
    const { nome, dia_fatura, limite } = cartao;
    const result = await pool.query<CartaoEntity>(
      `INSERT INTO cartoes (nome, dia_fatura, dia_vencimento, limite, userid)
       VALUES ($1, $2, $2, $3, $4)
       RETURNING *`,
      [nome, dia_fatura, limite, userid]
    );

    // Sincroniza também com a tabela moderna credit_cards
    try {
      await pool.query(
        `INSERT INTO credit_cards (usuario_id, nome, bandeira, limite_total, dia_fechamento, dia_vencimento, cor_identificacao)
         SELECT $1, $2, 'Outros', $3, $4, $4, '#0f172a'
         WHERE NOT EXISTS (
           SELECT 1 FROM credit_cards WHERE usuario_id = $1 AND LOWER(TRIM(nome)) = LOWER(TRIM($2))
         )`,
        [userid, nome, limite || 0, dia_fatura || 1]
      );
    } catch {
      // Ignora erro de sincronização secundária
    }

    return result.rows[0];
  },

  async listar(userid: number): Promise<CartaoEntity[]> {
    // Tenta consultar a tabela legado cartoes
    try {
      try {
        await pool.query(
          `INSERT INTO cartoes (nome, dia_fatura, dia_vencimento, limite, userid)
           SELECT cc.nome, cc.dia_fechamento, cc.dia_vencimento, cc.limite_total, cc.usuario_id
           FROM credit_cards cc
           WHERE cc.usuario_id = $1 AND cc.ativo = true
             AND NOT EXISTS (
               SELECT 1 FROM cartoes c 
               WHERE c.userid = cc.usuario_id AND LOWER(TRIM(c.nome)) = LOWER(TRIM(cc.nome))
             )`,
          [userid]
        );
      } catch {
        // Segue para a consulta mesmo se houver falha na sincronização
      }

      const result = await pool.query<CartaoEntity>(
        'SELECT * FROM cartoes WHERE userid = $1 ORDER BY id ASC',
        [userid]
      );
      if (result.rows && result.rows.length > 0) {
        return result.rows;
      }
    } catch {
      // Se a tabela cartoes falhar, consulta credit_cards diretamente
    }

    // Consulta fallback em credit_cards
    try {
      const ccResult = await pool.query(
        `SELECT id, nome, dia_fechamento as dia_fatura, dia_vencimento, limite_total as limite, usuario_id as userid 
         FROM credit_cards 
         WHERE usuario_id = $1 AND ativo = true
         ORDER BY nome ASC`,
        [userid]
      );
      return ccResult.rows.map((row) => ({
        id: row.id,
        nome: row.nome,
        dia_fatura: Number(row.dia_fatura),
        dia_vencimento: Number(row.dia_vencimento),
        limite: Number(row.limite),
        userid: Number(row.userid),
      }));
    } catch {
      return [];
    }
  },

  async buscar(cartaoid: number | string): Promise<CartaoEntity | undefined> {
    const isNum = !isNaN(Number(cartaoid)) && String(cartaoid).indexOf('-') === -1;
    if (isNum) {
      const result = await pool.query<CartaoEntity>(
        'SELECT * FROM cartoes WHERE id = $1',
        [Number(cartaoid)]
      );
      if (result.rows[0]) return result.rows[0];
    }

    // Se for UUID ou não encontrado por ID numérico, busca em credit_cards
    try {
      const ccResult = await pool.query(
        `SELECT id, nome, dia_fechamento as dia_fatura, dia_vencimento, limite_total as limite, usuario_id as userid 
         FROM credit_cards 
         WHERE id::text = $1`,
        [String(cartaoid)]
      );
      if (ccResult.rows[0]) {
        return {
          id: ccResult.rows[0].id,
          nome: ccResult.rows[0].nome,
          dia_fatura: Number(ccResult.rows[0].dia_fatura),
          dia_vencimento: Number(ccResult.rows[0].dia_vencimento),
          limite: Number(ccResult.rows[0].limite),
          userid: Number(ccResult.rows[0].userid),
        };
      }
    } catch {
      // Ignora erro
    }

    return undefined;
  },
};
