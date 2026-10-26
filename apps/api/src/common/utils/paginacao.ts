import { Response } from 'express';

export const PAGINACAO_LIMIT_PADRAO = 50;
export const PAGINACAO_LIMIT_MAX = 200;

/** Erro de parâmetro de paginação (cursor/limit inválido): os controllers respondem 400. */
export class PaginacaoInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaginacaoInvalidaError';
  }
}

export interface PaginacaoQuery {
  /** true quando o cliente pediu paginação (?paginado=true ou ?cursor=...). */
  paginado: boolean;
  /** Cursor bruto recebido (opaco para o cliente). */
  cursor: string | null;
  /** Tamanho da página (só definido quando paginado). */
  limit: number | null;
}

/**
 * Lê ?paginado, ?cursor e ?limit. Sem esses parâmetros a listagem segue o comportamento antigo
 * (array completo), por isso a paginação é opt-in e retrocompatível.
 */
export function lerPaginacao(query: Record<string, unknown>): PaginacaoQuery {
  const cursor = typeof query['cursor'] === 'string' && query['cursor'] ? String(query['cursor']) : null;
  const paginado = query['paginado'] === 'true' || query['paginado'] === '1' || Boolean(cursor);
  if (!paginado) return { paginado: false, cursor: null, limit: null };

  let limit = PAGINACAO_LIMIT_PADRAO;
  if (query['limit'] !== undefined && query['limit'] !== '') {
    const n = Number(query['limit']);
    if (!Number.isInteger(n) || n < 1) {
      throw new PaginacaoInvalidaError('O parâmetro limit deve ser um inteiro maior que zero.');
    }
    limit = Math.min(n, PAGINACAO_LIMIT_MAX);
  }
  return { paginado: true, cursor, limit };
}

/** Codifica a chave de ordenação da última linha como cursor opaco (base64url de JSON). */
export function codificarCursor(chave: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(chave), 'utf8').toString('base64url');
}

/** Decodifica um cursor gerado por codificarCursor, validando os campos esperados. */
export function decodificarCursor<T extends Record<string, string | number>>(
  cursor: string,
  campos: Array<keyof T & string>
): T {
  let obj: unknown;
  try {
    obj = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new PaginacaoInvalidaError('Cursor inválido.');
  }
  if (!obj || typeof obj !== 'object') throw new PaginacaoInvalidaError('Cursor inválido.');
  const rec = obj as Record<string, unknown>;
  for (const campo of campos) {
    const v = rec[campo];
    if (typeof v !== 'string' && typeof v !== 'number') throw new PaginacaoInvalidaError('Cursor inválido.');
  }
  return rec as T;
}

/**
 * Envia a listagem no formato pedido: array puro (padrão, compatível) ou { items, next_cursor }
 * quando paginado. Em ambos os casos o próximo cursor também vai no header X-Next-Cursor.
 */
export function responderPaginado<T>(
  res: Response,
  items: T[],
  nextCursor: string | null,
  paginado: boolean,
  extras: Record<string, unknown> = {}
): void {
  if (nextCursor) {
    res.setHeader('X-Next-Cursor', nextCursor); // exposto via CORS (exposedHeaders em main.ts)
  }
  // `extras` (ex.: totais do extrato) só existem no formato paginado
  res.status(200).json(paginado ? { items, next_cursor: nextCursor, ...extras } : items);
}
