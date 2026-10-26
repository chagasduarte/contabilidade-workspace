export type TipoCategoria = 'despesa' | 'receita';

export interface CategoriaEntity {
  id: number;
  nome: string;
  icone?: string | null;
  cor?: string | null;
  tipo?: TipoCategoria;
  /** Dono da categoria; null = categoria padrão do sistema (visível a todos, só leitura). */
  userid: number | null;
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


/** Categoria existe, mas é global (padrão do sistema): usuário não pode alterar/excluir. */
export class CategoriaForbiddenError extends Error {
  constructor(message = 'Categorias padrão do sistema não podem ser alteradas.') {
    super(message);
    this.name = 'CategoriaForbiddenError';
  }
}

/** Nome repetido no escopo do dono (uq_categoria_dono_nome_tipo / uq_subcategoria_dono_nome). */
export class CategoriaConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategoriaConflictError';
  }
}

export class CategoriaNotFoundError extends Error {
  constructor(message = 'Categoria não encontrada') {
    super(message);
    this.name = 'CategoriaNotFoundError';
  }
}

export class CategoriaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategoriaValidationError';
  }
}

/** Converte violação de unicidade do Postgres em conflito de negócio; demais erros passam intactos. */
export function mapearConflitoCategoria(error: unknown, mensagem: string): unknown {
  const pgErr = error as { code?: string; constraint?: string };
  if (
    pgErr?.code === '23505' &&
    (pgErr.constraint === 'uq_categoria_dono_nome_tipo' || pgErr.constraint === 'uq_subcategoria_dono_nome')
  ) {
    return new CategoriaConflictError(mensagem);
  }
  return error;
}
