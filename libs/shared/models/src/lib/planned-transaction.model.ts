// planned-transaction.model.ts

export type PlannedTransactionType = 'RECEITA' | 'DESPESA';
export type PlannedTransactionRecurrence = 'NONE' | 'MENSAL' | 'SEMANAL' | 'ANUAL';
export type PlannedTransactionStatus = 'PENDING' | 'SETTLED' | 'SKIPPED' | 'CANCELLED';

export interface PlannedTransaction {
  id: string;
  userid: number;
  descricao: string;
  tipo: PlannedTransactionType;
  valor: number;
  data_prevista: string;
  idcategoria: number | null;
  categoria_nome?: string | null;
  categoria_icone?: string | null;
  recorrencia: PlannedTransactionRecurrence;
  data_limite_recorrencia?: string | null;
  status: PlannedTransactionStatus;
  parent_recurrence_id?: string | null;
  is_recorrente?: boolean;
  created_at?: string;
  updated_at?: string;
}

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

