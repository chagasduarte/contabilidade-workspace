import { CardInvoice, CreditCard } from '@contabilidade/models';

/** Datas civis: não aplicar o fuso horário do navegador a campos DATE. */
export function dataCivil(valor: string | Date): string {
  return valor instanceof Date ? valor.toISOString().substring(0, 10) : valor.substring(0, 10);
}

export function datasDoCiclo(fatura: CardInvoice, cartao: CreditCard) {
  const ano = Number(fatura.ano_referencia);
  const mes = Number(fatura.mes_referencia);
  const data = (a: number, m: number, dia: number) => {
    const limite = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return new Date(Date.UTC(a, m - 1, Math.min(dia, limite))).toISOString().substring(0, 10);
  };
  const mesVencimento = mes + (cartao.dia_vencimento <= cartao.dia_fechamento ? 1 : 0);
  return {
    fechamento: data(ano, mes, cartao.dia_fechamento),
    vencimento: data(ano, mesVencimento, cartao.dia_vencimento),
  };
}
