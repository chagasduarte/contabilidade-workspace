import { Transacao, OrigemParcelamento } from '@contabilidade/models';

export type AcaoLancamento =
  | { tipo: 'parcelamento'; id: string; origem: OrigemParcelamento }
  | { tipo: 'editar' }
  | { tipo: 'origem' }
  | { tipo: 'nenhuma' };

export function resolverAcaoLancamento(
  item: Transacao,
  somenteLeitura: boolean,
): AcaoLancamento {
  if (item.parcela_grupo_id && (item.parcela_total ?? 0) > 1) {
    return {
      tipo: 'parcelamento',
      id: item.parcela_grupo_id,
      origem:
        item.origem === 'CARTAO' || item.source_type === 'CREDIT_CARD_ITEM'
          ? 'cartao'
          : 'conta',
    };
  }
  if (!somenteLeitura && item.origem !== 'EMPRESTIMO')
    return { tipo: 'editar' };
  if (
    item.origem === 'CARTAO' ||
    item.origem === 'EMPRESTIMO' ||
    item.source_type === 'CREDIT_CARD_ITEM'
  )
    return { tipo: 'origem' };
  return { tipo: 'nenhuma' };
}
