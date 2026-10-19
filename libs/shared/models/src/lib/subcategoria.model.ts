import { Categoria } from './categoria.model';

/**
 * Entidade de Subcategoria vinculada a uma Categoria pai.
 */
export interface Subcategoria {
  readonly id: number;
  idcategoria: number;
  nome: string;
  icone: string;
  cor: string;
}

/**
 * DTO para criação de uma nova subcategoria via API.
 */
export interface CreateSubcategoriaDto {
  idcategoria: number;
  nome: string;
  icone: string;
  cor: string;
}

/**
 * DTO para atualização de uma subcategoria existente via API.
 */
export interface UpdateSubcategoriaDto {
  idcategoria?: number;
  nome?: string;
  icone?: string;
  cor?: string;
}

/**
 * Entidade composta que inclui os dados da categoria pai populada.
 */
export interface SubcategoriaComCategoria extends Subcategoria {
  categoria?: Categoria;
}

