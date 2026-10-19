// card.model.ts

export type InvoiceStatus = 'OPEN' | 'CLOSED' | 'PAID' | 'OVERDUE';

/**
 * 1. Cartão de Crédito (credit_cards)
 */
export interface CreditCard {
  id: string;
  usuario_id: number;
  nome: string;
  bandeira?: string | null;
  limite_total: number;
  dia_fechamento: number;
  dia_vencimento: number;
  cor_identificacao?: string | null;
  ativo: boolean;
  criado_em?: Date | string;
  atualizado_em?: Date | string;
}

/**
 * 2. Fatura do Cartão (card_invoices)
 */
export interface CardInvoice {
  id: string;
  cartao_id: string;
  mes_referencia: number;
  ano_referencia: number;
  data_fechamento: Date | string;
  data_vencimento: Date | string;
  status: InvoiceStatus;
  data_pagamento?: Date | string | null;
  valor_pago?: number | null;
  total_fatura?: number;
  itens_count?: number;
  criado_em?: Date | string;
  atualizado_em?: Date | string;
}

/**
 * 3. Transação / Compra no Cartão (card_transactions)
 */
export interface CardTransaction {
  id: string;
  cartao_id: string;
  categoria_id?: number | null;
  descricao: string;
  valor_total: number;
  quantidade_parcelas: number;
  data_compra: Date | string;
  criado_em?: Date | string;
}

/**
 * 4. Item de Fatura / Parcela (invoice_items)
 */
export interface InvoiceItem {
  id: string;
  fatura_id: string;
  transacao_id: string;
  numero_parcela: number;
  valor_parcela: number;
  descricao?: string;
  data_compra?: Date | string;
  quantidade_parcelas?: number;
  categoria_id?: number | null;
  categoria_nome?: string | null;
  categoria_cor?: string | null;
  categoria_icone?: string | null;
  criado_em?: Date | string;
}

/**
 * DTOs para comunicação Frontend <-> Backend
 */

export interface CreateCardDto {
  nome: string;
  bandeira?: string;
  limite_total: number;
  dia_fechamento: number;
  dia_vencimento: number;
  cor_identificacao?: string;
}

export interface CreateTransactionDto {
  cartao_id: string;
  descricao: string;
  valor_total: number;
  quantidade_parcelas: number;
  data_compra: string | Date;
  categoria_id?: number | null;
}

export interface PayInvoiceDto {
  fatura_id?: string;
  valor_pago?: number;
  data_pagamento?: string | Date;
}

export interface CardDetailsResponseDto {
  cartao: CreditCard;
  limite_total: number;
  limite_comprometido: number;
  limite_disponivel: number;
  fatura_atual?: CardInvoice;
  faturas?: CardInvoice[];
}

export interface InvoiceDetailsResponseDto {
  fatura: CardInvoice;
  cartao: CreditCard;
  itens: InvoiceItem[];
  valor_total: number;
}

