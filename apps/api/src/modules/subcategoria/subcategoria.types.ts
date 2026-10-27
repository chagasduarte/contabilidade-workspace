export interface SubcategoriaEntity {
  id: number;
  idcategoria: number;
  nome: string;
  icone?: string | null;
  cor?: string | null;
  /** Dono da subcategoria; null = padrão do sistema. */
  userid: number | null;
}

export interface CreateSubcategoriaDto {
  idcategoria: number;
  nome: string;
  icone?: string;
  cor?: string;
}

export interface UpdateSubcategoriaDto {
  idcategoria?: number;
  nome?: string;
  icone?: string;
  cor?: string;
}


