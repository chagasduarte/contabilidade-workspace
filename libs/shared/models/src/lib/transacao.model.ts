export type TipoTransacao = 'entrada' | 'saida' | 'cartao';
export type StatusTransacao = 'pendente' | 'pago';

export interface Transacao {
  id: number | string;
  descricao: string;
  tipo: TipoTransacao;
  valor: number | string;
  categoria?: string | number | null;
  data: string;
  status: StatusTransacao;
  origem?: string;
  origem_rotulo?: string;
  target_id?: string;
  source_type?: string;
  source_id?: string;
  cartaoid?: number | null;
  pagamento?: string | null;
  ispaycart?: boolean | null;
  idcategoria?: number | null;
  criado_em?: string | Date | null;
  created_at?: string | Date | null;
  recorrencia?: string | null;
  parent_recurrence_id?: string | null;
  is_recorrente?: boolean;
}

export interface CreateTransacaoDto {
  tipo: TipoTransacao;
  descricao: string;
  valor: number;
  categoria?: string | number | null;
  idcategoria?: number | null;
  data: string | Date;
  pagamento?: string | Date | null;
  status?: StatusTransacao;
  ispaycart?: boolean;
  cartaoid?: number | string | null;
}

export interface CreateParceladaDto {
  descricao: string;
  valor: number;
  categoria?: string | number | null;
  idcategoria?: number | null;
  data: string | Date;
  pagamento?: string | Date | null;
  parcelado?: boolean;
  ispaycart?: boolean;
  cartaoid?: number | string | null;
  tipo?: TipoTransacao;
  parcelas: {
    QtdParcelas: number | string;
    Valor: number | string;
  };
}

export interface ResumoTransacoesSaida {
  soma_parcelados: number;
  soma_adicionais: number;
  soma_pagos: number;
  parceladas: Transacao[];
  adicionais: Transacao[];
  pagos: Transacao[];
}

export interface ResumoTransacoesEntrada {
  soma_receber: number;
  soma_recebidos: number;
  entradas_receber: Transacao[];
  entradas_recebidas: Transacao[];
}

