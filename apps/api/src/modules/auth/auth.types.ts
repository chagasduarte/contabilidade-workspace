export interface LoginDto {
  nome?: string;
  email?: string;
  senha?: string;
}

export interface AuthUserResponse {
  id: number;
  nome: string;
  email?: string | null;
  avatar?: string | null;
}

export interface AuthResponseDto {
  token: string;
  usuario: AuthUserResponse;
}

