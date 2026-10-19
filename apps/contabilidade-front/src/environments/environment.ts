import { Capacitor } from '@capacitor/core';

export function resolveApiUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  // 1. Permite sobrescrever dinamicamente em tempo de execução via localStorage (ex: depuração ou mobile)
  const customUrl = window.localStorage?.getItem('API_URL');
  if (customUrl) {
    return customUrl.replace(/\/+$/, '');
  }

  // 2. Se executando em dispositivo nativo (Android/iOS via Capacitor)
  if (Capacitor.isNativePlatform()) {
    // No dispositivo nativo, 'localhost' aponta para o próprio aparelho.
    // Usamos o IP da rede local para testes em dev ou a URL do servidor de produção
    return 'http://192.168.0.5:3000';
  }

  const hostname = window.location.hostname;
  const port = window.location.port;

  // 3. Desenvolvimento local via Angular/Ionic Dev Server (ng serve nas portas 4200 ou 8100)
  if (port === '4200' || port === '8100') {
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    // Acessando dev-server por IP na rede local (ex: http://192.168.0.x:4200)
    return `http://${hostname}:3000`;
  }

  // 4. Produção no servidor (servido via Nginx / Docker / VPS / Domínio)
  // O Nginx faz o proxy reverso transparente de /api/ para http://api:3000/
  return '/api';
}

export const environment = {
  production: true,
  get apiUrl(): string {
    return resolveApiUrl();
  },
};