-- ==============================================================================
-- Script de Inicialização do PostgreSQL para o Sistema de Contabilidade Pessoal
-- ==============================================================================

-- 1. Habilita extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 2. Tabela: usuarios
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    avatar TEXT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 3. Tabela: categoria
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categoria (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'despesa',
    cor VARCHAR(50) NULL DEFAULT '#3880ff',
    icone VARCHAR(100) NULL,
    idcategoria INTEGER NULL
);

-- ------------------------------------------------------------------------------
-- 4. Tabela: subcategoria
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subcategoria (
    id SERIAL PRIMARY KEY,
    idcategoria INTEGER NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    icone VARCHAR(100) NULL,
    cor VARCHAR(50) NULL DEFAULT '#3880ff'
);

-- ------------------------------------------------------------------------------
-- 5. Tabela: cartoes (Legado / Compatibilidade)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cartoes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    dia_fatura INTEGER NOT NULL DEFAULT 1,
    dia_vencimento INTEGER NOT NULL DEFAULT 10,
    limite NUMERIC(12, 2) NOT NULL DEFAULT 0,
    userid INTEGER NOT NULL
);

-- ------------------------------------------------------------------------------
-- 6. Tabela: credit_cards (Gestão Moderna de Cartões)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id INTEGER NOT NULL,
    nome VARCHAR(255) NOT NULL,
    bandeira VARCHAR(50) NULL,
    limite_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    dia_fechamento INTEGER NOT NULL DEFAULT 1,
    dia_vencimento INTEGER NOT NULL DEFAULT 10,
    cor_identificacao VARCHAR(50) NOT NULL DEFAULT '#6c757d',
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 7. Tabela: card_invoices (Faturas Mensais de Cartão)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cartao_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
    mes_referencia INTEGER NOT NULL,
    ano_referencia INTEGER NOT NULL,
    data_fechamento DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'PAID', 'OVERDUE')),
    data_pagamento DATE NULL,
    valor_pago NUMERIC(12, 2) NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),
    CONSTRAINT uq_cartao_mes_ano UNIQUE (cartao_id, mes_referencia, ano_referencia)
);

-- ------------------------------------------------------------------------------
-- 8. Tabela: card_transactions (Compras no Cartão)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cartao_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
    categoria_id INTEGER NULL REFERENCES categoria(id) ON DELETE SET NULL,
    descricao VARCHAR(255) NOT NULL,
    valor_total NUMERIC(12, 2) NOT NULL,
    quantidade_parcelas INTEGER NOT NULL DEFAULT 1,
    data_compra DATE NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 9. Tabela: invoice_items (Parcelas Distribuídas nas Faturas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fatura_id UUID NOT NULL REFERENCES card_invoices(id) ON DELETE CASCADE,
    transacao_id UUID NOT NULL REFERENCES card_transactions(id) ON DELETE CASCADE,
    numero_parcela INTEGER NOT NULL,
    valor_parcela NUMERIC(12, 2) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 10. Tabela: transacoes (Extrato Real / Movimentação de Conta Corrente)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transacoes (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    valor NUMERIC(12, 2) NOT NULL,
    categoria INTEGER NULL,
    idcategoria INTEGER NULL REFERENCES categoria(id) ON DELETE SET NULL,
    data DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente',
    userid INTEGER NOT NULL,
    ispaycart BOOLEAN NOT NULL DEFAULT false,
    cartaoid INTEGER NULL,
    pagamento DATE NULL,
    source_type VARCHAR(30) NULL,
    source_id VARCHAR(36) NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 11. Tabela: planned_transactions (Planejamento & Recorrência Deslizante)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planned_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userid INTEGER NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
    valor NUMERIC(12, 2) NOT NULL,
    data_prevista DATE NOT NULL,
    idcategoria INTEGER NULL REFERENCES categoria(id) ON DELETE SET NULL,
    recorrencia VARCHAR(20) NOT NULL DEFAULT 'NONE' CHECK (recorrencia IN ('NONE', 'MENSAL', 'SEMANAL', 'ANUAL')),
    data_limite_recorrencia DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SETTLED', 'SKIPPED', 'CANCELLED')),
    parent_recurrence_id UUID NULL REFERENCES planned_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 12. Tabela: loans (Contratos de Empréstimos e Financiamentos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(36) NOT NULL,
    institution_name VARCHAR(255) NOT NULL,
    principal_amount NUMERIC(12, 2) NOT NULL,
    monthly_interest_rate NUMERIC(8, 4) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAID_OFF', 'CANCELLED', 'DEFAULTED')),
    contracted_at DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 13. Tabela: loan_installments (Parcelas de Empréstimos / Amortização Price)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loan_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    original_amount NUMERIC(12, 2) NOT NULL,
    principal_component NUMERIC(12, 2) NOT NULL,
    interest_component NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 14. Tabela: loan_payments (Auditoria de Liquidações e Amortizações)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    installment_id UUID NULL REFERENCES loan_installments(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL,
    amount_paid NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    penalty_interest NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 15. Tabela: planejamento (Orçamentos Mensais por Categoria)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planejamento (
    id SERIAL PRIMARY KEY,
    categoria VARCHAR(255) NOT NULL,
    subcategoria VARCHAR(255) NULL,
    valor NUMERIC(12, 2) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    categoriaid INTEGER NOT NULL,
    subcategoriaid INTEGER NULL,
    data DATE NOT NULL,
    userid INTEGER NOT NULL
);

-- ------------------------------------------------------------------------------
-- 16. Tabela: objetivos (Metas Financeiras)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS objetivos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    valor_objetivo NUMERIC(12, 2) NOT NULL,
    valor_mensal NUMERIC(12, 2) NOT NULL,
    data_final DATE NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 17. Índices de Otimização e Performance
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_uniq ON usuarios(LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_nome_uniq ON usuarios(LOWER(nome));

CREATE INDEX IF NOT EXISTS idx_transacoes_userid_data ON transacoes(userid, data);
CREATE INDEX IF NOT EXISTS idx_transacoes_source ON transacoes(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_status ON transacoes(status);

CREATE INDEX IF NOT EXISTS idx_planned_tx_userid_date ON planned_transactions(userid, data_prevista);
CREATE INDEX IF NOT EXISTS idx_planned_tx_status ON planned_transactions(status);
CREATE INDEX IF NOT EXISTS idx_planned_tx_parent_rec ON planned_transactions(parent_recurrence_id);

CREATE INDEX IF NOT EXISTS idx_credit_cards_usuario ON credit_cards(usuario_id, ativo);
CREATE INDEX IF NOT EXISTS idx_card_invoices_cartao ON card_invoices(cartao_id, ano_referencia, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_card_tx_cartao ON card_transactions(cartao_id, data_compra);
CREATE INDEX IF NOT EXISTS idx_invoice_items_fatura ON invoice_items(fatura_id);

CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_loan_installments_loan ON loan_installments(loan_id, installment_number);
CREATE INDEX IF NOT EXISTS idx_loan_installments_due ON loan_installments(due_date, status);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id, installment_id);

-- ------------------------------------------------------------------------------
-- 18. Categorias e Subcategorias são cadastradas manualmente pelo usuário
-- ------------------------------------------------------------------------------


