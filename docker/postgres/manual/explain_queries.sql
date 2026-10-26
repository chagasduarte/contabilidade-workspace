-- ==============================================================================
-- MANUAL - SOMENTE LEITURA. EXPLAIN (ANALYZE, BUFFERS) das queries principais.
-- Uso (banco LOCAL):
--   docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
--     -v uid=<userid> -v ano=<ano> -v mes=<mes>' < docker/postgres/manual/explain_queries.sql \
--     > explain_$(date +%Y%m%d_%H%M).txt
-- Escolha um uid com MUITAS transações:
--   SELECT userid, COUNT(*) FROM transacoes GROUP BY 1 ORDER BY 2 DESC LIMIT 5;
-- O que olhar: "Seq Scan on transacoes" (ruim se a tabela for grande), "Rows Removed
-- by Filter" alto, "Buffers: shared read" alto, e o nome do índice usado.
-- ==============================================================================
\set ON_ERROR_STOP on
\pset pager off
SET search_path = public;

SELECT make_date(:ano, :mes, 1) AS inicio,
       ((make_date(:ano, :mes, 1) + interval '1 month')::date - 1) AS fim
\gset

\echo '=== Q1 GET /transacoes (conta + até 2 cartões do usuário)'
EXPLAIN (ANALYZE, BUFFERS)
WITH periodo AS (
  SELECT NULL::int AS cartaoid, :'inicio'::date AS inicio, :'fim'::date AS fim
  UNION ALL
  SELECT c.id, :'inicio'::date, :'fim'::date FROM (SELECT id FROM cartoes WHERE userid = :uid ORDER BY id LIMIT 2) c
)
SELECT t.id, t.status, t.descricao
FROM periodo p
JOIN transacoes t
  ON t.userid = :uid AND t.tipo = 'saida'
 AND ((t.status = 'pendente' AND t.pagamento BETWEEN p.inicio AND p.fim
       AND (CASE WHEN p.cartaoid IS NULL THEN t.ispaycart IS FALSE ELSE t.cartaoid = p.cartaoid END))
   OR (t.status = 'pago' AND t.data BETWEEN p.inicio AND p.fim
       AND t.cartaoid IS NOT DISTINCT FROM p.cartaoid))
ORDER BY t.data, t.id;

\echo '=== Q2 GET /transacoes/parceladas'
EXPLAIN (ANALYZE, BUFFERS)
WITH periodo AS (SELECT NULL::int AS cartaoid, :'inicio'::date AS inicio, :'fim'::date AS fim)
SELECT t.descricao, SUM(t.valor), COUNT(*)
FROM periodo p
JOIN transacoes t
  ON t.userid = :uid AND t.tipo = 'saida' AND t.descricao LIKE '%- Parcela'
 AND t.cartaoid IS NOT DISTINCT FROM p.cartaoid
GROUP BY p.cartaoid, t.descricao
HAVING bool_or(t.pagamento BETWEEN p.inicio AND p.fim);

\echo '=== Q4 extrato do mês (competência)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, descricao, data FROM transacoes t
WHERE t.userid = :uid
  AND (CASE WHEN cartaoid IS NOT NULL THEN pagamento ELSE data END) >= :'inicio'::date
  AND (CASE WHEN cartaoid IS NOT NULL THEN pagamento ELSE data END) <= :'fim'::date
ORDER BY t.data DESC, t.id DESC LIMIT 50;

\echo '=== Q4b extrato keyset (página seguinte)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, descricao, data FROM transacoes t
WHERE t.userid = :uid AND (t.data, t.id) < (:'fim'::date, 2147483647)
ORDER BY t.data DESC, t.id DESC LIMIT 50;

\echo '=== Q5 linhaTemporal'
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*), MIN(pagamento), MAX(pagamento), descricao
FROM transacoes t
WHERE t.userid = :uid AND t.tipo = 'saida' AND t.descricao LIKE '%- Parcela'
  AND t.pagamento >= make_date(:ano, 1, 1) AND t.pagamento < make_date(:ano + 1, 1, 1)
GROUP BY descricao;

\echo '=== somaTransacoes (pagamento no mês)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT SUM(valor) FROM transacoes
WHERE userid = :uid AND tipo = 'saida' AND status = 'pago'
  AND pagamento >= :'inicio'::date AND pagamento <= :'fim'::date;

\echo '=== dashboard getSaldoAtual'
EXPLAIN (ANALYZE, BUFFERS)
SELECT SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END)
FROM transacoes
WHERE userid = :uid AND status = 'pago' AND data <= :'fim'::date;

\echo '=== planned_transactions pendentes do mês'
EXPLAIN (ANALYZE, BUFFERS)
SELECT pt.id FROM planned_transactions pt
WHERE pt.userid = :uid AND pt.status = 'PENDING'
  AND pt.data_prevista BETWEEN :'inicio'::date AND :'fim'::date;

\echo '=== faturas abertas do usuário com vencimento no mês'
EXPLAIN (ANALYZE, BUFFERS)
SELECT ci.id, SUM(ii.valor_parcela)
FROM card_invoices ci
JOIN credit_cards c ON c.id = ci.cartao_id
LEFT JOIN invoice_items ii ON ii.fatura_id = ci.id
WHERE c.usuario_id = :uid AND ci.status <> 'PAID'
  AND ci.data_vencimento BETWEEN :'inicio'::date AND :'fim'::date
GROUP BY ci.id;

\echo '=== empréstimos (usuario_id, migration 006)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT li.id FROM loan_installments li
JOIN loans l ON l.id = li.loan_id
WHERE l.usuario_id = :uid AND li.status = 'PENDING'
  AND li.due_date BETWEEN :'inicio'::date AND :'fim'::date;

\echo '=== categorias do usuário + globais (migration 005)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM categoria WHERE (userid = :uid OR userid IS NULL) AND tipo = 'despesa' ORDER BY nome;

\echo '=== Uso dos índices (decide o DROP de remover_indices_redundantes.sql)'
SELECT relname AS tabela, indexrelname AS indice, idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) AS tamanho
FROM pg_stat_user_indexes
WHERE indexrelname IN ('idx_transacoes_userid_data', 'idx_transacoes_source',
                       'idx_transacoes_status', 'idx_planned_tx_status',
                       'idx_transacoes_userid_data_id', 'uq_transacoes_source')
ORDER BY relname, indexrelname;
