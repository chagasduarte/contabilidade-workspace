import { Response } from 'express';

const DB_CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'EHOSTUNREACH',
]);

/**
 * Responde com uma mensagem de erro legível.
 * Erros de conexão com o banco viram 500 (o AggregateError do pg vem com message vazia);
 * demais erros mantêm 400 com a mensagem original ou o fallback.
 */
export function sendError(res: Response, error: unknown, fallback: string): void {
  const code = (error as { code?: string } | null)?.code;

  if (code && DB_CONNECTION_CODES.has(code)) {
    const message = `Falha ao conectar ao banco de dados (${code})`;
    res.status(500).json({ error: message, erro: message });
    return;
  }

  const message = (error instanceof Error && error.message.trim()) || fallback;
  res.status(400).json({ error: message, erro: message });
}
