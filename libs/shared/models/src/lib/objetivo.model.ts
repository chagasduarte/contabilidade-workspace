// objetivo.model.ts — metas financeiras (/objetivos)

export interface Objetivo {
  id: number;
  usuario_id: number;
  nome: string;
  /** Texto livre (1–50), ex.: "Viagem", "Reserva de emergência". */
  tipo: string;
  valor_objetivo: number;
  /** Quanto o usuário pretende guardar por mês. */
  valor_mensal: number;
  /** Quanto já foi guardado. */
  valor_acumulado: number;
  /** YYYY-MM-DD */
  data_final: string;
  criado_em?: string | null;
  /** acumulado / objetivo × 100 (pode passar de 100). */
  progresso_percentual: number;
  valor_restante: number;
  meses_restantes: number;
  /** restante / meses restantes; null se o prazo passou. */
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
