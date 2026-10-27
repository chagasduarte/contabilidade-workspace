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
  /** Subcategoria (fase 1 da semântica de categoria). */
  idsubcategoria?: number | null;
  /** Nome da categoria (idcategoria); null quando não houver. */
  categoria_nome?: string | null;
  /** Nome da subcategoria (idsubcategoria); null quando não houver. */
  subcategoria_nome?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  criado_em?: string | Date | null;
  created_at?: string | Date | null;
}

export interface CreateTransacaoDto {
  tipo: 'entrada' | 'saida' | 'cartao';
  descricao: string;
  valor: number;
  /** @deprecated Legado: subcategoria ou a própria categoria. Use idsubcategoria. */
  categoria?: string | number | null;
  idcategoria?: number | null;
  /** Subcategoria opcional; precisa ser visível ao usuário e pertencer a idcategoria. */
  idsubcategoria?: number | string | null;
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
  /** @deprecated Legado: subcategoria ou a própria categoria. Use idsubcategoria. */
  categoria?: string | number | null;
  idcategoria?: number | null;
  idsubcategoria?: number | string | null;
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


/** Janela de consulta: conta corrente (cartaoid null) ou cartão legado com seu período de fatura. */
export interface PeriodoConsulta {
  cartaoid: number | null;
  inicio: string; // YYYY-MM-DD
  fim: string; // YYYY-MM-DD (inclusivo)
}

/** Linha para inserção em lote, com o grupo de parcelamento (migration 004). */
export interface TransacaoLoteItem extends CreateTransacaoDto {
  parcela_grupo_id?: string | null;
  parcela_numero?: number | null;
  parcela_total?: number | null;
}

/** Totais do período inteiro do extrato (independem do cursor/página). */
export interface ExtratoTotais {
  /** Soma dos valores com tipo 'entrada'. */
  entradas: number;
  /** Soma dos valores dos demais tipos ('saida', 'cartao'...), como a tela de Lançamentos classifica. */
  saidas: number;
  /** QUANTIDADE de lançamentos com status 'pendente' (não é soma de valores). */
  pendentes: number;
}

/** Cursor keyset do extrato: última (data, id) da página anterior. */
export interface ExtratoCursor {
  data: string; // YYYY-MM-DD
  id: number;
}

/** Linha de GET /transacoes/agrupadaPorTipos. Nomes são null quando não houver. */
export interface AgrupamentoTipoItem {
  total_tipo: string;
  idcategoria: number | null;
  /** @deprecated Valor legado da coluna `categoria` (subcategoria ou a própria categoria). */
  subcategoria: string;
  idsubcategoria: number | null;
  categoria_nome: string | null;
  subcategoria_nome: string | null;
}

/** Transação inexistente ou de outro usuário (controllers respondem 404). */
export class TransacaoNotFoundError extends Error {
  constructor(message = 'Transação não encontrada.') {
    super(message);
    this.name = 'TransacaoNotFoundError';
  }
}
