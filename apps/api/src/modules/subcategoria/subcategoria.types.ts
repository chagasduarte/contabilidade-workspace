export interface SubcategoriaEntity {
  id: number;
  idcategoria: number;
  nome: string;
  icone?: string | null;
  cor?: string | null;
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


