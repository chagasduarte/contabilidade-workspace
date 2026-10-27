-- ==============================================================================
-- MANUAL - ALTERA DADOS: só rodar com aprovação do Maestro ('Claude Code').
-- Preenche parcela_grupo_id/numero/total (migration 004) nas parcelas legadas
-- identificadas por descricao LIKE '%- Parcela'.
--
-- Heurística: grupo = (userid, cartaoid, descricao). LIMITAÇÃO: duas compras
-- diferentes com a mesma descrição no mesmo cartão viram um grupo só (é o mesmo
-- agrupamento que a API já faz hoje em GET /transacoes/parceladas).
-- Rode primeiro com ROLLBACK para conferir os números; troque por COMMIT depois.
-- ==============================================================================
BEGIN;

WITH grupos AS (
  SELECT userid, cartaoid, descricao, gen_random_uuid() AS grupo_id, COUNT(*) AS total
  FROM transacoes
  WHERE tipo = 'saida' AND descricao LIKE '%- Parcela' AND parcela_grupo_id IS NULL
  GROUP BY userid, cartaoid, descricao
),
numeradas AS (
  SELECT t.id, g.grupo_id, g.total,
         ROW_NUMBER() OVER (PARTITION BY g.grupo_id ORDER BY t.data, t.id) AS numero
  FROM transacoes t
  JOIN grupos g
    ON g.userid = t.userid
   AND g.cartaoid IS NOT DISTINCT FROM t.cartaoid
   AND g.descricao = t.descricao
  WHERE t.tipo = 'saida' AND t.parcela_grupo_id IS NULL
)
UPDATE transacoes t
SET parcela_grupo_id = n.grupo_id, parcela_numero = n.numero, parcela_total = n.total
FROM numeradas n
WHERE n.id = t.id;

SELECT COUNT(*) AS linhas_com_grupo, COUNT(DISTINCT parcela_grupo_id) AS grupos
FROM transacoes WHERE parcela_grupo_id IS NOT NULL;

ROLLBACK; -- trocar por COMMIT após conferência
