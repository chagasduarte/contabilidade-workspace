export interface SubcategoriaEntity {
  id: number;
  idcategoria: number;
  nome: string;
  icone?: string | null;
}

export interface CreateSubcategoriaDto {
  idcategoria: number;
  nome: string;
  icone?: string;
}

