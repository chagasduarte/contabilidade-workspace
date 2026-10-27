-- ==============================================================================
-- 006 - loans.usuario_id INTEGER com FK para usuarios (PROPOSTAS_SQL.md P3)
-- Aprovada pelo usuário em 2026-10-26.
--
-- Parte 1 (não destrutiva, idempotente): coluna NULLABLE + FK NOT VALID + índice.
-- Parte 2 (ALTERA DADOS): backfill em docker/postgres/manual/backfill_loans_usuario.sql
-- (manual, ver RUNBOOK.md).
-- loans.user_id NÃO é removida aqui.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE IF EXISTS loans ADD COLUMN IF NOT EXISTS usuario_id INTEGER NULL;

DO $$
BEGIN
  IF to_regclass('public.loans') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_loans_usuario' AND conrelid = 'public.loans'::regclass
  ) THEN
    ALTER TABLE loans ADD CONSTRAINT fk_loans_usuario
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) NOT VALID;
  END IF;

  -- Substitui o filtro user_id IN ($uuid, $id) por usuario_id = $1
  CREATE INDEX IF NOT EXISTS idx_loans_usuario_status ON loans (usuario_id, status);
END
$$;

INSERT INTO schema_migrations (version) VALUES ('006_loans_usuario_id')
ON CONFLICT (version) DO NOTHING;
