/**
 * Representa um usuário autenticado no sistema.
 */
export interface Usuario {
  readonly id: number;
  nome: string;
  email?: string;
  avatar?: string;
}


