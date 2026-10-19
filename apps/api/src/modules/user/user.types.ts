export interface UserEntity {
  id: number;
  nome: string;
  email?: string | null;
  senha_hash: string;
  avatar?: string | null;
}

export interface UserResponse {
  id: number;
  nome: string;
  email?: string | null;
  avatar?: string | null;
}

export interface CreateUserDto {
  nome: string;
  email?: string;
  senha: string;
}

