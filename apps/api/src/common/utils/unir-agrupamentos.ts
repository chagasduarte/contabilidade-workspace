export interface AgrupamentoItem {
  categoria: string;
  total_tipo: string | number;
  idcategoria?: number | string | null;
}

export interface AgrupamentoResultado {
  categoria: string;
  total_tipo: string;
  idcategoria: number | null;
}

export function unirAgrupamentos(
  semCartao: AgrupamentoItem[],
  comCartao: AgrupamentoItem[]
): AgrupamentoResultado[] {
  const mapa = new Map<string, { total: number; idcategoria: number | null }>();

  for (const item of semCartao) {
    const categoria = item.categoria;
    const valor = Number(item.total_tipo || 0);
    const idcategoria = item.idcategoria != null ? Number(item.idcategoria) : null;

    const existente = mapa.get(categoria);
    if (!existente) {
      mapa.set(categoria, { total: valor, idcategoria });
    } else {
      existente.total += valor;
    }
  }

  for (const item of comCartao) {
    const categoria = item.categoria;
    const valor = Number(item.total_tipo || 0);
    const idcategoria = item.idcategoria != null ? Number(item.idcategoria) : null;

    const existente = mapa.get(categoria);
    if (!existente) {
      mapa.set(categoria, { total: valor, idcategoria });
    } else {
      existente.total += valor;
    }
  }

  return Array.from(mapa.entries()).map(([categoria, data]) => ({
    categoria,
    total_tipo: data.total.toFixed(2),
    idcategoria: data.idcategoria,
  }));
}

