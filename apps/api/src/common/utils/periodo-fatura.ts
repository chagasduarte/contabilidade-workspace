export interface PeriodoFatura {
  inicio: string;
  fim: string;
}

export function getPeriodoFatura(
  diaFatura: number,
  mes: number,
  ano: number
): PeriodoFatura {
  let mesAnterior = mes - 1;
  let anoAnterior = ano;

  if (mesAnterior === 0) {
    mesAnterior = 12;
    anoAnterior--;
  }

  const mmAtual = String(mes).padStart(2, '0');
  const mmAnterior = String(mesAnterior).padStart(2, '0');

  const ultimoDiaMesAnterior = new Date(ano, mesAnterior, 0).getDate();

  let inicio: string;
  let fim: string;

  if (diaFatura === 1) {
    inicio = `${anoAnterior}-${mmAnterior}-01`;
    fim = `${anoAnterior}-${mmAnterior}-${ultimoDiaMesAnterior}`;
  } else {
    inicio = `${anoAnterior}-${mmAnterior}-${String(diaFatura).padStart(2, '0')}`;
    fim = `${ano}-${mmAtual}-${String(diaFatura - 1).padStart(2, '0')}`;
  }

  return { inicio, fim };
}

