import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const candidatePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../../.env'),
  path.resolve(__dirname, '../../../../../../../.env'),
];

for (const envPath of candidatePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({
      path: envPath,
      override: process.env.NODE_ENV !== 'production',
    });
    break;
  }
}

export const ENV = {
  PORT: Number(
    process.env.API_PORT ||
      (process.env.PORT &&
      process.env.PORT !== '5432' &&
      process.env.PORT !== '4200'
        ? process.env.PORT
        : 3000)
  ),
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || '',
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  CORS_ORIGINS: process.env.CORS_ORIGINS || '',
  DB_HOST: process.env.DB_HOST,
  DB_PORT: Number(process.env.DB_PORT || 5432),
  DB_USER: process.env.DB_USER,
  DB_PASS: process.env.DB_PASS,
  DB_NAME: process.env.DB_NAME,
  DB_SSL: process.env.DB_SSL,
  DATABASE_URL: process.env.DATABASE_URL,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  AI_TEXT_MODEL: process.env.AI_TEXT_MODEL || 'openai/gpt-oss-20b',
  AI_VISION_MODEL: process.env.AI_VISION_MODEL,
  /** Tamanho máximo da imagem (decodificada) enviada ao /ai/chat, em MB. A Groq limita imagens base64 a 4 MB. */
  AI_MAX_IMAGE_MB: Number(process.env.AI_MAX_IMAGE_MB || 4),
};

/**
 * Valida variáveis obrigatórias no boot. Deve ser chamada antes de subir o servidor:
 * a API não pode iniciar sem segredo JWT (evita tokens forjáveis com chave padrão).
 */
export function assertRequiredEnv(): void {
  const faltando: string[] = [];
  if (!ENV.JWT_SECRET) faltando.push('JWT_SECRET');

  if (faltando.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${faltando.join(', ')}. Defina-as no .env ou no ambiente de execução.`
    );
  }
}
