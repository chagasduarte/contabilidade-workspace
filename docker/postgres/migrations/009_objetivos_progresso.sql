-- ==============================================================================
-- 009 - Progresso dos objetivos (telas de Objetivos e Planejamento)
-- Não destrutiva e idempotente:
--   * valor_acumulado NUMERIC(12,2) NOT NULL DEFAULT 0: no PG11+ um ADD COLUMN com
--     DEFAULT constante NÃO reescreve a tabela (o valor fica em
--     pg_attribute.attmissingval e é devolvido nas linhas antigas); o NOT NULL também
--     não exige varredura, porque toda linha antiga "tem" o default. Lock
--     ACCESS EXCLUSIVE só pelo instante da alteração de catálogo.
--   * CHECKs NOT VALID: valem para INSERT/UPDATE novos, sem varrer linhas antigas.
--     VALIDATE em manual/validar_constraints.sql.
-- Nenhum índice novo: GET /objetivos/:id usa a PK e a listagem usa
-- idx_objetivos_usuario (002); o "planejado x realizado" é atendido por índices
-- existentes (ver PROPOSTAS_SQL.md, P7).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE IF EXISTS objetivos
  ADD COLUMN IF NOT EXISTS valor_acumulado NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Um CHECK por regra: o nome da constraint no erro 23514 indica o campo (API -> 400)
DO $$
DECLARE
  c record;
BEGIN
  IF to_regclass('public.objetivos') IS NULL THEN
    RETURN;
  END IF;

  FOR c IN
    SELECT * FROM (VALUES
      ('ck_objetivos_valor_objetivo',  'valor_objetivo > 0'),
      ('ck_objetivos_valor_mensal',    'valor_mensal >= 0'),
      ('ck_objetivos_valor_acumulado', 'valor_acumulado >= 0')
    ) AS v(nome, expr)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = c.nome AND conrelid = 'public.objetivos'::regclass
    ) THEN
      EXECUTE format('ALTER TABLE objetivos ADD CONSTRAINT %I CHECK (%s) NOT VALID', c.nome, c.expr);
    END IF;
  END LOOP;
END
$$;

INSERT INTO schema_migrations (version) VALUES ('009_objetivos_progresso')
ON CONFLICT (version) DO NOTHING;
