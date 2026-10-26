/**
 * Tipo estrito para categorização de transações financeiras.
 */
export type TipoCategoria = 'despesa' | 'receita';

/**
 * Entidade de Categoria representando o modelo persistido no banco de dados.
 */
export interface Categoria {
  readonly id: number;
  nome: string;
  icone: string;
  cor: string;
  tipo?: TipoCategoria;
  /** `null` = categoria padrão do sistema (somente leitura); número = do usuário logado. */
  userid?: number | null;
}

/**
 * DTO para criação de uma nova categoria via API.
 */
export interface CreateCategoriaDto {
  nome: string;
  icone: string;
  cor: string;
  tipo?: TipoCategoria;
}

/**
 * DTO para atualização de uma categoria existente via API.
 */
export interface UpdateCategoriaDto {
  nome?: string;
  icone?: string;
  cor?: string;
  tipo?: TipoCategoria;
}

/**
 * Parâmetros de filtro para listagem ou consulta de categorias.
 */
export interface CategoriaFilterParams {
  termo?: string;
  tipo?: TipoCategoria;
}

