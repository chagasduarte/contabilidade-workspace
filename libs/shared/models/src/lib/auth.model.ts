import { Usuario } from './user.model';

/**
 * Credenciais necessárias para efetuar o login.
 */
export interface LoginCredentials {
  email?: string;
  nome?: string;
  senha: string;
}

/**
 * Resposta de sucesso do endpoint de autenticação.
 */
export interface AuthResponse {
  token: string;
  usuario: Usuario;
  message?: string;
}

/**
 * Dados necessários para cadastrar um novo usuário no sistema.
 */
export interface RegisterData {
  nome: string;
  email: string;
  senha: string;
}

