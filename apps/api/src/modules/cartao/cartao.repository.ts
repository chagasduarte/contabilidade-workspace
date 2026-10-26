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

  /**
   * Somente leitura. A sincronização credit_cards -> cartoes acontece na criação do cartão
   * (CardRepository.criarCartao / CartaoRepository.criar); o legado foi alinhado uma vez pelo
   * script aprovado docker/postgres/manual/sync_cartoes_legado.sql.
   */
  async listar(userid: number): Promise<CartaoEntity[]> {
    // Tenta consultar a tabela legado cartoes
    try {
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

  /**
   * Busca cartão do usuário: id numérico na tabela legada `cartoes`, UUID em `credit_cards`.
   * Sempre filtra pelo dono.
   */
  async buscar(cartaoid: number | string, userid: number): Promise<CartaoEntity | undefined> {
    const idStr = String(cartaoid).trim();

    if (/^\d+$/.test(idStr)) {
      const result = await pool.query<CartaoEntity>(
        'SELECT * FROM cartoes WHERE id = $1 AND userid = $2',
        [Number(idStr), userid]
      );
      return result.rows[0];
    }

    // UUID: compara com a PK nativa (id = $1::uuid usa o índice; id::text = $1 não)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr)) {
      return undefined;
    }

    const ccResult = await pool.query(
      `SELECT id, nome, dia_fechamento as dia_fatura, dia_vencimento, limite_total as limite, usuario_id as userid
       FROM credit_cards
       WHERE id = $1::uuid AND usuario_id = $2`,
      [idStr, userid]
    );
    const row = ccResult.rows[0];
    if (!row) return undefined;

    return {
      id: row.id,
      nome: row.nome,
      dia_fatura: Number(row.dia_fatura),
      dia_vencimento: Number(row.dia_vencimento),
      limite: Number(row.limite),
      userid: Number(row.userid),
    };
  },
};
