export interface CategoriaEntity {
  id: number;
  nome: string;
  icone?: string | null;
}

export interface CreateCategoriaDto {
  idcategoria?: number;
  nome: string;
  icone?: string;
}

