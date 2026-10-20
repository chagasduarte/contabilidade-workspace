export type TipoCategoria = 'despesa' | 'receita';

export interface CategoriaEntity {
  id: number;
  nome: string;
  icone?: string | null;
  cor?: string | null;
  tipo?: TipoCategoria;
}

export interface CreateCategoriaDto {
  idcategoria?: number;
  nome: string;
  icone?: string;
  cor?: string;
  tipo?: TipoCategoria;
}

export interface UpdateCategoriaDto {
  nome?: string;
  icone?: string;
  cor?: string;
  tipo?: TipoCategoria;
}

