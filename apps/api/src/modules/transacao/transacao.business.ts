import { TransacaoRepository } from './transacao.repository';
import { CartaoRepository } from '../cartao/cartao.repository';
import { CardBusiness } from '../card/card.business';
import { pool } from '../../core/config/database';
import { getPeriodoFatura } from '../../common/utils/periodo-fatura';
import {
  TransacaoEntity,
  CreateTransacaoDto,
  CreateParceladaDto,
  InitialUserTransactionsDto,
  DespesaParceladaItem,
  LinhaTemporalItem,
} from './transacao.types';

export async function resolverCartaoId(
  cartaoid: string | number | null | undefined,
  userid: number
): Promise<string> {
  const isUuid = (val: unknown): boolean =>
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

  if (cartaoid && isUuid(cartaoid)) {
    try {
      const res = await pool.query(
        'SELECT id FROM credit_cards WHERE id = $1 AND usuario_id = $2',
        [String(cartaoid).trim(), userid]
      );
      if (res.rows.length > 0) {
        return res.rows[0].id;
      }
    } catch {
      return String(cartaoid).trim();
    }
    return String(cartaoid).trim();
  }

  try {
    if (cartaoid && !isNaN(Number(cartaoid)) && Number(cartaoid) > 0) {
      try {
        const cartaoLegado = await pool.query(
          'SELECT nome FROM cartoes WHERE id = $1 AND userid = $2',
          [Number(cartaoid), userid]
        );
        if (cartaoLegado.rows.length > 0) {
          const ccRes = await pool.query(
            'SELECT id FROM credit_cards WHERE usuario_id = $1 AND LOWER(TRIM(nome)) = LOWER(TRIM($2)) LIMIT 1',
            [userid, cartaoLegado.rows[0].nome]
          );
          if (ccRes.rows.length > 0) {
            return ccRes.rows[0].id;
          }
        }
      } catch {
        // Tabela cartoes pode não existir
      }
    }

    const primeiro = await pool.query(
      'SELECT id FROM credit_cards WHERE usuario_id = $1 AND ativo = true ORDER BY criado_em ASC LIMIT 1',
      [userid]
    );
    if (primeiro.rows.length > 0) {
      return primeiro.rows[0].id;
    }

    const novo = await pool.query(
      `INSERT INTO credit_cards (usuario_id, nome, bandeira, limite_total, dia_fechamento, dia_vencimento, cor_identificacao)
       VALUES ($1, 'Cartão Principal', 'Outros', 5000, 1, 10, '#0f172a')
       RETURNING id`,
      [userid]
    );
    return novo.rows[0].id;
  } catch {
    return String(cartaoid || '038d70c8-5141-4894-8395-3ed40bc50eed');
  }
}

function calcularDataPagamento(
  dataIso: string | Date,
  diaFatura?: number | null
): string {
  let baseYear: number;
  let baseMonth: number;
  let baseDay: number;

  if (typeof dataIso === 'string' && dataIso.includes('-')) {
    const parts = dataIso.split('T')[0].split('-').map(Number);
    baseYear = parts[0];
    baseMonth = parts[1];
    baseDay = parts[2];
  } else {
    const d = new Date(dataIso);
    baseYear = d.getFullYear();
    baseMonth = d.getMonth() + 1;
    baseDay = d.getDate();
  }

  if (diaFatura && diaFatura > 0) {
    let mesFatura = baseMonth;
    let anoFatura = baseYear;
    if (baseDay >= diaFatura) {
      mesFatura += 1;
      if (mesFatura > 12) {
        mesFatura = 1;
        anoFatura += 1;
      }
    }
    const mm = String(mesFatura).padStart(2, '0');
    const dd = String(diaFatura).padStart(2, '0');
    return `${anoFatura}-${mm}-${dd}`;
  }

  const mm = String(baseMonth).padStart(2, '0');
  const dd = String(baseDay).padStart(2, '0');
  return `${baseYear}-${mm}-${dd}`;
}

