-- ==============================================================================
-- 008 - transacoes.idsubcategoria (fase 1 da proposta do campo 'categoria',
--       nota 'Demandas Front-Back')
-- Não destrutiva e idempotente: coluna NULLABLE sem DEFAULT (só catálogo),
-- FK NOT VALID (não varre linhas antigas) e índice parcial. Nenhum dado é alterado.
-- A coluna legada transacoes.categoria NÃO é tocada. O backfill (fase 3) fica em
-- docker/postgres/manual/backfill_idsubcategoria.sql e exige aprovação.
--
-- Sem índice (userid, idcategoria, idsubcategoria): agrupamentoTipo e
-- dashboard.getAgrupamentoCategoria filtram por userid + faixa de datas e só
-- depois agrupam; o filtro seletivo é o de data (idx_transacoes_userid_competencia),
-- e um índice que começa por (userid, idcategoria) não ajuda essa faixa.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE IF EXISTS transacoes ADD COLUMN IF NOT EXISTS idsubcategoria INTEGER NULL;

DO $$
BEGIN
  IF to_regclass('public.transacoes') IS NULL OR to_regclass('public.subcategoria') IS NULL THEN
    RETURN;
  END IF;

  -- Excluir uma subcategoria mantém o lançamento (só zera o vínculo)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_transacoes_subcategoria' AND conrelid = 'public.transacoes'::regclass
  ) THEN
    ALTER TABLE transacoes ADD CONSTRAINT fk_transacoes_subcategoria
      FOREIGN KEY (idsubcategoria) REFERENCES subcategoria(id) ON DELETE SET NULL NOT VALID;
  END IF;

  -- Atende o ON DELETE SET NULL (sem ele, cada DELETE em subcategoria varre transacoes)
  CREATE INDEX IF NOT EXISTS idx_transacoes_idsubcategoria
    ON transacoes (idsubcategoria) WHERE idsubcategoria IS NOT NULL;
END
$$;

INSERT INTO schema_migrations (version) VALUES ('008_transacoes_idsubcategoria')
ON CONFLICT (version) DO NOTHING;
