// planned-transaction.entity.ts
// Entidade que mapeia a tabela `planned_transactions` do PostgreSQL

export type PlannedTransactionType = 'RECEITA' | 'DESPESA';
export type PlannedTransactionRecurrence = 'NONE' | 'MENSAL' | 'SEMANAL' | 'ANUAL';
export type PlannedTransactionStatus = 'PENDING' | 'SETTLED' | 'SKIPPED' | 'CANCELLED';

export interface PlannedTransactionEntity {
  id: string; // UUID
  userid: number;
  descricao: string;
  tipo: PlannedTransactionType;
  valor: number;
  data_prevista: Date;
  idcategoria?: number | null;
  recorrencia: PlannedTransactionRecurrence;
  data_limite_recorrencia?: Date | null;
  status: PlannedTransactionStatus;
  parent_recurrence_id?: string | null;
  created_at?: Date;
  updated_at?: Date;

  // Campos enriquecidos via JOIN com a tabela `categoria`
  categoria_nome?: string | null;
  categoria_icone?: string | null;
}

/**
 * Converte um registro bruto do banco de dados na entidade PlannedTransactionEntity.
 */
export function mapPlannedTransactionEntity(
  row: Record<string, unknown>
): PlannedTransactionEntity {
  const parseDate = (val: unknown): Date | undefined => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    const parsed = new Date(String(val));
    return isNaN(parsed.getTime()) ? undefined : parsed;
  };

  const dataPrevista = parseDate(row['data_prevista']);

  return {
    id: String(row['id']),
    userid: Number(row['userid']),
    descricao: String(row['descricao'] ?? ''),
    tipo: (row['tipo'] as PlannedTransactionType) ?? 'DESPESA',
    valor: Number(row['valor'] ?? 0),
    data_prevista: dataPrevista || new Date(),
    idcategoria:
      row['idcategoria'] !== null && row['idcategoria'] !== undefined
        ? Number(row['idcategoria'])
        : null,
    recorrencia: (row['recorrencia'] as PlannedTransactionRecurrence) ?? 'NONE',
    data_limite_recorrencia: parseDate(row['data_limite_recorrencia']) ?? null,
    status: (row['status'] as PlannedTransactionStatus) ?? 'PENDING',
    parent_recurrence_id: row['parent_recurrence_id']
      ? String(row['parent_recurrence_id'])
      : null,
    created_at: parseDate(row['created_at']),
    updated_at: parseDate(row['updated_at']),
    categoria_nome: row['categoria_nome']
      ? String(row['categoria_nome'])
      : row['nome_categoria']
      ? String(row['nome_categoria'])
      : null,
    categoria_icone: row['categoria_icone']
      ? String(row['categoria_icone'])
      : row['icone_categoria']
      ? String(row['icone_categoria'])
      : null,
  };
}

