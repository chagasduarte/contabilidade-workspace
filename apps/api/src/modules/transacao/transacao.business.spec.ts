import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransacaoBusiness } from './transacao.business';
import { TransacaoRepository } from './transacao.repository';
import { TransacaoNotFoundError } from './transacao.types';
import { CardBusiness } from '../card/card.business';
import { CategoriaBusiness } from '../categoria/categoria.business';
import { SubcategoriaBusiness } from '../subcategoria/subcategoria.business';

vi.mock('../subcategoria/subcategoria.business', () => ({
  SubcategoriaBusiness: {
    subcategoriaDaCategoria: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock('../categoria/categoria.business', () => ({
  CategoriaBusiness: {
    categoriaVisivel: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('./transacao.repository', () => ({
  TransacaoRepository: {
    criar: vi.fn(),
    criarEmLote: vi.fn(),
    extrato: vi.fn(),
    extratoCartao: vi.fn().mockResolvedValue([]),
    extratoTotais: vi.fn(),
    buscarPorId: vi.fn(),
    atualizar: vi.fn(),
    excluir: vi.fn(),
    uptopago: vi.fn(),
    listaParceladas: vi.fn(),
    listaAdicionais: vi.fn(),
    listaTransacoes: vi.fn(),
  },
}));

vi.mock('../cartao/cartao.repository', () => ({
  CartaoRepository: {
    listar: vi.fn().mockResolvedValue([]),
    buscar: vi.fn(),
  },
}));

vi.mock('../card/card.business', () => ({
  CardBusiness: {
    lancarTransacao: vi.fn(),
  },
}));

vi.mock('../../core/config/database', () => ({
  pool: {
    query: vi.fn().mockResolvedValue({
      rows: [{ id: '038d70c8-5141-4894-8395-3ed40bc50eed' }],
    }),
  },
}));

describe('TransacaoBusiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve validar tipo inválido ao criar transação', async () => {
    await expect(
      TransacaoBusiness.criar(
        // @ts-expect-error teste de tipo invalido
        { tipo: 'invalido', descricao: 'Teste', valor: 50, data: '2026-05-01' },
        1
      )
    ).rejects.toThrow("Tipo deve ser 'entrada' ou 'saida'.");
  });

  it('deve validar descrição ou valor ausentes', async () => {
    await expect(
      TransacaoBusiness.criar(
        { tipo: 'saida', descricao: '', valor: 50, data: '2026-05-01' },
        1
      )
    ).rejects.toThrow('Descrição e valor são obrigatórios.');
  });

  it('deve criar transação regular (conta corrente) salvando na tabela transacoes', async () => {
    vi.mocked(TransacaoRepository.criar).mockResolvedValueOnce({
      id: 10,
      tipo: 'saida',
      descricao: 'Padaria',
      valor: 25,
      data: '2026-10-18',
      status: 'pago',
      userid: 1,
    });

    const res = await TransacaoBusiness.criar(
      {
        tipo: 'saida',
        descricao: 'Padaria',
        valor: 25,
        data: '2026-10-18',
        ispaycart: false,
      },
      1
    );

    expect(TransacaoRepository.criar).toHaveBeenCalledTimes(1);
    expect(CardBusiness.lancarTransacao).not.toHaveBeenCalled();
    expect(res.id).toBe(10);
    expect(res.descricao).toBe('Padaria');
  });

  it('deve redirecionar transação no cartão para card_transactions via CardBusiness e NÃO chamar TransacaoRepository.criar', async () => {
    vi.mocked(CardBusiness.lancarTransacao).mockResolvedValueOnce({
      transacao: {
        id: 'tx-card-uuid-1',
        cartao_id: '038d70c8-5141-4894-8395-3ed40bc50eed',
        descricao: 'Supermercado Mensal',
        valor_total: 450,
        quantidade_parcelas: 1,
        data_compra: new Date('2026-10-18T12:00:00Z'),
        categoria_id: 2,
        criado_em: new Date('2026-10-18T12:00:00Z'),
      },
      itens: [],
      cartaoAtualizado: {} as any,
    });

    const res = await TransacaoBusiness.criar(
      {
        tipo: 'saida',
        descricao: 'Supermercado Mensal',
        valor: 450,
        data: '2026-10-18',
        ispaycart: true,
        cartaoid: '038d70c8-5141-4894-8395-3ed40bc50eed',
        idcategoria: 2,
      },
      1
    );

    // Garante que NÃO salvou na tabela transacoes
    expect(TransacaoRepository.criar).not.toHaveBeenCalled();

    // Garante que direcionou para CardBusiness.lancarTransacao (card_transactions)
    expect(CardBusiness.lancarTransacao).toHaveBeenCalledWith(
      expect.objectContaining({
        cartao_id: '038d70c8-5141-4894-8395-3ed40bc50eed',
        descricao: 'Supermercado Mensal',
        valor_total: 450,
        quantidade_parcelas: 1,
        categoria_id: 2,
      }),
      1
    );

    expect(res.id).toBe('tx-card-uuid-1');
    expect(res.source_type).toBe('CREDIT_CARD_TRANSACTION');
  });

  it('deve redirecionar compra parcelada no cartão para card_transactions e invoice_items sem chamar TransacaoRepository.criar', async () => {
    vi.mocked(CardBusiness.lancarTransacao).mockResolvedValueOnce({
      transacao: {
        id: 'tx-card-uuid-2',
        cartao_id: '038d70c8-5141-4894-8395-3ed40bc50eed',
        descricao: 'Notebook',
        valor_total: 3000,
        quantidade_parcelas: 3,
        data_compra: new Date('2026-10-18T12:00:00Z'),
        categoria_id: 5,
        criado_em: new Date('2026-10-18T12:00:00Z'),
      },
      itens: [
        {
          id: 'item-1',
          fatura_id: 'fat-1',
          transacao_id: 'tx-card-uuid-2',
          numero_parcela: 1,
          valor_parcela: 1000,
          data_compra: new Date('2026-10-18T12:00:00Z'),
        },
        {
          id: 'item-2',
          fatura_id: 'fat-2',
          transacao_id: 'tx-card-uuid-2',
          numero_parcela: 2,
          valor_parcela: 1000,
          data_compra: new Date('2026-10-18T12:00:00Z'),
        },
        {
          id: 'item-3',
          fatura_id: 'fat-3',
          transacao_id: 'tx-card-uuid-2',
          numero_parcela: 3,
          valor_parcela: 1000,
          data_compra: new Date('2026-10-18T12:00:00Z'),
        },
      ],
      cartaoAtualizado: {} as any,
    });

    const parcelas = await TransacaoBusiness.criarParcelada(
      {
        descricao: 'Notebook',
        valor: 3000,
        data: '2026-10-18',
        parcelado: true,
        ispaycart: true,
        cartaoid: '038d70c8-5141-4894-8395-3ed40bc50eed',
        idcategoria: 5,
        parcelas: {
          QtdParcelas: 3,
          Valor: 1000,
        },
      },
      1
    );

    // Garante que NÃO salvou na tabela transacoes
    expect(TransacaoRepository.criar).not.toHaveBeenCalled();

    // Garante que enviou as 3 parcelas para card_transactions
    expect(CardBusiness.lancarTransacao).toHaveBeenCalledWith(
      expect.objectContaining({
        cartao_id: '038d70c8-5141-4894-8395-3ed40bc50eed',
        descricao: 'Notebook',
        valor_total: 3000,
        quantidade_parcelas: 3,
        categoria_id: 5,
      }),
      1
    );

    expect(parcelas).toHaveLength(3);
    expect(parcelas[0].source_type).toBe('CREDIT_CARD_INVOICE_ITEM');
  });

  it('deve criar parcelas não-cartão salvando na tabela transacoes', async () => {
    vi.mocked(TransacaoRepository.criarEmLote).mockImplementation(async (rows) =>
      rows.map((tr, i) => ({
        id: i + 1,
        tipo: tr.tipo,
        descricao: tr.descricao,
        valor: tr.valor,
        categoria: tr.categoria,
        data: tr.data,
        status: tr.status ?? 'pendente',
        userid: 1,
      }))
    );

    const parcelas = await TransacaoBusiness.criarParcelada(
      {
        descricao: 'Carnê Reforma',
        valor: 300,
        data: '2026-01-15',
        parcelado: true,
        ispaycart: false,
        parcelas: {
          QtdParcelas: 3,
          Valor: 100,
        },
      },
      1
    );

    expect(parcelas).toHaveLength(3);
    // Um único INSERT em lote, com o mesmo grupo de parcelamento numerado 1..3
    expect(TransacaoRepository.criarEmLote).toHaveBeenCalledTimes(1);
    expect(TransacaoRepository.criar).not.toHaveBeenCalled();
    const [linhas, userid] = vi.mocked(TransacaoRepository.criarEmLote).mock.calls[0];
    expect(userid).toBe(1);
    expect(new Set(linhas.map((l) => l.parcela_grupo_id)).size).toBe(1);
    expect(linhas.map((l) => [l.parcela_numero, l.parcela_total])).toEqual([[1, 3], [2, 3], [3, 3]]);
    expect(linhas.map((l) => l.data)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
    expect(CardBusiness.lancarTransacao).not.toHaveBeenCalled();
  });

  it('deve rejeitar quantidade de parcelas não inteira ou absurda', async () => {
    const base = { descricao: 'X', valor: 100, data: '2026-01-15', parcelado: true };
    await expect(
      TransacaoBusiness.criarParcelada({ ...base, parcelas: { QtdParcelas: 1000, Valor: 0.1 } }, 1)
    ).rejects.toThrow('Quantidade de parcelas inválida.');
    await expect(
      TransacaoBusiness.criarParcelada({ ...base, parcelas: { QtdParcelas: 2.5, Valor: 40 } }, 1)
    ).rejects.toThrow('Quantidade de parcelas inválida.');
    expect(TransacaoRepository.criarEmLote).not.toHaveBeenCalled();
  });

  it('saveNewuser deve gravar pagamento = data e um grupo de parcelamento por despesa fixa', async () => {
    vi.mocked(TransacaoRepository.criarEmLote).mockImplementation(async (rows) =>
      rows.map((tr, i) => ({ ...tr, id: i + 1, userid: 1, status: 'pendente' as const, valor: tr.valor, idsubcategoria: null }))
    );

    const res = await TransacaoBusiness.saveNewuser(
      {
        entradas: [{ descricao: 'Salário', valor: 5000, day_of_month: 5 }],
        saidas: [
          { descricao: 'Aluguel', valor: 1500, day_of_month: 10 },
          { descricao: 'Internet', valor: 100, day_of_month: 20 },
        ],
      },
      1
    );

    expect(res.quantidadeCriada).toBe(36);
    expect(TransacaoRepository.criarEmLote).toHaveBeenCalledTimes(1);
    const [linhas] = vi.mocked(TransacaoRepository.criarEmLote).mock.calls[0];
    expect(linhas.every((l) => l.pagamento === l.data)).toBe(true);

    const aluguel = linhas.filter((l) => l.descricao === 'Aluguel - Parcela');
    expect(aluguel).toHaveLength(12);
    expect(new Set(aluguel.map((l) => l.parcela_grupo_id)).size).toBe(1);
    expect(aluguel.map((l) => l.parcela_numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(aluguel[0].parcela_grupo_id).not.toBe(
      linhas.find((l) => l.descricao === 'Internet - Parcela')?.parcela_grupo_id
    );
    expect(linhas.filter((l) => l.tipo === 'entrada').every((l) => !l.parcela_grupo_id)).toBe(true);
  });

  describe('extrato', () => {
    it('1ª página paginada traz totais do período inteiro; páginas seguintes não', async () => {
      const totais = { entradas: 5000, saidas: 1200.5, pendentes: 3 };
      vi.mocked(TransacaoRepository.extrato).mockResolvedValue([]);
      vi.mocked(TransacaoRepository.extratoTotais).mockResolvedValueOnce(totais);

      const p1 = await TransacaoBusiness.extrato({ paginado: true, mes: '3', ano: '2026' }, 1);
      expect(TransacaoRepository.extratoTotais).toHaveBeenCalledWith(1, '2026-03-01', '2026-04-01');
      expect(p1.totais).toEqual(totais);

      vi.mocked(TransacaoRepository.extratoTotais).mockClear();
      const p2 = await TransacaoBusiness.extrato({ cursor: '2026-03-15_200', mes: '3', ano: '2026' }, 1);
      expect(TransacaoRepository.extratoTotais).not.toHaveBeenCalled();
      expect(p2).not.toHaveProperty('totais');
    });

    it('sem paginação não calcula totais (resposta continua sendo o array)', async () => {
      vi.mocked(TransacaoRepository.extrato).mockResolvedValueOnce([]);
      const res = await TransacaoBusiness.extrato({ mes: '3', ano: '2026' }, 1);
      expect(TransacaoRepository.extratoTotais).not.toHaveBeenCalled();
      expect(res).not.toHaveProperty('totais');
    });

    it('sem paginação mantém o comportamento antigo (sem limite padrão)', async () => {
      vi.mocked(TransacaoRepository.extrato).mockResolvedValueOnce([]);
      const res = await TransacaoBusiness.extrato({ mes: '3', ano: '2026' }, 1);
      expect(TransacaoRepository.extrato).toHaveBeenCalledWith(1, '2026-03-01', '2026-04-01', null, null);
      expect(res.next_cursor).toBeNull();
    });

    it('dezembro termina em 1º de janeiro do ano seguinte', async () => {
      vi.mocked(TransacaoRepository.extrato).mockResolvedValueOnce([]);
      await TransacaoBusiness.extrato({ mes: '12', ano: '2026' }, 1);
      expect(TransacaoRepository.extrato).toHaveBeenCalledWith(1, '2026-12-01', '2027-01-01', null, null);
    });

    it('com cursor usa keyset, limite padrão 50 e devolve next_cursor quando a página está cheia', async () => {
      const pagina = Array.from({ length: 50 }, (_, i) => ({
        id: 100 - i,
        tipo: 'saida' as const,
        descricao: 'x',
        valor: 1,
        data: '2026-03-10',
        status: 'pago' as const,
        userid: 1,
      }));
      vi.mocked(TransacaoRepository.extrato).mockResolvedValueOnce(pagina);

      const res = await TransacaoBusiness.extrato({ cursor: '2026-03-15_200' }, 1);
      expect(TransacaoRepository.extrato).toHaveBeenCalledWith(1, null, null, { data: '2026-03-15', id: 200 }, 50);
      expect(res.next_cursor).toBe('2026-03-10_51');
    });

    it('limita a página a 200 e rejeita cursor/mês inválidos', async () => {
      vi.mocked(TransacaoRepository.extrato).mockResolvedValueOnce([]);
      await TransacaoBusiness.extrato({ paginado: true, limit: '1000' }, 1);
      expect(TransacaoRepository.extrato).toHaveBeenCalledWith(1, null, null, null, 200);

      await expect(TransacaoBusiness.extrato({ cursor: 'abc' }, 1)).rejects.toThrow(/Cursor inválido/);
      await expect(TransacaoBusiness.extrato({ mes: '13', ano: '2026' }, 1)).rejects.toThrow('Mês inválido.');
    });

    describe('parcelas de cartão', () => {
      const conta = (id: number, data: string) => ({
        id,
        tipo: 'saida' as const,
        descricao: `conta ${id}`,
        valor: 10,
        data,
        status: 'pago' as const,
        userid: 1,
      });
      const cartao = (uuid: string, data: string) => ({
        id: `cartao:${uuid}`,
        tipo: 'saida' as const,
        descricao: `cartão ${uuid}`,
        valor: 20,
        data,
        status: 'pendente' as const,
        userid: 1,
        origem: 'CARTAO',
      });
      const U1 = '11111111-1111-1111-1111-111111111111';
      const U2 = '22222222-2222-2222-2222-222222222222';

      it('mescla conta e cartão por data desc; no mesmo dia, conta antes de cartão', async () => {
        vi.mocked(TransacaoRepository.extrato).mockResolvedValueOnce([
          conta(9, '2026-03-20'),
          conta(5, '2026-03-10'),
        ]);
        vi.mocked(TransacaoRepository.extratoCartao).mockResolvedValueOnce([
          cartao(U2, '2026-03-20'),
          cartao(U1, '2026-03-15'),
        ]);

        const res = await TransacaoBusiness.extrato({ mes: '3', ano: '2026' }, 1);

        expect(res.items.map((i) => i.id)).toEqual([9, `cartao:${U2}`, `cartao:${U1}`, 5]);
        expect(TransacaoRepository.extratoCartao).toHaveBeenCalledWith(1, '2026-03-01', '2026-04-01', null, null);
      });

      it('corta a página mesclada no limite e o cursor aponta para o último item exibido', async () => {
        vi.mocked(TransacaoRepository.extrato).mockResolvedValueOnce([
          conta(9, '2026-03-20'),
          conta(5, '2026-03-10'),
        ]);
        vi.mocked(TransacaoRepository.extratoCartao).mockResolvedValueOnce([
          cartao(U2, '2026-03-20'),
          cartao(U1, '2026-03-15'),
        ]);

        const res = await TransacaoBusiness.extrato({ paginado: true, limit: '2', mes: '3', ano: '2026' }, 1);

        expect(res.items.map((i) => i.id)).toEqual([9, `cartao:${U2}`]);
        expect(res.next_cursor).toBe(`2026-03-20_cartao:${U2}`);
      });

      it('cursor de conta: cartão inclui o dia inteiro do cursor', async () => {
        vi.mocked(TransacaoRepository.extrato).mockResolvedValueOnce([]);

        await TransacaoBusiness.extrato({ cursor: '2026-03-15_200' }, 1);

        expect(TransacaoRepository.extratoCartao).toHaveBeenCalledWith(
          1, null, null, { data: '2026-03-15', chave: 'g' }, 50
        );
      });

      it('cursor de cartão: conta só a partir do dia anterior e cartão após o uuid', async () => {
        vi.mocked(TransacaoRepository.extrato).mockResolvedValueOnce([]);

        await TransacaoBusiness.extrato({ cursor: `2026-03-15_cartao:${U1}` }, 1);

        expect(TransacaoRepository.extrato).toHaveBeenCalledWith(1, null, null, { data: '2026-03-15', id: 0 }, 50);
        expect(TransacaoRepository.extratoCartao).toHaveBeenCalledWith(
          1, null, null, { data: '2026-03-15', chave: U1 }, 50
        );
      });
    });
  });

  describe('isolamento por usuário', () => {
    it('não deve atualizar transação de outro usuário', async () => {
      vi.mocked(TransacaoRepository.buscarPorId).mockResolvedValueOnce(undefined);

      await expect(
        TransacaoBusiness.atualizar(10, { descricao: 'x' }, 2)
      ).rejects.toBeInstanceOf(TransacaoNotFoundError); // controller responde 404
      expect(TransacaoRepository.buscarPorId).toHaveBeenCalledWith(10, 2);
      expect(TransacaoRepository.atualizar).not.toHaveBeenCalled();
    });

    it('não deve excluir transação de outro usuário', async () => {
      vi.mocked(TransacaoRepository.buscarPorId).mockResolvedValueOnce(undefined);

      await expect(TransacaoBusiness.excluir(10, 2)).rejects.toThrow('Transação não encontrada.');
      expect(TransacaoRepository.excluir).not.toHaveBeenCalled();
    });

    it('deve repassar o userid ao marcar como pago e falhar se nada for atualizado', async () => {
      vi.mocked(TransacaoRepository.uptopago).mockResolvedValueOnce(false);

      await expect(TransacaoBusiness.uptopago(10, 2)).rejects.toThrow('Transação não encontrada.');
      expect(TransacaoRepository.uptopago).toHaveBeenCalledWith(10, 2);
    });
  });

  describe('posse da categoria (idcategoria)', () => {
    it('criar: rejeita categoria não visível ao usuário e não grava', async () => {
      vi.mocked(CategoriaBusiness.categoriaVisivel).mockResolvedValueOnce(false);

      await expect(
        TransacaoBusiness.criar({ tipo: 'saida', descricao: 'X', valor: 10, data: '2026-02-01', idcategoria: 77 }, 1)
      ).rejects.toThrow('Categoria não encontrada.');
      expect(CategoriaBusiness.categoriaVisivel).toHaveBeenCalledWith(77, 1);
      expect(TransacaoRepository.criar).not.toHaveBeenCalled();
    });

    it('criarParcelada: rejeita categoria não visível e não grava parcelas', async () => {
      vi.mocked(CategoriaBusiness.categoriaVisivel).mockResolvedValueOnce(false);

      await expect(
        TransacaoBusiness.criarParcelada(
          { descricao: 'X', valor: 100, data: '2026-02-01', parcelado: true, idcategoria: 77, parcelas: { QtdParcelas: 2, Valor: 50 } },
          1
        )
      ).rejects.toThrow('Categoria não encontrada.');
      expect(TransacaoRepository.criarEmLote).not.toHaveBeenCalled();
    });

    it('atualizar: rejeita troca para categoria não visível', async () => {
      vi.mocked(TransacaoRepository.buscarPorId).mockResolvedValueOnce({
        id: 10, tipo: 'saida', descricao: 'X', valor: 10, data: '2026-02-01', status: 'pendente', userid: 1,
      });
      vi.mocked(CategoriaBusiness.categoriaVisivel).mockResolvedValueOnce(false);

      await expect(TransacaoBusiness.atualizar(10, { idcategoria: 77 }, 1)).rejects.toThrow('Categoria não encontrada.');
      expect(TransacaoRepository.atualizar).not.toHaveBeenCalled();
    });

    it('sem idcategoria não consulta posse', async () => {
      vi.mocked(TransacaoRepository.criar).mockResolvedValueOnce({
        id: 1, tipo: 'saida', descricao: 'X', valor: 10, data: '2026-02-01', status: 'pendente', userid: 1,
      });

      await TransacaoBusiness.criar({ tipo: 'saida', descricao: 'X', valor: 10, data: '2026-02-01' }, 1);
      expect(CategoriaBusiness.categoriaVisivel).not.toHaveBeenCalled();
    });
  });

  describe('subcategoria (fase 1: idsubcategoria + categoria legado)', () => {
    const base = { tipo: 'saida' as const, descricao: 'X', valor: 10, data: '2026-02-01', idcategoria: 3 };
    const criada = { id: 1, tipo: 'saida' as const, descricao: 'X', valor: 10, data: '2026-02-01', status: 'pendente' as const, userid: 1 };

    beforeEach(() => {
      vi.mocked(TransacaoRepository.criar).mockResolvedValue(criada);
    });

    it('idsubcategoria válido é gravado e espelhado na coluna legada', async () => {
      vi.mocked(SubcategoriaBusiness.subcategoriaDaCategoria).mockResolvedValueOnce(true);

      await TransacaoBusiness.criar({ ...base, idsubcategoria: 8 }, 1);

      expect(SubcategoriaBusiness.subcategoriaDaCategoria).toHaveBeenCalledWith(8, 3, 1);
      expect(TransacaoRepository.criar).toHaveBeenCalledWith(
        expect.objectContaining({ idcategoria: 3, idsubcategoria: 8, categoria: 8 }),
        1
      );
    });

    it('idsubcategoria de outra categoria/usuário → 400 sem gravar', async () => {
      vi.mocked(SubcategoriaBusiness.subcategoriaDaCategoria).mockResolvedValueOnce(false);

      await expect(TransacaoBusiness.criar({ ...base, idsubcategoria: 99 }, 1)).rejects.toThrow(
        'Subcategoria não encontrada.'
      );
      expect(TransacaoRepository.criar).not.toHaveBeenCalled();
    });

    it('idsubcategoria sem idcategoria → 400', async () => {
      await expect(
        TransacaoBusiness.criar({ ...base, idcategoria: null, idsubcategoria: 8 }, 1)
      ).rejects.toThrow('Subcategoria não encontrada.');
    });

    it('categoria legado que é subcategoria da categoria vira idsubcategoria', async () => {
      vi.mocked(SubcategoriaBusiness.subcategoriaDaCategoria).mockResolvedValueOnce(true);

      await TransacaoBusiness.criar({ ...base, categoria: 8 }, 1);

      expect(TransacaoRepository.criar).toHaveBeenCalledWith(
        expect.objectContaining({ idsubcategoria: 8, categoria: 8 }),
        1
      );
    });

    it('categoria legado inválido é ignorado (não quebra clientes antigos) e mantido na coluna legada', async () => {
      vi.mocked(SubcategoriaBusiness.subcategoriaDaCategoria).mockResolvedValueOnce(false);

      await TransacaoBusiness.criar({ ...base, categoria: 777 }, 1);

      expect(TransacaoRepository.criar).toHaveBeenCalledWith(
        expect.objectContaining({ idsubcategoria: null, categoria: 777 }),
        1
      );
    });

    it('categoria legado igual a idcategoria = sem subcategoria (não consulta)', async () => {
      await TransacaoBusiness.criar({ ...base, categoria: 3 }, 1);

      expect(SubcategoriaBusiness.subcategoriaDaCategoria).not.toHaveBeenCalled();
      expect(TransacaoRepository.criar).toHaveBeenCalledWith(
        expect.objectContaining({ idsubcategoria: null, categoria: 3 }),
        1
      );
    });

    it('sem categoria nem idsubcategoria: coluna legada recebe idcategoria (como o front fazia)', async () => {
      await TransacaoBusiness.criar(base, 1);

      expect(TransacaoRepository.criar).toHaveBeenCalledWith(
        expect.objectContaining({ idsubcategoria: null, categoria: 3 }),
        1
      );
    });

    it('PUT sem categoria mantém a coluna legada atual (antes era apagada)', async () => {
      vi.mocked(TransacaoRepository.buscarPorId).mockResolvedValueOnce({ ...criada, idcategoria: 3, categoria: 8 });

      await TransacaoBusiness.atualizar(1, { descricao: 'Novo' }, 1);

      expect(TransacaoRepository.atualizar).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ descricao: 'Novo', categoria: 8 }),
        1,
        { alterar: false, valor: null }
      );
    });

    it('PUT trocando idcategoria sem subcategoria limpa idsubcategoria', async () => {
      vi.mocked(TransacaoRepository.buscarPorId).mockResolvedValueOnce({ ...criada, idcategoria: 3, categoria: 8 });

      await TransacaoBusiness.atualizar(1, { idcategoria: 4 }, 1);

      expect(TransacaoRepository.atualizar).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ idcategoria: 4, categoria: 4 }),
        1,
        { alterar: true, valor: null }
      );
    });

    it('PUT com idsubcategoria valida contra a categoria efetiva (a atual, se não vier outra)', async () => {
      vi.mocked(TransacaoRepository.buscarPorId).mockResolvedValueOnce({ ...criada, idcategoria: 3 });
      vi.mocked(SubcategoriaBusiness.subcategoriaDaCategoria).mockResolvedValueOnce(true);

      await TransacaoBusiness.atualizar(1, { idsubcategoria: 8 }, 1);

      expect(SubcategoriaBusiness.subcategoriaDaCategoria).toHaveBeenCalledWith(8, 3, 1);
      expect(TransacaoRepository.atualizar).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ categoria: 8 }),
        1,
        { alterar: true, valor: 8 }
      );
    });
  });
});