export const TransacaoBusiness = {
  async criar(transacao: CreateTransacaoDto, userid: number): Promise<TransacaoEntity> {
    if (!['entrada', 'saida', 'cartao'].includes(transacao.tipo)) {
      throw new Error("Tipo deve ser 'entrada' ou 'saida'.");
    }
    if (!transacao.descricao || transacao.valor == null) {
      throw new Error('Descrição e valor são obrigatórios.');
    }

    const isCartao = Boolean(
      transacao.ispaycart ||
      transacao.tipo === 'cartao' ||
      (transacao.cartaoid != null && String(transacao.cartaoid).trim().length > 0)
    );

    // Se for transação no cartão, salva exclusivamente em card_transactions e invoice_items
    if (isCartao) {
      const cartaoId = await resolverCartaoId(transacao.cartaoid, userid);
      const dataCompra =
        transacao.data instanceof Date
          ? transacao.data
          : new Date(typeof transacao.data === 'string' ? transacao.data : String(transacao.data));
      const categoriaId = transacao.idcategoria
        ? Number(transacao.idcategoria)
        : transacao.categoria && !isNaN(Number(transacao.categoria))
        ? Number(transacao.categoria)
        : undefined;

      const resultado = await CardBusiness.lancarTransacao(
        {
          cartao_id: cartaoId,
          descricao: transacao.descricao.trim(),
          valor_total: Number(transacao.valor),
          quantidade_parcelas: 1,
          data_compra: dataCompra,
          categoria_id: categoriaId,
        },
        userid
      );

      return {
        id: resultado.transacao.id,
        tipo: 'cartao',
        descricao: resultado.transacao.descricao,
        valor: resultado.transacao.valor_total,
        categoria: resultado.transacao.categoria_id,
        idcategoria: resultado.transacao.categoria_id,
        data: resultado.transacao.data_compra,
        status: 'pendente',
        userid,
        ispaycart: true,
        cartaoid: (transacao.cartaoid ?? cartaoId) as any,
        criado_em: resultado.transacao.criado_em,
        source_type: 'CREDIT_CARD_TRANSACTION',
        source_id: resultado.transacao.id,
      };
    }

    const cartaoidNum =
      transacao.cartaoid && !isNaN(Number(transacao.cartaoid)) && Number(transacao.cartaoid) > 0
        ? Number(transacao.cartaoid)
        : null;

    let dataPagamento = transacao.pagamento;
    if (!dataPagamento) {
      let diaFatura: number | null = null;
      if (cartaoidNum) {
        const cartao = await CartaoRepository.buscar(cartaoidNum);
        if (cartao?.dia_fatura) {
          diaFatura = cartao.dia_fatura;
        }
      }
      dataPagamento = calcularDataPagamento(transacao.data, diaFatura);
    }

    return await TransacaoRepository.criar(
      {
        ...transacao,
        cartaoid: cartaoidNum,
        pagamento: dataPagamento,
      },
      userid
    );
  },

  async criarParcelada(
    payload: CreateParceladaDto,
    userId: number
  ): Promise<TransacaoEntity[]> {
    if (!payload?.parcelado && !payload?.ispaycart && payload?.tipo !== 'cartao') {
      throw new Error('Transação não é parcelada ou não é de cartão.');
    }

    const qtdParcelas = Number(payload.parcelas?.QtdParcelas ?? 1);
    if (qtdParcelas <= 0) {
      throw new Error('Quantidade de parcelas inválida.');
    }

    const valorTotal = Number(payload.valor);
    if (isNaN(valorTotal) || valorTotal <= 0) {
      throw new Error('Valor total inválido.');
    }

    const valorCalculado = Number((valorTotal / qtdParcelas).toFixed(2));
    const valorParcelaInformado =
      payload.parcelas?.Valor != null && Number(payload.parcelas.Valor) > 0
        ? Number(payload.parcelas.Valor)
        : valorCalculado;

    if (Math.abs(valorCalculado - valorParcelaInformado) > 0.05) {
      throw new Error('Valor das parcelas não confere com o valor total.');
    }

    const isCartao = Boolean(
      payload.ispaycart ||
      payload.tipo === 'cartao' ||
      (payload.cartaoid != null && String(payload.cartaoid).trim().length > 0)
    );

    // Se for compra parcelada no cartão, salva exclusivamente em card_transactions e invoice_items
    if (isCartao) {
      const cartaoId = await resolverCartaoId(payload.cartaoid, userId);
      const dataCompra =
        payload.data instanceof Date
          ? payload.data
          : new Date(typeof payload.data === 'string' ? payload.data : String(payload.data));
      const categoriaId = payload.idcategoria
        ? Number(payload.idcategoria)
        : payload.categoria && !isNaN(Number(payload.categoria))
        ? Number(payload.categoria)
        : undefined;

      const resultado = await CardBusiness.lancarTransacao(
        {
          cartao_id: cartaoId,
          descricao: payload.descricao.trim(),
          valor_total: valorTotal,
          quantidade_parcelas: qtdParcelas,
          data_compra: dataCompra,
          categoria_id: categoriaId,
        },
        userId
      );

      return resultado.itens.map((it) => ({
        id: it.id,
        tipo: 'cartao',
        descricao: `${payload.descricao} (${it.numero_parcela}/${qtdParcelas})`,
        valor: it.valor_parcela,
        categoria: payload.categoria,
        idcategoria: payload.idcategoria,
        data: it.data_compra || payload.data,
        status: 'pendente',
        userid: userId,
        ispaycart: true,
        cartaoid: (payload.cartaoid ?? cartaoId) as any,
        source_type: 'CREDIT_CARD_INVOICE_ITEM',
        source_id: it.id,
      }));
    }

    const cartaoidNum =
      payload.cartaoid && !isNaN(Number(payload.cartaoid)) && Number(payload.cartaoid) > 0
        ? Number(payload.cartaoid)
        : null;

    let cartao = null;
    if (cartaoidNum) {
      cartao = await CartaoRepository.buscar(cartaoidNum);
    }

    let baseYear: number;
    let baseMonth: number;
    let baseDay: number;

    if (typeof payload.data === 'string' && payload.data.includes('-')) {
      const parts = payload.data.split('T')[0].split('-').map(Number);
      baseYear = parts[0];
      baseMonth = parts[1];
      baseDay = parts[2];
    } else {
      const d = new Date(payload.data);
      baseYear = d.getFullYear();
      baseMonth = d.getMonth() + 1;
      baseDay = d.getDate();
    }

    const parcelasCriadas: TransacaoEntity[] = [];

    for (let i = 0; i < qtdParcelas; i++) {
      let mesParcela = baseMonth + i;
      const anoParcela = baseYear + Math.floor((mesParcela - 1) / 12);
      mesParcela = ((mesParcela - 1) % 12) + 1;

      const lastDayOfMonth = new Date(anoParcela, mesParcela, 0).getDate();
      const diaParcela = Math.min(baseDay, lastDayOfMonth);

      const mm = String(mesParcela).padStart(2, '0');
      const dd = String(diaParcela).padStart(2, '0');
      const dataParcelaStr = `${anoParcela}-${mm}-${dd}`;

      const dataPagamentoParcela = calcularDataPagamento(
        dataParcelaStr,
        cartao?.dia_fatura
      );

      const parcela: CreateTransacaoDto = {
        tipo: 'saida',
        descricao: `${payload.descricao} - Parcela`,
        valor: valorParcelaInformado,
        categoria: payload.categoria,
        idcategoria: payload.idcategoria,
        data: dataParcelaStr,
        pagamento: dataPagamentoParcela,
        status: 'pendente',
        ispaycart: Boolean(payload.ispaycart),
        cartaoid: cartaoidNum,
      };

      const criada = await TransacaoRepository.criar(parcela, userId);
      parcelasCriadas.push(criada);
    }

    return parcelasCriadas;
  },

  async saveNewuser(
    payload: InitialUserTransactionsDto,
    userId: number
  ): Promise<{ ok: boolean; quantidadeCriada: number; transacoes: TransacaoEntity[] }> {
    const { entradas, saidas } = payload;

    if (!entradas || !Array.isArray(entradas) || entradas.length === 0) {
      throw new Error('É necessário pelo menos uma ENTRADA fixa.');
    }

    if (!saidas || !Array.isArray(saidas) || saidas.length === 0) {
      throw new Error('É necessário pelo menos uma SAÍDA fixa.');
    }

    const monthsToGenerate = 12;
    const hoje = new Date();
    const startYear = hoje.getFullYear();
    const startMonth = hoje.getMonth();

    const todasTransacoes: CreateTransacaoDto[] = [];

    const lastDayOfMonth = (year: number, monthZero: number) => {
      return new Date(year, monthZero + 1, 0).getDate();
    };

    const safeDay = (year: number, monthZero: number, day: number) => {
      const last = lastDayOfMonth(year, monthZero);
      return Math.min(Math.max(1, day), last);
    };

    for (let m = 0; m < monthsToGenerate; m++) {
      const year = startYear + Math.floor((startMonth + m) / 12);
      const month = (startMonth + m) % 12;

      for (const entrada of entradas) {
        const valorEntrada = Number(entrada.value ?? entrada.valor);
        const dia = safeDay(year, month, Number(entrada.day_of_month));
        const data = new Date(year, month, dia);

        todasTransacoes.push({
          tipo: 'entrada',
          descricao: entrada.description || entrada.descricao || 'Entrada fixa',
          valor: Math.abs(valorEntrada),
          categoria: entrada.category || entrada.categoria || undefined,
          data,
          status: 'pendente',
          ispaycart: false,
        });
      }

      for (const saida of saidas) {
        const valorSaida = Number(saida.value ?? saida.valor);
        const dia = safeDay(year, month, Number(saida.day_of_month));
        const data = new Date(year, month, dia);

        todasTransacoes.push({
          tipo: 'saida',
          descricao: (saida.description || saida.descricao || 'Despesa fixa') + ' - Parcela',
          valor: Math.abs(valorSaida),
          categoria: saida.category ?? saida.categoria ?? undefined,
          data,
          status: 'pendente',
          ispaycart: false,
        });
      }
    }

    const criadas: TransacaoEntity[] = [];
    for (const tr of todasTransacoes) {
      const criada = await TransacaoRepository.criar(tr, userId);
      criadas.push(criada);
    }

    return {
      ok: true,
      quantidadeCriada: criadas.length,
      transacoes: criadas,
    };
  },

  async listar(
    mes: number | null,
    ano: number | null,
    userid: number,
    cardId?: string | number | null
  ): Promise<{
    soma_parcelados: number;
    soma_adicionais: number;
    soma_pagos: number;
    parceladas: TransacaoEntity[];
    adicionais: TransacaoEntity[];
    pagos: TransacaoEntity[];
  }> {
    const cartoes = await CartaoRepository.listar(userid);

    const mesValido = mes ?? new Date().getMonth() + 1;
    const anoValido = ano ?? new Date().getFullYear();

    const mm = String(mesValido).padStart(2, '0');
    let data_inicio = `${anoValido}-${mm}-01`;
    const ultimoDia = new Date(anoValido, mesValido, 0).getDate();
    let data_fim = `${anoValido}-${mm}-${String(ultimoDia).padStart(2, '0')}`;

    if (cardId) {
      const cartao = await CartaoRepository.buscar(cardId);
      if (cartao) {
        const periodo = getPeriodoFatura(cartao.dia_fatura, mesValido, anoValido);
        data_inicio = periodo.inicio;
        data_fim = periodo.fim;
      }
    }

    const parceladas = await TransacaoRepository.listaParceladas(data_inicio, data_fim, userid, cardId);
    const adicionais = await TransacaoRepository.listaAdicionais(data_inicio, data_fim, userid, cardId);
    const pagos = await TransacaoRepository.listaTransacoes('saida', 'pago', data_inicio, data_fim, userid, cardId);

    if (!cardId && cartoes && cartoes.length > 0) {
      for (const cartao of cartoes) {
        const periodo = getPeriodoFatura(cartao.dia_fatura, mesValido, anoValido);

        const parceladasCartoes = await TransacaoRepository.listaParceladas(periodo.inicio, periodo.fim, userid, cartao.id);
        const adicionaisCartoes = await TransacaoRepository.listaAdicionais(periodo.inicio, periodo.fim, userid, cartao.id);
        const pagosCartoes = await TransacaoRepository.listaTransacoes('saida', 'pago', periodo.inicio, periodo.fim, userid, cartao.id);

        parceladas.push(...parceladasCartoes);
        adicionais.push(...adicionaisCartoes);
        pagos.push(...pagosCartoes);
      }
    }

    const soma_parcelados = parceladas.reduce((acc, p) => acc + Number(p.valor || 0), 0);
    const soma_adicionais = adicionais.reduce((acc, p) => acc + Number(p.valor || 0), 0);
    const soma_pagos = pagos.reduce((acc, p) => acc + Number(p.valor || 0), 0);

    return {
      soma_parcelados,
      soma_adicionais,
      soma_pagos,
      parceladas,
      adicionais,
      pagos,
    };
  },

  async listarEntradas(
    mes: number | null,
    ano: number | null,
    userid: number
  ): Promise<{
    soma_receber: number;
    soma_recebidos: number;
    entradas_receber: TransacaoEntity[];
    entradas_recebidas: TransacaoEntity[];
  }> {
    const mesValido = mes ?? new Date().getMonth() + 1;
    const anoValido = ano ?? new Date().getFullYear();

    const mm = String(mesValido).padStart(2, '0');
    const data_inicio = `${anoValido}-${mm}-01`;
    const ultimoDia = new Date(anoValido, mesValido, 0).getDate();
    const data_fim = `${anoValido}-${mm}-${String(ultimoDia).padStart(2, '0')}`;

    const entradas_receber = await TransacaoRepository.listaTransacoes('entrada', 'pendente', data_inicio, data_fim, userid);
    const entradas_recebidas = await TransacaoRepository.listaTransacoes('entrada', 'pago', data_inicio, data_fim, userid);

    const soma_receber = entradas_receber.reduce((acc, p) => acc + Number(p.valor || 0), 0);
    const soma_recebidos = entradas_recebidas.reduce((acc, p) => acc + Number(p.valor || 0), 0);

    return {
      soma_receber,
      soma_recebidos,
      entradas_receber,
      entradas_recebidas,
    };
  },

  async somar(
    tipo?: string | null,
    status?: string | null,
    mes?: number | string | null,
    ano?: number | string | null,
    userid?: number
  ): Promise<number> {
    return await TransacaoRepository.somaTransacoes(tipo, status, mes, ano, userid);
  },

  async buscarPorId(id: number | string, userid?: number): Promise<TransacaoEntity> {
    const t = await TransacaoRepository.buscarPorId(id, userid);
    if (!t) throw new Error('Transação não encontrada.');
    return t;
  },

  async atualizar(
    id: number | string,
    dados: Partial<CreateTransacaoDto>
  ): Promise<TransacaoEntity | undefined> {
    await this.buscarPorId(id);
    return await TransacaoRepository.atualizar(id, dados);
  },

  async excluir(id: number | string): Promise<boolean> {
    await this.buscarPorId(id);
    return await TransacaoRepository.excluir(id);
  },

  async listaDespesasParceladas(
    mes: number | null,
    ano: number | null,
    userid: number
  ): Promise<{ parcelas: DespesaParceladaItem[]; mensal: { pendente: number } }> {
    const cartoes = await CartaoRepository.listar(userid);

    const mesValido = mes ?? new Date().getMonth() + 1;
    const anoValido = ano ?? new Date().getFullYear();

    const mm = String(mesValido).padStart(2, '0');
    const data_inicio = `${anoValido}-${mm}-01`;
    const ultimoDia = new Date(anoValido, mesValido, 0).getDate();
    const data_fim = `${anoValido}-${mm}-${String(ultimoDia).padStart(2, '0')}`;

    const parcelas = await TransacaoRepository.listaDespesasParceladas(data_inicio, data_fim, userid);
    const array: DespesaParceladaItem[] = [...parcelas];

    if (cartoes && cartoes.length > 0) {
      for (const cartao of cartoes) {
        const periodo = getPeriodoFatura(cartao.dia_fatura, mesValido, anoValido);
        const parcelasCartao = await TransacaoRepository.listaDespesasParceladas(periodo.inicio, periodo.fim, userid, cartao.id);
        array.push(...parcelasCartao);
      }
    }

    const pendenteTotal = array.reduce(
      (acc, p) => acc + Number(p.valor_pendente_mes || 0),
      0
    );

    return { parcelas: array, mensal: { pendente: pendenteTotal } };
  },

  async agrupamentoTipo(
    status: string | null,
    mes: number | null,
    ano: number | null,
    tipo: string | null,
    userid: number
  ): Promise<{
    soma: { soma: number };
    agrupamento: Array<{ total_tipo: string; idcategoria: number | null; subcategoria: string }>;
  }> {
    const mesValido = mes ?? new Date().getMonth() + 1;
    const anoValido = ano ?? new Date().getFullYear();

    const mm = String(mesValido).padStart(2, '0');
    const data_inicio = `${anoValido}-${mm}-01`;
    const ultimoDia = new Date(anoValido, mesValido, 0).getDate();
    const data_fim = `${anoValido}-${mm}-${String(ultimoDia).padStart(2, '0')}`;

    const agrupamento = await TransacaoRepository.agrupamentoTipo(status, data_inicio, data_fim, userid, tipo);
    const somaTotal = agrupamento.reduce((acc, p) => acc + Number(p.total_tipo || 0), 0);

    return {
      soma: { soma: somaTotal },
      agrupamento,
    };
  },

  async uptopago(id: number | string): Promise<boolean> {
    return await TransacaoRepository.uptopago(id);
  },

  async listaDespesa(
    descricao: string,
    userid: number
  ): Promise<{ soma: number; despesa: TransacaoEntity[] }> {
    const despesa = await TransacaoRepository.listaDespesa(descricao, userid);
    const soma = despesa.reduce((acc, p) => acc + Number(p.valor || 0), 0);
    return { soma, despesa };
  },

  async linhaTemporal(
    ano: number | string,
    userid: number
  ): Promise<LinhaTemporalItem[]> {
    return await TransacaoRepository.linhaTemporal(ano, userid);
  },

  async buscaPorDia(
    dia: number | string,
    mes: number | string,
    ano: number | string,
    userid: number
  ): Promise<{ soma: { soma: number }; result: TransacaoEntity[] }> {
    const result = await TransacaoRepository.buscaPorDia(dia, mes, ano, userid);
    const somaTotal = result.reduce((acc, p) => acc + Number(p.valor || 0), 0);
    return { soma: { soma: somaTotal }, result };
  },

  async extrato(
    limit?: number | string | null,
    mes?: number | string | null,
    ano?: number | string | null,
    userid?: number
  ): Promise<TransacaoEntity[]> {
    return await TransacaoRepository.extrato(limit, mes, ano, userid);
  },
};

