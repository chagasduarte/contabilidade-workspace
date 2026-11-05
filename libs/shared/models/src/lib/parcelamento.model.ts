export type OrigemParcelamento = 'conta' | 'cartao';

export interface ParcelaDetalhe {
  id: string;
  numero: number;
  valor: number;
  vencimento: string;
  status: 'pago' | 'pendente';
}

export interface ParcelamentoDetalhes {
  id: string;
  origem: OrigemParcelamento;
  descricao: string;
  totalParcelas: number;
  historicoCompleto: boolean;
  total: number;
  totalPago: number;
  saldoRestante: number;
  parcelasPagas: number;
  parcelasPendentes: number;
  progresso: number;
  parcelas: ParcelaDetalhe[];
}
