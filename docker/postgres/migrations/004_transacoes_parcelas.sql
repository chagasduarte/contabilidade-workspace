-- ==============================================================================
-- 004 - Modelo explícito de parcelamento em transacoes
-- Substitui (gradualmente) a detecção por descricao LIKE '%- Parcela'.
-- Não destrutiva e idempotente: colunas novas são NULLABLE e sem DEFAULT
-- (ALTER só mexe no catálogo, sem reescrever a tabela). Nenhum dado é alterado:
-- o preenchimento das linhas antigas está em docker/postgres/manual/backfill_parcelas.sql
-- e só roda com aprovação.
--
--   parcela_grupo_id : mesmo UUID para todas as parcelas de uma compra/despesa fixa
--   parcela_numero   : 1..parcela_total
--   parcela_total    : quantidade de parcelas do grupo
-- ==============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE IF EXISTS transacoes ADD COLUMN IF NOT EXISTS parcela_grupo_id UUID NULL;
ALTER TABLE IF EXISTS transacoes ADD COLUMN IF NOT EXISTS parcela_numero   INTEGER NULL;
ALTER TABLE IF EXISTS transacoes ADD COLUMN IF NOT EXISTS parcela_total    INTEGER NULL;

DO $$
BEGIN
  IF to_regclass('public.transacoes') IS NULL THEN
    RETURN;
  END IF;

  -- As três colunas andam juntas e o número fica dentro do total
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_transacoes_parcela' AND conrelid = 'public.transacoes'::regclass
  ) THEN
    ALTER TABLE transacoes ADD CONSTRAINT ck_transacoes_parcela CHECK (
      (parcela_grupo_id IS NULL AND parcela_numero IS NULL AND parcela_total IS NULL)
      OR (parcela_grupo_id IS NOT NULL AND parcela_total >= 1
          AND parcela_numero BETWEEN 1 AND parcela_total)
    );
    -- Sem NOT VALID: colunas acabaram de nascer NULL, todas as linhas já satisfazem.
  END IF;

  -- Uma parcela por número dentro do grupo + acesso por grupo (resumo de parcelamento)
  CREATE UNIQUE INDEX IF NOT EXISTS uq_transacoes_parcela_grupo_numero
    ON transacoes (parcela_grupo_id, parcela_numero)
    WHERE parcela_grupo_id IS NOT NULL;

  -- /transacoes/parceladas e /transacoes (parceladas x adicionais) no modelo novo
  CREATE INDEX IF NOT EXISTS idx_transacoes_userid_parcela_pagamento
    ON transacoes (userid, pagamento)
    WHERE parcela_grupo_id IS NOT NULL;
END
$$;

INSERT INTO schema_migrations (version) VALUES ('004_transacoes_parcelas')
ON CONFLICT (version) DO NOTHING;
