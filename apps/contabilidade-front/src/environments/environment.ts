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

  // Se executando em navegador web:
  // Usa o mesmo hostname acessado no browser (localhost, 127.0.0.1 ou IP da rede local)
  const hostname = window.location.hostname;
  if (hostname) {
    return `http://${hostname}:3000`;
  }

  return 'http://localhost:3000';
}

export const environment = {
  production: false,
  get apiUrl(): string {
    return resolveApiUrl();
  },
};