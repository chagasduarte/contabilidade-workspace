// planejamento.model.ts — orçamento mensal por categoria (/planejamento)

export type TipoPlanejamento = 'despesa' | 'receita';

export interface Planejamento {
  id: number;
  /** Nome da categoria (resolvido pela API). */
  categoria: string;
  subcategoria: string | null;
  valor: number;
  tipo: TipoPlanejamento | string;
  categoriaid: number;
  subcategoriaid: number | null;
  /** YYYY-MM-DD (mês de referência). */
  data: string;
  userid: number;
}

export interface CreatePlanejamentoDto {
  categoriaid: number;
  subcategoriaid?: number | null;
  valor: number;
  tipo?: TipoPlanejamento;
  /** YYYY-MM-DD; a API usa só o mês/ano. */
  data: string;
}

/** A data não muda na edição: para outro mês, exclua e crie. */
export type UpdatePlanejamentoDto = Partial<Omit<CreatePlanejamentoDto, 'data'>>;

export interface AgrupamentoCategoriaPlanejamento {
  categoria: string;
  categoriaid: number;
  soma: number;
  planejamento: Planejamento[];
}

export interface AgrupamentoTipoPlanejamento {
  tipo: TipoPlanejamento | string;
  soma: number;
  agrupamentoTipo: AgrupamentoCategoriaPlanejamento[];
}

/** Planejado x realizado de uma categoria no mês (`GET /planejamento/resumo`). */
export interface ResumoCategoriaPlanejamento {
  idcategoria: number;
  categoria_nome: string | null;
  planejado: number;
  /** Transações pagas + faturas PAID. */
  realizado_pago: number;
  /** Restante do realizado (pendente). */
  realizado_pendente: number;
}

/** `GET /planejamento/resumo?mes&ano&tipo=despesa|receita`. */
export interface ResumoPlanejamento {
  mes: number;
  ano: number;
  tipo: TipoPlanejamento;
  totais: { planejado: number; realizado_pago: number; realizado_pendente: number };
  categorias: ResumoCategoriaPlanejamento[];
}
