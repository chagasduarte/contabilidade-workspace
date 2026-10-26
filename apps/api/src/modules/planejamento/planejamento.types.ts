export type TipoPlanejamento = 'despesa' | 'receita';

export interface PlanejamentoEntity {
  id: number;
  /** Nome da categoria (preenchido pela API a partir de categoriaid). */
  categoria: string;
  /** Nome da subcategoria (preenchido pela API a partir de subcategoriaid). */
  subcategoria: string | null;
  valor: number;
  tipo: string;
  categoriaid: number;
  subcategoriaid: number | null;
  /** YYYY-MM-DD */
  data: string;
  userid: number;
}

export interface CreatePlanejamentoDto {
  categoriaid: number;
  subcategoriaid?: number | null;
  valor: number;
  /** Opcional: se omitido, usa o tipo da categoria. */
  tipo?: TipoPlanejamento;
  /** YYYY-MM-DD (mês de referência) */
  data: string;
}

/** Atualização parcial (data não muda: para outro mês, exclua e crie). */
export type UpdatePlanejamentoDto = Partial<Omit<CreatePlanejamentoDto, 'data'>>;

/** Linha já validada e com nomes resolvidos, pronta para gravar. */
export interface PlanejamentoGravacao {
  categoria: string;
  subcategoria: string | null;
  valor: number;
  tipo: TipoPlanejamento;
  categoriaid: number;
  subcategoriaid: number | null;
  data: string;
}

export interface AgrupamentoCategoriaPlanejamento {
  categoria: string;
  categoriaid: number;
  soma: number;
  planejamento: PlanejamentoEntity[];
}

export interface AgrupamentoTipoPlanejamento {
  tipo: string;
  soma: number;
  agrupamentoTipo: AgrupamentoCategoriaPlanejamento[];
}

/**
 * Planejado x realizado de uma categoria no mês. Realizado = conta corrente por competência +
 * parcelas de cartão das faturas do mês, separado em pago e pendente (o front decide como somar).
 */
export interface ResumoCategoriaPlanejamento {
  idcategoria: number;
  categoria_nome: string | null;
  planejado: number;
  /** Transações com status 'pago' + parcelas de faturas 'PAID'. */
  realizado_pago: number;
  /** Transações 'pendente' + parcelas de faturas ainda não pagas. */
  realizado_pendente: number;
}

export interface ResumoPlanejamento {
  mes: number;
  ano: number;
  tipo: TipoPlanejamento;
  totais: { planejado: number; realizado_pago: number; realizado_pendente: number };
  categorias: ResumoCategoriaPlanejamento[];
}

export class PlanejamentoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanejamentoValidationError';
  }
}

export class PlanejamentoNotFoundError extends Error {
  constructor(message = 'Planejamento não encontrado') {
    super(message);
    this.name = 'PlanejamentoNotFoundError';
  }
}
