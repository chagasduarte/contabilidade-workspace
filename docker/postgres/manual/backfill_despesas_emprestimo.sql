-- ==============================================================================
-- ALTERA DADOS: só rodar com aprovação do Maestro ('Claude Code').
-- Cria em `transacoes` a despesa paga das parcelas de empréstimo quitadas pela tela do
-- empréstimo (POST /loans/pagamentos) antes da correção que passou a registrá-la.
-- Esses pagamentos estão em `loan_payments`, mas o gasto não aparece em Lançamentos,
-- no dashboard nem no planejamento.
--
-- Mesmo formato da liquidação (/loans/installments/:id/settle e LoanPaymentRepository):
-- tipo 'saida', status 'pago', source_type 'LOAN_INSTALLMENT', source_id = parcela,
-- data/pagamento = data do pagamento, valor = valor pago.
--
-- Regras:
--   * só parcelas sem despesa LOAN_INSTALLMENT já registrada (idempotente);
--   * 1 despesa por parcela (se houver mais de um pagamento, usa o mais recente);
--   * dono = loans.usuario_id; sem ele (backfill_loans_usuario não rodado), o user_id
--     legado só é aceito se for um número (ex.: '1' ou uuid '00000000-...-000000000001');
--   * pagamentos sem parcela ou sem dono identificável NÃO são inseridos: só contados.
-- Termina em ROLLBACK.
-- ==============================================================================
BEGIN;

CREATE TEMP TABLE pagamentos_sem_despesa ON COMMIT DROP AS
SELECT DISTINCT ON (lp.installment_id)
  lp.installment_id,
  lp.payment_date,
  lp.amount_paid,
  li.installment_number,
  l.institution_name,
  COALESCE(
    l.usuario_id,
    CASE WHEN regexp_replace(l.user_id::text, '^[0-]+', '') ~ '^[0-9]+$'
         THEN regexp_replace(l.user_id::text, '^[0-]+', '')::int END
  ) AS userid
FROM loan_payments lp
JOIN loan_installments li ON li.id = lp.installment_id
JOIN loans l ON l.id = li.loan_id
WHERE lp.installment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM transacoes t
    WHERE t.source_type = 'LOAN_INSTALLMENT' AND t.source_id = lp.installment_id::text
  )
ORDER BY lp.installment_id, lp.payment_date DESC, lp.created_at DESC;

-- Diagnóstico antes
SELECT
  COUNT(*)                                                         AS parcelas_sem_despesa,
  COUNT(*) FILTER (WHERE userid IS NULL)                           AS sem_dono_ignoradas,
  COUNT(*) FILTER (WHERE userid IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = userid)) AS dono_inexistente_ignoradas,
  COALESCE(SUM(amount_paid) FILTER (WHERE userid IS NOT NULL), 0)  AS valor_a_registrar,
  (SELECT COUNT(*) FROM loan_payments WHERE installment_id IS NULL) AS pagamentos_sem_parcela_ignorados
FROM pagamentos_sem_despesa;

INSERT INTO transacoes (descricao, tipo, valor, data, status, userid, source_type, source_id, pagamento)
SELECT
  'Parcela Empréstimo #' || p.installment_number || COALESCE(' - ' || NULLIF(p.institution_name, ''), ''),
  'saida',
  p.amount_paid,
  p.payment_date,
  'pago',
  p.userid,
  'LOAN_INSTALLMENT',
  p.installment_id::text,
  p.payment_date
FROM pagamentos_sem_despesa p
WHERE p.userid IS NOT NULL
  AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = p.userid);

-- Depois: o esperado é 0 (sobram só as ignoradas acima)
SELECT COUNT(*) AS parcelas_pagas_ainda_sem_despesa
FROM loan_payments lp
WHERE lp.installment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM transacoes t
    WHERE t.source_type = 'LOAN_INSTALLMENT' AND t.source_id = lp.installment_id::text
  );

ROLLBACK; -- trocar por COMMIT após conferência
