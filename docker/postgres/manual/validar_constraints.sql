-- ==============================================================================
-- MANUAL (não é executado pelo migrate.sh)
-- 1) Rode a seção DIAGNÓSTICO (somente leitura). Cada linha com qtd > 0 é dado
--    legado que viola a constraint NOT VALID criada em 003.
-- 2) Corrija os dados (exige aprovação do Maestro - altera dados de produção).
-- 3) Rode a seção VALIDATE: verifica linhas antigas com SHARE UPDATE EXCLUSIVE
--    (não bloqueia leitura nem escrita).
-- ==============================================================================

-- DIAGNÓSTICO -------------------------------------------------------------------
SELECT 'fk_transacoes_usuario' AS constraint, COUNT(*) AS qtd FROM transacoes t
  WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = t.userid)
UNION ALL SELECT 'fk_planned_tx_usuario', COUNT(*) FROM planned_transactions p
  WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = p.userid)
UNION ALL SELECT 'fk_credit_cards_usuario', COUNT(*) FROM credit_cards c
  WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = c.usuario_id)
UNION ALL SELECT 'fk_cartoes_usuario', COUNT(*) FROM cartoes c
  WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = c.userid)
UNION ALL SELECT 'fk_planejamento_usuario', COUNT(*) FROM planejamento p
  WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = p.userid)
UNION ALL SELECT 'fk_objetivos_usuario', COUNT(*) FROM objetivos o
  WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = o.usuario_id)
UNION ALL SELECT 'fk_transacoes_cartao', COUNT(*) FROM transacoes t
  WHERE t.cartaoid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cartoes c WHERE c.id = t.cartaoid)
UNION ALL SELECT 'ck_transacoes_tipo (estrito, após normalizar_tipo_transacoes.sql)', COUNT(*) FROM transacoes
  WHERE tipo NOT IN ('entrada', 'saida', 'cartao')
UNION ALL SELECT 'ck_transacoes_status', COUNT(*) FROM transacoes
  WHERE status NOT IN ('pendente', 'pago')
UNION ALL SELECT 'ck_credit_cards_dias', COUNT(*) FROM credit_cards
  WHERE dia_fechamento NOT BETWEEN 1 AND 31 OR dia_vencimento NOT BETWEEN 1 AND 31
UNION ALL SELECT 'ck_credit_cards_limite', COUNT(*) FROM credit_cards WHERE limite_total < 0
UNION ALL SELECT 'ck_cartoes_dias', COUNT(*) FROM cartoes
  WHERE dia_fatura NOT BETWEEN 1 AND 31 OR dia_vencimento NOT BETWEEN 1 AND 31
UNION ALL SELECT 'ck_card_invoices_mes', COUNT(*) FROM card_invoices WHERE mes_referencia NOT BETWEEN 1 AND 12
UNION ALL SELECT 'ck_card_tx_parcelas', COUNT(*) FROM card_transactions
  WHERE quantidade_parcelas < 1 OR valor_total <= 0
UNION ALL SELECT 'ck_invoice_items_parcela', COUNT(*) FROM invoice_items WHERE numero_parcela < 1
UNION ALL SELECT 'ck_loans_valores', COUNT(*) FROM loans
  WHERE principal_amount <= 0 OR monthly_interest_rate < 0
UNION ALL SELECT 'ck_loan_installments_numero', COUNT(*) FROM loan_installments WHERE installment_number < 1
UNION ALL SELECT 'fk_loans_usuario (006)', COUNT(*) FROM loans l
  WHERE l.usuario_id IS NULL OR NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = l.usuario_id)
UNION ALL SELECT 'fk_categoria_usuario (005)', COUNT(*) FROM categoria c
  WHERE c.userid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = c.userid)
UNION ALL SELECT 'fk_subcategoria_usuario (005)', COUNT(*) FROM subcategoria s
  WHERE s.userid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = s.userid)
UNION ALL SELECT 'fk_transacoes_subcategoria (008)', COUNT(*) FROM transacoes t
  WHERE t.idsubcategoria IS NOT NULL AND NOT EXISTS (SELECT 1 FROM subcategoria s WHERE s.id = t.idsubcategoria)
UNION ALL SELECT 'ck_objetivos_valor_objetivo (009)', COUNT(*) FROM objetivos WHERE valor_objetivo <= 0
UNION ALL SELECT 'ck_objetivos_valor_mensal (009)', COUNT(*) FROM objetivos WHERE valor_mensal < 0
UNION ALL SELECT 'ck_objetivos_valor_acumulado (009)', COUNT(*) FROM objetivos WHERE valor_acumulado < 0;

-- Padrão de parcela: linhas que o ILIKE antigo pegava e o LIKE padronizado não pega
SELECT COUNT(*) AS parcelas_fora_do_padrao FROM transacoes
WHERE descricao ILIKE '%- Parcela' AND descricao NOT LIKE '%- Parcela';
SELECT COUNT(*) AS like_sem_hifen FROM transacoes
WHERE descricao LIKE '%Parcela' AND descricao NOT LIKE '%- Parcela';

-- VALIDATE (só depois que todo o diagnóstico der 0) --------------------------------
-- ALTER TABLE transacoes           VALIDATE CONSTRAINT fk_transacoes_usuario;
-- ALTER TABLE planned_transactions VALIDATE CONSTRAINT fk_planned_tx_usuario;
-- ALTER TABLE credit_cards         VALIDATE CONSTRAINT fk_credit_cards_usuario;
-- ALTER TABLE cartoes              VALIDATE CONSTRAINT fk_cartoes_usuario;
-- ALTER TABLE planejamento         VALIDATE CONSTRAINT fk_planejamento_usuario;
-- ALTER TABLE objetivos            VALIDATE CONSTRAINT fk_objetivos_usuario;
-- ALTER TABLE transacoes           VALIDATE CONSTRAINT fk_transacoes_cartao;
-- ALTER TABLE transacoes           VALIDATE CONSTRAINT ck_transacoes_tipo;
-- ALTER TABLE transacoes           VALIDATE CONSTRAINT ck_transacoes_status;
-- ALTER TABLE credit_cards         VALIDATE CONSTRAINT ck_credit_cards_dias;
-- ALTER TABLE credit_cards         VALIDATE CONSTRAINT ck_credit_cards_limite;
-- ALTER TABLE cartoes              VALIDATE CONSTRAINT ck_cartoes_dias;
-- ALTER TABLE card_invoices        VALIDATE CONSTRAINT ck_card_invoices_mes;
-- ALTER TABLE card_transactions    VALIDATE CONSTRAINT ck_card_tx_parcelas;
-- ALTER TABLE invoice_items        VALIDATE CONSTRAINT ck_invoice_items_parcela;
-- ALTER TABLE loans                VALIDATE CONSTRAINT ck_loans_valores;
-- ALTER TABLE loan_installments    VALIDATE CONSTRAINT ck_loan_installments_numero;
-- ALTER TABLE loans                VALIDATE CONSTRAINT fk_loans_usuario;
-- ALTER TABLE categoria            VALIDATE CONSTRAINT fk_categoria_usuario;
-- ALTER TABLE subcategoria         VALIDATE CONSTRAINT fk_subcategoria_usuario;
-- ALTER TABLE transacoes           VALIDATE CONSTRAINT fk_transacoes_subcategoria;
-- ALTER TABLE objetivos            VALIDATE CONSTRAINT ck_objetivos_valor_objetivo;
-- ALTER TABLE objetivos            VALIDATE CONSTRAINT ck_objetivos_valor_mensal;
-- ALTER TABLE objetivos            VALIDATE CONSTRAINT ck_objetivos_valor_acumulado;
