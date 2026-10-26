-- ==============================================================================
-- 002 - Índices para os filtros reais dos repositórios (apps/api/src/modules/**)
-- Não destrutiva e idempotente: só CREATE ... IF NOT EXISTS. Nenhum índice é
-- removido aqui (redundantes estão listados em PROPOSTAS_SQL.md, aguardando aprovação).
-- Tabelas inexistentes são ignoradas (init.sql as cria com os índices em seguida).
--
-- Observação: CREATE INDEX (sem CONCURRENTLY) bloqueia escrita na tabela durante a
-- criação. Para o volume atual (app pessoal) é segundos; se crescer, rodar cada
-- comando manualmente com CONCURRENTLY fora de transação.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
);

DO $$
BEGIN
  -- --------------------------------------------------------------------------
  -- transacoes
  -- --------------------------------------------------------------------------
  IF to_regclass('public.transacoes') IS NOT NULL THEN
    -- GET /transacoes (listaParceladas/listaAdicionais): saída pendente por vencimento
    CREATE INDEX IF NOT EXISTS idx_transacoes_saida_pendente_pagamento
      ON transacoes (userid, pagamento)
      WHERE tipo = 'saida' AND status = 'pendente';

    -- somaTransacoes, linhaTemporal, buscaPorDia, getSaldoAcumulado (filtro por pagamento)
    CREATE INDEX IF NOT EXISTS idx_transacoes_userid_pagamento
      ON transacoes (userid, pagamento);

    -- Parcelas (detecção legada por sufixo de descrição) - /transacoes/parceladas e linhatemporal.
    -- O predicado precisa ser IDÊNTICO ao da query: descricao LIKE '%- Parcela'
    CREATE INDEX IF NOT EXISTS idx_transacoes_parcela
      ON transacoes (userid, descricao, pagamento)
      WHERE tipo = 'saida' AND descricao LIKE '%- Parcela';

    -- Data de competência (cartão -> pagamento, conta -> data): agrupamentoTipo, extrato,
    -- getAgrupamentoCategoria. Query deve usar exatamente esta expressão.
    CREATE INDEX IF NOT EXISTS idx_transacoes_userid_competencia
      ON transacoes (userid, (CASE WHEN cartaoid IS NOT NULL THEN pagamento ELSE data END));

    -- Extrato com paginação keyset: ORDER BY data DESC, id DESC + (data, id) < (cursor)
    CREATE INDEX IF NOT EXISTS idx_transacoes_userid_data_id
      ON transacoes (userid, data, id);

    -- FK idcategoria -> categoria (ON DELETE SET NULL varre transacoes sem este índice)
    CREATE INDEX IF NOT EXISTS idx_transacoes_idcategoria
      ON transacoes (idcategoria) WHERE idcategoria IS NOT NULL;

    -- Lançamentos vinculados a cartão legado
    CREATE INDEX IF NOT EXISTS idx_transacoes_cartaoid
      ON transacoes (cartaoid, pagamento) WHERE cartaoid IS NOT NULL;

    -- Sem índice trigram em descricao de propósito: testado com 200k linhas, o planner
    -- combina o GIN com o filtro ILIKE '%- Parcela' (pouco seletivo) e piora as
    -- queries legadas (~40ms vs ~1ms). GET /transacoes/despesa já filtra por userid.
  END IF;

  -- --------------------------------------------------------------------------
  -- planned_transactions
  -- --------------------------------------------------------------------------
  IF to_regclass('public.planned_transactions') IS NOT NULL THEN
    -- dashboard/forecast: pendentes do usuário por data
    CREATE INDEX IF NOT EXISTS idx_planned_tx_userid_pending_date
      ON planned_transactions (userid, data_prevista)
      WHERE status = 'PENDING';
    CREATE INDEX IF NOT EXISTS idx_planned_tx_idcategoria
      ON planned_transactions (idcategoria) WHERE idcategoria IS NOT NULL;
  END IF;

  -- --------------------------------------------------------------------------
  -- Cartões (modelo novo)
  -- --------------------------------------------------------------------------
  IF to_regclass('public.invoice_items') IS NOT NULL THEN
    -- FK transacao_id (ON DELETE CASCADE de card_transactions) não tinha índice
    CREATE INDEX IF NOT EXISTS idx_invoice_items_transacao
      ON invoice_items (transacao_id, numero_parcela);
  END IF;

  IF to_regclass('public.card_transactions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_card_tx_categoria
      ON card_transactions (categoria_id) WHERE categoria_id IS NOT NULL;
  END IF;

  IF to_regclass('public.card_invoices') IS NOT NULL THEN
    -- dashboard/forecast: faturas não pagas por vencimento
    CREATE INDEX IF NOT EXISTS idx_card_invoices_cartao_venc_aberta
      ON card_invoices (cartao_id, data_vencimento)
      WHERE status <> 'PAID';
  END IF;

  -- --------------------------------------------------------------------------
  -- Legado / demais tabelas sem índice em FK ou filtro por usuário
  -- --------------------------------------------------------------------------
  IF to_regclass('public.cartoes') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_cartoes_userid ON cartoes (userid);
  END IF;

  IF to_regclass('public.subcategoria') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_subcategoria_idcategoria ON subcategoria (idcategoria);
  END IF;

  IF to_regclass('public.planejamento') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_planejamento_userid_data ON planejamento (userid, data);
  END IF;

  IF to_regclass('public.objetivos') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_objetivos_usuario ON objetivos (usuario_id);
  END IF;

  IF to_regclass('public.loan_payments') IS NOT NULL THEN
    -- FK installment_id (ON DELETE SET NULL) não era coluna líder de nenhum índice
    CREATE INDEX IF NOT EXISTS idx_loan_payments_installment
      ON loan_payments (installment_id) WHERE installment_id IS NOT NULL;
  END IF;

  -- usuarios: login compara LOWER(TRIM(col)); os únicos existentes são LOWER(col)
  IF to_regclass('public.usuarios') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_usuarios_nome_trim ON usuarios (LOWER(TRIM(nome)));
    CREATE INDEX IF NOT EXISTS idx_usuarios_email_trim
      ON usuarios (LOWER(TRIM(email))) WHERE email IS NOT NULL;
  END IF;
END
$$;

INSERT INTO schema_migrations (version) VALUES ('002_indices_performance')
ON CONFLICT (version) DO NOTHING;
