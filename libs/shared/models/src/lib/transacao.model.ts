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
  idsubcategoria?: number | null;
  categoria_nome?: string | null;
  subcategoria_nome?: string | null;
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
  /** @deprecated use `idsubcategoria` (fase 2 do contrato de categorias). */
  categoria?: string | number | null;
  idcategoria?: number | null;
  idsubcategoria?: number | null;
  data: string | Date;
  pagamento?: string | Date | null;
  status?: StatusTransacao;
  ispaycart?: boolean;
  cartaoid?: number | string | null;
}

export interface CreateParceladaDto {
  descricao: string;
  valor: number;
  /** @deprecated use `idsubcategoria` (fase 2 do contrato de categorias). */
  categoria?: string | number | null;
  idcategoria?: number | null;
  idsubcategoria?: number | null;
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


export interface ExtratoFiltros {
  tipo?: 'entrada' | 'saida';
  status?: 'pago' | 'pendente';
}

export interface ExtratoTotais {
  entradas: number;
  saidas: number;
  pendentes: number;
  entradas_pagas?: number;
  entradas_pendentes?: number;
  saidas_pagas?: number;
  saidas_pendentes?: number;
}

/** Resposta de `GET /transacoes/extrato?paginado=true` (cursor opaco). */
export interface ExtratoPaginado {
  items: Transacao[];
  next_cursor: string | null;
  /** Opcional: totais do mês inteiro, independentes da página (pedido ao BackEnd). */
  totais?: ExtratoTotais | null;
}
