-- ==============================================================================
-- MANUAL - DROP (aprovado em 2026-10-26, item c). Só depois do EXPLAIN do RUNBOOK passo 6;
-- cada índice que aparecer em algum plano fica (comente a linha dele).
-- Remove índices que ficaram redundantes após 002/003 (só custam escrita/espaço).
-- Rodar fora de transação (CONCURRENTLY não bloqueia a tabela).
-- Conferir antes que não são usados:
--   SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes ORDER BY idx_scan;
-- ==============================================================================

-- prefixo de idx_transacoes_userid_data_id (userid, data, id).
-- MANTIDO por padrão: na simulação o planner o usa em GET /transacoes (Q1) e em
-- getSaldoAtual. Só descomente se o EXPLAIN do passo 6 do RUNBOOK não o mostrar.
-- DROP INDEX CONCURRENTLY IF EXISTS idx_transacoes_userid_data;
-- coberto por uq_transacoes_source - SÓ rode se ele existir:
--   SELECT to_regclass('uq_transacoes_source');  -- não pode ser NULL
DROP INDEX CONCURRENTLY IF EXISTS idx_transacoes_source;
-- baixa seletividade (2 valores); os parciais por status atendem as queries
DROP INDEX CONCURRENTLY IF EXISTS idx_transacoes_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_planned_tx_status;
