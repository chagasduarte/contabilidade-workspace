-- ==============================================================================
-- RASCUNHO - FASE 3 - ALTERA DADOS: só rodar com aprovação do Maestro ('Claude Code').
-- Preenche transacoes.idsubcategoria (migration 008) a partir da coluna legada
-- transacoes.categoria, que guarda o id da SUBCATEGORIA (agrupamentoTipo usa
-- "categoria AS subcategoria").
--
-- Armadilha: o settlement (PLANNED / LOAN_INSTALLMENT) grava em `categoria` o id da
-- CATEGORIA (categoria = idcategoria), não de subcategoria. Por isso só preenche
-- quando o par é coerente:
--   * subcategoria s.id = t.categoria E s.idcategoria = t.idcategoria;
--   * linha não veio do settlement;
--   * subcategoria global ou do próprio dono (migration 005).
-- Casos ambíguos (idcategoria NULL, par incoerente) NÃO são preenchidos: só contados.
-- Idempotente (só idsubcategoria IS NULL). Termina em ROLLBACK.
-- ==============================================================================
BEGIN;

-- Diagnóstico antes
SELECT
  COUNT(*) FILTER (WHERE t.categoria IS NOT NULL)                            AS com_categoria_legada,
  COUNT(*) FILTER (WHERE t.categoria IS NOT NULL AND t.idcategoria IS NULL)  AS sem_idcategoria_ambiguo,
  COUNT(*) FILTER (WHERE t.categoria IS NOT NULL
                   AND t.source_type IN ('PLANNED', 'LOAN_INSTALLMENT'))     AS do_settlement_ignorado
FROM transacoes t
WHERE t.idsubcategoria IS NULL;

UPDATE transacoes t
SET idsubcategoria = s.id
FROM subcategoria s
WHERE t.idsubcategoria IS NULL
  AND t.categoria IS NOT NULL
  AND s.id = t.categoria
  AND s.idcategoria = t.idcategoria
  AND (t.source_type IS NULL OR t.source_type NOT IN ('PLANNED', 'LOAN_INSTALLMENT'))
  AND (s.userid IS NULL OR s.userid = t.userid);

-- Depois: o que sobrou com categoria legada e sem idsubcategoria (revisar à mão)
SELECT
  COUNT(*) FILTER (WHERE idsubcategoria IS NOT NULL)                         AS preenchidas,
  COUNT(*) FILTER (WHERE idsubcategoria IS NULL AND categoria IS NOT NULL
                   AND (source_type IS NULL
                        OR source_type NOT IN ('PLANNED', 'LOAN_INSTALLMENT'))) AS restantes_para_revisar
FROM transacoes;

ROLLBACK; -- trocar por COMMIT após conferência
-- Depois do COMMIT (fora da transação):
-- ALTER TABLE transacoes VALIDATE CONSTRAINT fk_transacoes_subcategoria;
