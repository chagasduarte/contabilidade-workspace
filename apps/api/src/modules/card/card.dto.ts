// card.dto.ts

import { CreditCardEntity, CardInvoiceEntity, InvoiceItemEntity } from './card.entity';

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
  cartao: CreditCardEntity;
  limite_total: number;
  limite_comprometido: number;
  limite_disponivel: number;
  fatura_atual?: CardInvoiceEntity;
  faturas?: CardInvoiceEntity[];
}

export interface InvoiceDetailsResponseDto {
  fatura: CardInvoiceEntity;
  cartao: CreditCardEntity;
  itens: InvoiceItemEntity[];
  valor_total: number;
}

