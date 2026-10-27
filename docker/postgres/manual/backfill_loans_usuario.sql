-- ==============================================================================
-- MANUAL - ALTERA DADOS (aprovado em 2026-10-26, item d). Ver RUNBOOK.md.
-- Preenche loans.usuario_id (migration 006) a partir do UUID "fake" em user_id
-- ('00000000-0000-0000-0000-000000000007' -> 7) ou de user_id numérico.
-- Idempotente (só linhas com usuario_id NULL). Termina em ROLLBACK: conferir e
-- trocar por COMMIT.
-- ==============================================================================
BEGIN;

UPDATE loans SET usuario_id = CASE
    WHEN user_id ~ '^\d+$' THEN user_id::int
    ELSE NULLIF(regexp_replace(split_part(user_id, '-', 5), '^0+', ''), '')::int
  END
WHERE usuario_id IS NULL;

-- Esperado: sem_dono = 0 e orfaos = 0. Se não for, NÃO dar COMMIT.
SELECT COUNT(*) FILTER (WHERE usuario_id IS NULL) AS sem_dono,
       COUNT(*) FILTER (WHERE usuario_id IS NOT NULL
                        AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = loans.usuario_id)) AS orfaos
FROM loans;

ROLLBACK; -- trocar por COMMIT após conferência
-- Depois do COMMIT (fora da transação):
-- ALTER TABLE loans VALIDATE CONSTRAINT fk_loans_usuario;
