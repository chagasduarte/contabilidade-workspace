import { Transacao } from '@contabilidade/models';

type ComCategoria = Pick<
  Transacao,
  'categoria' | 'idcategoria' | 'categoria_nome' | 'subcategoria_nome'
>;

/**
 * Rótulo de categoria para listas. Nunca exibe o id numérico:
 * `subcategoria_nome ?? categoria_nome ?? nome pelo idcategoria ?? texto legado ?? 'Geral'`.
 */
export function rotuloCategoria(
  item: ComCategoria,
  nomesPorId: ReadonlyMap<number, string> = new Map()
): string {
  if (item.subcategoria_nome) return item.subcategoria_nome;
  if (item.categoria_nome) return item.categoria_nome;
  if (item.idcategoria != null) {
    const nome = nomesPorId.get(Number(item.idcategoria));
    if (nome) return nome;
  }
  if (typeof item.categoria === 'string' && item.categoria.trim() && isNaN(Number(item.categoria))) {
    return item.categoria;
  }
  return 'Geral';
}
