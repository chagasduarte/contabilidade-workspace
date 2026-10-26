-- ==============================================================================
-- MANUAL - ALTERA DADOS (aprovado em 2026-10-26, item d). Ver RUNBOOK.md.
-- PRÉ-REQUISITO: a API já em produção com a correção P1 (settlement grava
-- 'entrada'/'saida'). Senão o CHECK novo rejeita os próximos settlements.
-- 1) Normaliza RECEITA -> entrada e DESPESA -> saida nas linhas antigas.
-- 2) Troca ck_transacoes_tipo pela versão estrita ('entrada','saida','cartao').
-- Tudo numa transação; termina em ROLLBACK: conferir e trocar por COMMIT.
-- ==============================================================================
BEGIN;

SELECT tipo, COUNT(*) FROM transacoes GROUP BY tipo ORDER BY tipo;

UPDATE transacoes
SET tipo = CASE tipo WHEN 'RECEITA' THEN 'entrada' ELSE 'saida' END
WHERE tipo IN ('RECEITA', 'DESPESA');

-- Esperado: só entrada / saida / cartao
SELECT tipo, COUNT(*) FROM transacoes GROUP BY tipo ORDER BY tipo;

ALTER TABLE transacoes DROP CONSTRAINT IF EXISTS ck_transacoes_tipo;
ALTER TABLE transacoes ADD CONSTRAINT ck_transacoes_tipo
  CHECK (tipo IN ('entrada', 'saida', 'cartao')) NOT VALID;

ROLLBACK; -- trocar por COMMIT após conferência
-- Depois do COMMIT (fora da transação):
-- ALTER TABLE transacoes VALIDATE CONSTRAINT ck_transacoes_tipo;
