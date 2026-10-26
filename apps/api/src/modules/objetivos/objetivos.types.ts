export interface ObjetivoEntity {
  id: number;
  usuario_id: number;
  nome: string;
  tipo: string;
  valor_objetivo: number;
  valor_mensal: number;
  /** Quanto já foi guardado para o objetivo (migration 009). */
  valor_acumulado: number;
  /** YYYY-MM-DD */
  data_final: string;
  criado_em?: string | Date | null;
}

/** Objetivo com o progresso calculado (resposta da API). */
export interface ObjetivoResponse extends ObjetivoEntity {
  /** 0–100, duas casas. Pode passar de 100 se o acumulado superar a meta. */
  progresso_percentual: number;
  /** max(valor_objetivo - valor_acumulado, 0) */
  valor_restante: number;
  /** Meses inteiros até data_final (0 se já passou). */
  meses_restantes: number;
  /** valor_restante / meses_restantes (null se não há meses restantes). */
  valor_mensal_necessario: number | null;
}

export interface CreateObjetivoDto {
  nome: string;
  tipo: string;
  valor_objetivo: number;
  valor_mensal?: number;
  valor_acumulado?: number;
  data_final: string;
}

export type UpdateObjetivoDto = Partial<CreateObjetivoDto>;

export class ObjetivoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObjetivoValidationError';
  }
}

export class ObjetivoNotFoundError extends Error {
  constructor(message = 'Objetivo não encontrado.') {
    super(message);
    this.name = 'ObjetivoNotFoundError';
  }
}
