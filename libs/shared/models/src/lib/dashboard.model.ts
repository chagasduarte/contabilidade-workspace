export type OrigemDespesa = 'CONTA' | 'AVULSO' | 'EMPRESTIMO' | 'CARTAO';

export interface DashboardDespesaItem {
  id: string | number;
  descricao: string;
  tipo: 'saida' | 'cartao';
  valor: number;
  categoria?: string;
  data: string; // YYYY-MM-DD
  status: 'pago' | 'pendente';
  origem: OrigemDespesa;
  origem_rotulo: string; // 'Conta Corrente' | 'Avulso' | 'Empréstimo' | 'Cartão'
  target_id: string;
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

export interface DashboardResumo {
  saldo_atual: number;
  gastos_mensal: number;
  receita_mensal: number;
  gastos_mensal_pendente: number;
  receita_mensal_pendente: number;
  saldo_acumulado: number;
  saldo_projetado?: number;
  total_dividas_mes?: number;
  gastos_cartao: number;
  hasSome: boolean;
  despesas_mes?: DashboardDespesaItem[];
}

export interface ProjecaoMensal {
  mes_ano: string;
  ano: number;
  mes: number;
  soma_entrada: number | string;
  soma_saida: number | string;
  saldo_mensal: number | string;
  saldo_acumulado: number | string;
}

export interface AgrupamentoCategoria {
  /** Id legado (subcategoria ou categoria). Prefira os campos de nome. */
  categoria: number;
  media_mensal: number | string;
  idcategoria?: number | null;
  idsubcategoria?: number | null;
  categoria_nome?: string | null;
  subcategoria_nome?: string | null;
}
