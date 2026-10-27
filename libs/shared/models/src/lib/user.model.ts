/**
 * Representa um usuário autenticado no sistema.
 */
export interface Usuario {
  readonly id: number;
  nome: string;
  email?: string;
  avatar?: string;
  /** URL absoluta da foto (GET /user/me). */
  avatarUrl?: string;
}

/** Resposta de `GET/PUT /user/me`. */
export interface PerfilUsuario {
  id: number;
  nome: string;
  email: string;
  avatar: string | null;
  avatarUrl: string;
}

export interface AtualizarPerfilDto {
  nome?: string;
  email?: string;
}


