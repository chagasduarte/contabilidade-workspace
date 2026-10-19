export interface PlanejamentoEntity {
  id: number;
  categoria: string;
  subcategoria?: string | null;
  valor: number | string;
  tipo: string;
  categoriaid: number;
  subcategoriaid?: number | null;
  data: string | Date;
  userid: number;
}

export interface CreatePlanejamentoDto {
  categoria: string;
  subcategoria?: string;
  valor: number;
  tipo: string;
  categoriaid: number;
  subcategoriaid?: number;
  data: string | Date;
}

export interface UpdatePlanejamentoDto {
  categoria: string;
  subcategoria?: string;
  valor: number;
  tipo: string;
  categoriaid: number;
  subcategoriaid?: number;
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

