export interface CartaoEntity {
  id: number | string;
  nome: string;
  dia_fatura: number;
  dia_vencimento?: number;
  limite: number | string;
  userid: number;
}

export interface CreateCartaoDto {
  nome: string;
  dia_fatura: number;
  limite: number;
}

