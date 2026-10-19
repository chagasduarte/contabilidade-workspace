export interface TransacaoEntity {
  id: number | string;
  tipo: 'entrada' | 'saida' | 'cartao';
  descricao: string;
  valor: number | string;
  categoria?: string | number | null;
  data: string | Date;
  status: 'pendente' | 'pago';
  userid: number;
  ispaycart?: boolean | null;
  cartaoid?: number | string | null;
  pagamento?: string | Date | null;
  idcategoria?: number | null;
  source_type?: string | null;
  source_id?: string | null;
  criado_em?: string | Date | null;
  created_at?: string | Date | null;
}

export interface CreateTransacaoDto {
  tipo: 'entrada' | 'saida' | 'cartao';
  descricao: string;
  valor: number;
  categoria?: string | number | null;
  idcategoria?: number | null;
  data: string | Date;
  pagamento?: string | Date | null;
  status?: 'pendente' | 'pago';
  ispaycart?: boolean;
  cartaoid?: number | string | null;
  source_type?: string | null;
  source_id?: string | null;
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
  tipo?: 'entrada' | 'saida' | 'cartao';
  parcelas: {
    QtdParcelas: number | string;
    Valor: number | string;
  };
}

export interface InitialTransactionItem {
  description?: string;
  descricao?: string;
  value?: number | string;
  valor?: number | string;
  day_of_month: number | string;
  category?: string;
  categoria?: string;
}

export interface InitialUserTransactionsDto {
  entradas: InitialTransactionItem[];
  saidas: InitialTransactionItem[];
}

export interface DespesaParceladaItem {
  descricao: string;
  total_parcelado: string | number;
  total_pago: string | number;
  total_pendente: string | number;
  qtd_parcelas: string | number;
  qtd_parcelas_pagas: string | number;
  valor_pendente_mes: string | number;
  status: 'pendente' | 'pago';
}

export interface LinhaTemporalItem {
  total_parcelas: string | number;
  data_fim: string | Date;
  data_inicio: string | Date;
  descricao: string;
}

