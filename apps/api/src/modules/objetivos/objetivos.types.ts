export interface ObjetivoEntity {
  id: number;
  usuario_id: number;
  nome: string;
  tipo: string;
  valor_objetivo: number | string;
  valor_mensal: number | string;
  data_final: string | Date;
}

export interface CreateObjetivoDto {
  nome: string;
  tipo: string;
  valor_objetivo: number;
  valor_mensal: number;
  data_final: string | Date;
}

