import { Capacitor } from '@capacitor/core';

export function resolveApiUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://192.168.0.5:3000';
  }

  // Permite configurar URL customizada dinamicamente em tempo de execução via localStorage
  const customUrl = window.localStorage?.getItem('API_URL');
  if (customUrl) {
    return customUrl;
  }

  // Se executando em dispositivo nativo (Android/iOS via Capacitor)
  if (Capacitor.isNativePlatform()) {
    return 'http://192.168.0.5:3000';
  }

  // Se estiver rodando em desenvolvimento puro no localhost (ng serve)
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  // Em produção / acesso web pelo domínio (Nginx faz o proxy reverso de /api para o backend)
  return '/api';
}

export const environment = {
  production: true,
  get apiUrl(): string {
    return resolveApiUrl();
  },
};