import { resolverAcaoLancamento } from './lancamento-acao';
import { Transacao } from '@contabilidade/models';
const item: Transacao = {
  id: 1,
  tipo: 'saida',
  descricao: 'Compra',
  valor: 10,
  data: '2026-11-01',
  status: 'pendente',
};
describe('Ação do lançamento', () => {
  it('abre edição para conta comum', () =>
    expect(resolverAcaoLancamento(item, false)).toEqual({ tipo: 'editar' }));
  it('prioriza a compra parcelada sobre a leitura do cartão', () => {
    expect(
      resolverAcaoLancamento(
        {
          ...item,
          origem: 'CARTAO',
          parcela_grupo_id: 'compra',
          parcela_total: 3,
        },
        true,
      ),
    ).toEqual({ tipo: 'parcelamento', origem: 'cartao', id: 'compra' });
  });
  it('identifica o grupo da conta sem inferir pela descrição', () => {
    expect(
      resolverAcaoLancamento(
        { ...item, parcela_grupo_id: 'grupo', parcela_total: 2 },
        false,
      ),
    ).toEqual({ tipo: 'parcelamento', origem: 'conta', id: 'grupo' });
    expect(
      resolverAcaoLancamento({ ...item, descricao: 'Compra - Parcela' }, false),
    ).toEqual({ tipo: 'editar' });
  });
  it('preserva os caminhos de cartão avulso, empréstimo e registro efetivado', () => {
    expect(
      resolverAcaoLancamento({ ...item, origem: 'CARTAO' }, true).tipo,
    ).toBe('origem');
    expect(
      resolverAcaoLancamento({ ...item, origem: 'EMPRESTIMO' }, false).tipo,
    ).toBe('origem');
    expect(resolverAcaoLancamento(item, true).tipo).toBe('nenhuma');
  });
});
