-- ==============================================================================
-- 003 - Integridade: FKs e CHECKs que faltavam
-- Não destrutiva e idempotente:
--   * cada constraint só é criada se ainda não existir (pg_constraint);
--   * todas entram como NOT VALID: passam a valer para INSERT/UPDATE novos, mas
--     NÃO verificam (nem rejeitam) linhas antigas -> não falha com dado legado sujo
--     e não segura lock longo. A validação das linhas antigas fica em
--     docker/postgres/manual/validar_constraints.sql (rodar após checar violações).
--   * UNIQUEs só são criadas se não houver duplicados; senão emite NOTICE.
--
-- Valores aceitos foram tirados do que a API grava hoje:
--   transacoes.tipo   : 'entrada' | 'saida' | 'cartao' (transacao) + 'RECEITA' | 'DESPESA'
--                       (settlement grava o tipo do planned/loan - ver PROPOSTAS_SQL.md P1)
--   transacoes.status : 'pendente' | 'pago'
-- ==============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION pg_temp.add_constraint(p_table text, p_name text, p_def text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = p_name AND conrelid = ('public.' || p_table)::regclass
  ) THEN
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', p_table, p_name, p_def);
  END IF;
END
$$;

-- ------------------------------------------------------------------------------
-- FKs de dono (userid) -> usuarios. Não existe DELETE de usuário na API, então
-- NO ACTION não muda comportamento atual; só impede órfãos.
-- (loans.user_id é VARCHAR com UUID "fake" -> não dá FK; ver PROPOSTAS_SQL.md P3)
-- ------------------------------------------------------------------------------
SELECT pg_temp.add_constraint('transacoes',           'fk_transacoes_usuario',
  'FOREIGN KEY (userid) REFERENCES usuarios(id) NOT VALID');
SELECT pg_temp.add_constraint('planned_transactions', 'fk_planned_tx_usuario',
  'FOREIGN KEY (userid) REFERENCES usuarios(id) NOT VALID');
SELECT pg_temp.add_constraint('credit_cards',         'fk_credit_cards_usuario',
  'FOREIGN KEY (usuario_id) REFERENCES usuarios(id) NOT VALID');
SELECT pg_temp.add_constraint('cartoes',              'fk_cartoes_usuario',
  'FOREIGN KEY (userid) REFERENCES usuarios(id) NOT VALID');
SELECT pg_temp.add_constraint('planejamento',         'fk_planejamento_usuario',
  'FOREIGN KEY (userid) REFERENCES usuarios(id) NOT VALID');
SELECT pg_temp.add_constraint('objetivos',            'fk_objetivos_usuario',
  'FOREIGN KEY (usuario_id) REFERENCES usuarios(id) NOT VALID');

-- transacoes.cartaoid -> cartoes (legado). SET NULL preserva o lançamento.
SELECT pg_temp.add_constraint('transacoes', 'fk_transacoes_cartao',
  'FOREIGN KEY (cartaoid) REFERENCES cartoes(id) ON DELETE SET NULL NOT VALID');

-- ------------------------------------------------------------------------------
-- CHECKs de domínio
-- ------------------------------------------------------------------------------
SELECT pg_temp.add_constraint('transacoes', 'ck_transacoes_tipo',
  $c$CHECK (tipo IN ('entrada', 'saida', 'cartao', 'RECEITA', 'DESPESA')) NOT VALID$c$);
SELECT pg_temp.add_constraint('transacoes', 'ck_transacoes_status',
  $c$CHECK (status IN ('pendente', 'pago')) NOT VALID$c$);

SELECT pg_temp.add_constraint('credit_cards', 'ck_credit_cards_dias',
  'CHECK (dia_fechamento BETWEEN 1 AND 31 AND dia_vencimento BETWEEN 1 AND 31) NOT VALID');
SELECT pg_temp.add_constraint('credit_cards', 'ck_credit_cards_limite',
  'CHECK (limite_total >= 0) NOT VALID');
SELECT pg_temp.add_constraint('cartoes', 'ck_cartoes_dias',
  'CHECK (dia_fatura BETWEEN 1 AND 31 AND dia_vencimento BETWEEN 1 AND 31) NOT VALID');

SELECT pg_temp.add_constraint('card_invoices', 'ck_card_invoices_mes',
  'CHECK (mes_referencia BETWEEN 1 AND 12) NOT VALID');
SELECT pg_temp.add_constraint('card_transactions', 'ck_card_tx_parcelas',
  'CHECK (quantidade_parcelas >= 1 AND valor_total > 0) NOT VALID');
SELECT pg_temp.add_constraint('invoice_items', 'ck_invoice_items_parcela',
  'CHECK (numero_parcela >= 1) NOT VALID');

SELECT pg_temp.add_constraint('loans', 'ck_loans_valores',
  'CHECK (principal_amount > 0 AND monthly_interest_rate >= 0) NOT VALID');
SELECT pg_temp.add_constraint('loan_installments', 'ck_loan_installments_numero',
  'CHECK (installment_number >= 1) NOT VALID');

-- ------------------------------------------------------------------------------
-- UNIQUEs (só se não houver duplicados)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Uma parcela por número dentro da mesma compra no cartão
  IF to_regclass('public.invoice_items') IS NOT NULL
     AND to_regclass('public.uq_invoice_items_transacao_parcela') IS NULL THEN
    IF EXISTS (SELECT 1 FROM invoice_items GROUP BY transacao_id, numero_parcela HAVING COUNT(*) > 1) THEN
      RAISE NOTICE 'invoice_items possui parcelas duplicadas; uq_invoice_items_transacao_parcela NÃO criado';
    ELSE
      CREATE UNIQUE INDEX uq_invoice_items_transacao_parcela
        ON invoice_items (transacao_id, numero_parcela);
    END IF;
  END IF;

  -- Uma parcela de empréstimo por número
  IF to_regclass('public.loan_installments') IS NOT NULL
     AND to_regclass('public.uq_loan_installments_numero') IS NULL THEN
    IF EXISTS (SELECT 1 FROM loan_installments GROUP BY loan_id, installment_number HAVING COUNT(*) > 1) THEN
      RAISE NOTICE 'loan_installments possui números duplicados; uq_loan_installments_numero NÃO criado';
    ELSE
      CREATE UNIQUE INDEX uq_loan_installments_numero
        ON loan_installments (loan_id, installment_number);
    END IF;
  END IF;

  -- Settlement idempotente: um mesmo planned/loan installment só vira 1 transação
  IF to_regclass('public.transacoes') IS NOT NULL
     AND to_regclass('public.uq_transacoes_source') IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM transacoes WHERE source_id IS NOT NULL
      GROUP BY source_type, source_id HAVING COUNT(*) > 1
    ) THEN
      RAISE NOTICE 'transacoes possui source duplicado; uq_transacoes_source NÃO criado';
    ELSE
      CREATE UNIQUE INDEX uq_transacoes_source
        ON transacoes (source_type, source_id) WHERE source_id IS NOT NULL;
    END IF;
  END IF;
END
$$;

INSERT INTO schema_migrations (version) VALUES ('003_integridade_constraints')
ON CONFLICT (version) DO NOTHING;
