// card.entity.ts

export type InvoiceStatus = 'OPEN' | 'CLOSED' | 'PAID' | 'OVERDUE';

/**
 * Entidade que mapeia a tabela `credit_cards`
 */
export interface CreditCardEntity {
  id: string;
  usuario_id: number;
  nome: string;
  bandeira?: string | null;
  limite_total: number;
  dia_fechamento: number;
  dia_vencimento: number;
  cor_identificacao: string;
  ativo: boolean;
  criado_em?: Date;
  atualizado_em?: Date;
}

/**
 * Entidade que mapeia a tabela `card_invoices`
 */
export interface CardInvoiceEntity {
  id: string;
  cartao_id: string;
  mes_referencia: number;
  ano_referencia: number;
  data_fechamento: Date;
  data_vencimento: Date;
  status: InvoiceStatus;
  data_pagamento?: Date | null;
  valor_pago?: number | null;
  total_fatura?: number;
  itens_count?: number;
  criado_em?: Date;
  atualizado_em?: Date;
}

/**
 * Entidade que mapeia a tabela `card_transactions`
 */
export interface CardTransactionEntity {
  id: string;
  cartao_id: string;
  categoria_id?: number | null;
  descricao: string;
  valor_total: number;
  quantidade_parcelas: number;
  data_compra: Date;
  criado_em?: Date;
}

/**
 * Entidade que mapeia a tabela `invoice_items`
 */
export interface InvoiceItemEntity {
  id: string;
  fatura_id: string;
  transacao_id: string;
  numero_parcela: number;
  valor_parcela: number;
  descricao?: string;
  data_compra?: Date;
  quantidade_parcelas?: number;
  categoria_id?: number | null;
  categoria_nome?: string | null;
  categoria_cor?: string | null;
  categoria_icone?: string | null;
  criado_em?: Date;
}


/**
 * source_type a usar em `transacoes` se o pagamento de fatura passar a gerar lançamento na conta.
 * As parcelas já são contadas via invoice_items; relatórios (ex.: planejado x realizado) excluem
 * esse source_type para não contar a mesma compra duas vezes.
 */
export const SOURCE_TYPE_PAGAMENTO_FATURA = 'CREDIT_CARD_INVOICE_PAYMENT';
