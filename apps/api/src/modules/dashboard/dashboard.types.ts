export type OrigemDespesa = 'CONTA' | 'AVULSO' | 'EMPRESTIMO' | 'CARTAO';

export interface DashboardDespesaItemDto {
  id: string | number;
  descricao: string;
  tipo: 'saida' | 'cartao';
  valor: number;
  categoria?: string;
  data: string; // YYYY-MM-DD
  status: 'pago' | 'pendente';
  origem: OrigemDespesa;
  origem_rotulo: string; // 'Conta Corrente' | 'Avulso' | 'Empréstimo' | 'Cartão'
  target_id: string; // ID da entidade original para efetivação contábil
  recorrencia?: 'NONE' | 'MENSAL' | 'SEMANAL' | 'ANUAL';
  parent_recurrence_id?: string | null;
  is_recorrente?: boolean;
  detalhes?: {
    numero_parcela?: number;
    instituicao?: string;
    cartao_nome?: string;
    mes_referencia?: number;
    ano_referencia?: number;
  };
}

export interface DashboardResumoDto {
  saldo_atual: number;
  gastos_mensal: number;
  receita_mensal: number;
  gastos_mensal_pendente: number;
  receita_mensal_pendente: number;
  saldo_acumulado: number;
  saldo_projetado: number;
  total_dividas_mes: number;
  gastos_cartao: number;
  hasSome: boolean;
  despesas_mes?: DashboardDespesaItemDto[];
}

export interface ProjecaoMensalDto {
  mes_ano: string | Date;
  ano: number;
  mes: number;
  soma_entrada: string | number;
  soma_saida: string | number;
  saldo_mensal: string | number;
  saldo_acumulado: string | number;
}

export interface AgrupamentoCategoriaDto {
  categoria: number;
  media_mensal: string | number;
}
