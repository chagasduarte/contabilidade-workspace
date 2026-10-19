// planned-transaction.dto.ts
// DTOs de entrada, saída e filtros para Planned Transactions

import {
  PlannedTransactionEntity,
  PlannedTransactionRecurrence,
  PlannedTransactionStatus,
  PlannedTransactionType,
} from './planned-transaction.entity';

/**
 * DTO para cadastro de uma nova transação planejada.
 */
export interface CreatePlannedTransactionDto {
  descricao: string;
  tipo: PlannedTransactionType;
  valor: number;
  data_prevista: string | Date;
  idcategoria?: number | null;
  recorrencia?: PlannedTransactionRecurrence;
  data_limite_recorrencia?: string | Date | null;
  status?: PlannedTransactionStatus;
  parent_recurrence_id?: string | null;
}

/**
 * DTO para atualização parcial de dados de uma transação planejada.
 */
export interface UpdatePlannedTransactionDto {
  descricao?: string;
  tipo?: PlannedTransactionType;
  valor?: number;
  data_prevista?: string | Date;
  idcategoria?: number | null;
  recorrencia?: PlannedTransactionRecurrence;
  data_limite_recorrencia?: string | Date | null;
  status?: PlannedTransactionStatus;
  parent_recurrence_id?: string | null;
  updateMode?: 'SINGLE' | 'ALL_FUTURE';
}

/**
 * DTO para filtragem na listagem de transações planejadas.
 */
export interface PlannedTransactionFilterDto {
  status?: PlannedTransactionStatus | string;
  tipo?: PlannedTransactionType | string;
  dataInicio?: string | Date;
  dataFim?: string | Date;
  data_inicio?: string | Date; // Alias
  data_fim?: string | Date; // Alias
  idcategoria?: number | string;
}

/**
 * DTO de resposta formatada para a API e frontend.
 */
export interface PlannedTransactionResponseDto {
  id: string;
  userid: number;
  descricao: string;
  tipo: PlannedTransactionType;
  valor: number;
  data_prevista: string; // YYYY-MM-DD
  idcategoria: number | null;
  categoria_nome: string | null;
  categoria_icone: string | null;
  recorrencia: PlannedTransactionRecurrence;
  data_limite_recorrencia: string | null; // YYYY-MM-DD ou null
  status: PlannedTransactionStatus;
  parent_recurrence_id: string | null;
  is_recorrente: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Formata um objeto Date ou string no formato `YYYY-MM-DD` preservando dia civil.
 */
export function formatDateToIsoString(dateInput?: Date | string | null): string | null {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') {
    return dateInput.split('T')[0];
  }
  const year = dateInput.getUTCFullYear();
  const month = String(dateInput.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateInput.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Mapeia a entidade para o DTO de resposta padrão da API.
 */
export function formatPlannedTransactionResponse(
  entity: PlannedTransactionEntity
): PlannedTransactionResponseDto {
  return {
    id: entity.id,
    userid: entity.userid,
    descricao: entity.descricao,
    tipo: entity.tipo,
    valor: Number(entity.valor),
    data_prevista: formatDateToIsoString(entity.data_prevista) || String(entity.data_prevista),
    idcategoria: entity.idcategoria ?? null,
    categoria_nome: entity.categoria_nome ?? null,
    categoria_icone: entity.categoria_icone ?? null,
    recorrencia: entity.recorrencia,
    data_limite_recorrencia: formatDateToIsoString(entity.data_limite_recorrencia),
    status: entity.status,
    parent_recurrence_id: entity.parent_recurrence_id ?? null,
    is_recorrente: entity.recorrencia === 'MENSAL' || Boolean(entity.parent_recurrence_id),
    created_at: entity.created_at ? entity.created_at.toISOString() : undefined,
    updated_at: entity.updated_at ? entity.updated_at.toISOString() : undefined,
  };
}

