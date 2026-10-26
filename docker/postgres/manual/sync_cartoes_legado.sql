-- ==============================================================================
-- MANUAL - INSERE DADOS: só rodar com aprovação do Maestro ('Claude Code').
-- Aditivo (só INSERT, nada é alterado/removido). Copia para a tabela legada
-- `cartoes` os cartões ativos de `credit_cards` que ainda não têm par (mesmo dono
-- e mesmo nome, ignorando caixa/espaços) - a mesma regra do INSERT que hoje roda
-- a cada GET em CartaoRepository.listar. Depois de rodar (COMMIT), o BackEnd
-- remove esse INSERT do caminho de leitura.
-- Idempotente: rodar de novo não insere nada (WHERE NOT EXISTS).
-- Rode primeiro como está (termina em ROLLBACK) para conferir as contagens.
-- ==============================================================================
BEGIN;

-- Antes: quantos cartões modernos estão sem par no legado
SELECT COUNT(*) AS faltando_no_legado
FROM credit_cards cc
WHERE cc.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM cartoes c
    WHERE c.userid = cc.usuario_id AND LOWER(TRIM(c.nome)) = LOWER(TRIM(cc.nome))
  );

INSERT INTO cartoes (nome, dia_fatura, dia_vencimento, limite, userid)
SELECT cc.nome, cc.dia_fechamento, cc.dia_vencimento, cc.limite_total, cc.usuario_id
FROM credit_cards cc
WHERE cc.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM cartoes c
    WHERE c.userid = cc.usuario_id AND LOWER(TRIM(c.nome)) = LOWER(TRIM(cc.nome))
  )
ORDER BY cc.usuario_id, cc.criado_em;

-- Depois: deve dar 0
SELECT COUNT(*) AS faltando_no_legado_depois
FROM credit_cards cc
WHERE cc.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM cartoes c
    WHERE c.userid = cc.usuario_id AND LOWER(TRIM(c.nome)) = LOWER(TRIM(cc.nome))
  );

ROLLBACK; -- trocar por COMMIT após conferência
