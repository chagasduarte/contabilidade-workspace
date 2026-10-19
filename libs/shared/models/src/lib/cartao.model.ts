export interface Cartao {
  id: number;
  nome: string;
  dia_fatura: number;
  limite?: number;
  userid?: number;
  dia_vencimento?: number;
}

