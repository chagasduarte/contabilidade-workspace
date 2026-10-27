import { TransacaoRepository } from './transacao.repository';
import { CartaoRepository } from '../cartao/cartao.repository';
import { CardBusiness } from '../card/card.business';
import { CategoriaBusiness } from '../categoria/categoria.business';
import { SubcategoriaBusiness } from '../subcategoria/subcategoria.business';
import { pool } from '../../core/config/database';
import { getPeriodoFatura } from '../../common/utils/periodo-fatura';
import crypto from 'crypto';
import {
  TransacaoEntity,
  CreateTransacaoDto,
  CreateParceladaDto,
  InitialUserTransactionsDto,
  DespesaParceladaItem,
  LinhaTemporalItem,
  PeriodoConsulta,
  TransacaoLoteItem,
  ExtratoCursor,
  ExtratoCartaoCursor,
  AgrupamentoTipoItem,
  ExtratoTotais,
  TransacaoNotFoundError,
} from './transacao.types';

const EXTRATO_LIMIT_PADRAO = 50;
const EXTRATO_LIMIT_MAX = 200;

/**
 * Ordem do extrato: data desc; no mesmo dia, conta (id numérico desc) antes de cartão
 * (id `cartao:<uuid>` desc, comparação byte a byte como o COLLATE "C" da consulta).
 */
function compararItensExtrato(a: TransacaoEntity, b: TransacaoEntity): number {
  const dataA = String(a.data);
  const dataB = String(b.data);
  if (dataA !== dataB) return dataA < dataB ? 1 : -1;

  const cartaoA = a.origem === 'CARTAO';
  const cartaoB = b.origem === 'CARTAO';
  if (cartaoA !== cartaoB) return cartaoA ? 1 : -1;
  if (!cartaoA) return Number(b.id) - Number(a.id);

  const idA = String(a.id);
  const idB = String(b.id);
  return idA === idB ? 0 : idA < idB ? 1 : -1;
}

function intervaloMes(mes: number, ano: number): { inicio: string; fim: string } {
  const mm = String(mes).padStart(2, '0');
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return { inicio: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${String(ultimoDia).padStart(2, '0')}` };
}

/**
 * Períodos de consulta do mês: conta corrente (mês civil) + cada cartão legado (período da fatura).
 * Cartões com id não numérico (fallback de credit_cards) são ignorados: transacoes.cartaoid é INTEGER.
 */
async function montarPeriodos(
  mes: number,
  ano: number,
  userid: number,
  incluirCartoes: boolean
): Promise<PeriodoConsulta[]> {
  const periodos: PeriodoConsulta[] = [{ cartaoid: null, ...intervaloMes(mes, ano) }];
  if (!incluirCartoes) return periodos;

  const cartoes = await CartaoRepository.listar(userid);
  for (const cartao of cartoes ?? []) {
    const id = Number(cartao.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    periodos.push({ cartaoid: id, ...getPeriodoFatura(cartao.dia_fatura, mes, ano) });
  }
  return periodos;
}

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

/**
 * idcategoria precisa referenciar categoria visível ao usuário (dele ou global).
 * Vazio/ausente é permitido. Valores não numéricos são rejeitados (antes viravam NULL em silêncio).
 * Compras no cartão são validadas em CardBusiness.lancarTransacao.
 */
async function validarCategoria(idcategoria: unknown, userid: number): Promise<void> {
  if (idcategoria === undefined || idcategoria === null || idcategoria === '') return;
  if (!(await CategoriaBusiness.categoriaVisivel(idcategoria as number | string, userid))) {
    throw new Error('Categoria não encontrada.');
  }
}

const vazio = (v: unknown): boolean => v === undefined || v === null || v === '';

/**
 * Resolve a subcategoria da transação (fase 1 da semântica de categoria):
 * - `idsubcategoria` informado: precisa ser visível ao usuário e pertencer a `idcategoria` (senão 400);
 * - senão, o campo legado `categoria` é interpretado: se for subcategoria visível de `idcategoria`,
 *   vira `idsubcategoria`; qualquer outro valor é ignorado (continua só na coluna legada) para não
 *   quebrar clientes antigos.
 */
async function resolverSubcategoria(
  idcategoria: unknown,
  idsubcategoria: unknown,
  categoriaLegado: unknown,
  userid: number
): Promise<number | null> {
  if (!vazio(idsubcategoria)) {
    if (
      vazio(idcategoria) ||
      !(await SubcategoriaBusiness.subcategoriaDaCategoria(
        idsubcategoria as number | string,
        idcategoria as number | string,
        userid
      ))
    ) {
      throw new Error('Subcategoria não encontrada.');
    }
    return Number(idsubcategoria);
  }

  if (vazio(idcategoria) || vazio(categoriaLegado) || Number(categoriaLegado) === Number(idcategoria)) {
    return null;
  }
  const ehSubcategoria = await SubcategoriaBusiness.subcategoriaDaCategoria(
    categoriaLegado as number | string,
    idcategoria as number | string,
    userid
  );
  return ehSubcategoria ? Number(categoriaLegado) : null;
}

/**
 * Coluna legada `categoria` durante a transição: se o cliente não enviou, preenche como o front
 * sempre fez (subcategoria ?? categoria), para os agrupamentos que ainda leem a coluna legada.
 */
function categoriaLegada(categoria: unknown, idsubcategoria: number | null, idcategoria: unknown): unknown {
  if (!vazio(categoria)) return categoria;
  return idsubcategoria ?? (vazio(idcategoria) ? null : idcategoria);
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

    await validarCategoria(transacao.idcategoria, userid);
    const idsubcategoria = await resolverSubcategoria(
      transacao.idcategoria,
      transacao.idsubcategoria,
      transacao.categoria,
      userid
    );

    const cartaoidNum =
      transacao.cartaoid && !isNaN(Number(transacao.cartaoid)) && Number(transacao.cartaoid) > 0
        ? Number(transacao.cartaoid)
        : null;

    let dataPagamento = transacao.pagamento;
    if (!dataPagamento) {
      let diaFatura: number | null = null;
      if (cartaoidNum) {
        const cartao = await CartaoRepository.buscar(cartaoidNum, userid);
        if (cartao?.dia_fatura) {
          diaFatura = cartao.dia_fatura;
        }
      }
      dataPagamento = calcularDataPagamento(transacao.data, diaFatura);
    }

    return await TransacaoRepository.criar(
      {
        ...transacao,
        categoria: categoriaLegada(transacao.categoria, idsubcategoria, transacao.idcategoria) as CreateTransacaoDto['categoria'],
        idsubcategoria,
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
    if (!Number.isInteger(qtdParcelas) || qtdParcelas <= 0 || qtdParcelas > 420) {
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

    await validarCategoria(payload.idcategoria, userId);
    const idsubcategoria = await resolverSubcategoria(
      payload.idcategoria,
      payload.idsubcategoria,
      payload.categoria,
      userId
    );

    const cartaoidNum =
      payload.cartaoid && !isNaN(Number(payload.cartaoid)) && Number(payload.cartaoid) > 0
        ? Number(payload.cartaoid)
        : null;

    let cartao = null;
    if (cartaoidNum) {
      cartao = await CartaoRepository.buscar(cartaoidNum, userId);
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

    const parcelaGrupoId = crypto.randomUUID();
    const parcelas: TransacaoLoteItem[] = [];

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

      parcelas.push({
        tipo: 'saida',
        descricao: `${payload.descricao} - Parcela`,
        valor: valorParcelaInformado,
        categoria: categoriaLegada(payload.categoria, idsubcategoria, payload.idcategoria) as CreateTransacaoDto['categoria'],
        idcategoria: payload.idcategoria,
        idsubcategoria,
        data: dataParcelaStr,
        pagamento: dataPagamentoParcela,
        status: 'pendente',
        ispaycart: Boolean(payload.ispaycart),
        cartaoid: cartaoidNum,
        parcela_grupo_id: parcelaGrupoId,
        parcela_numero: i + 1,
        parcela_total: qtdParcelas,
      });
    }

    // INSERT único: ou todas as parcelas são gravadas, ou nenhuma
    return await TransacaoRepository.criarEmLote(parcelas, userId);
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

    const todasTransacoes: TransacaoLoteItem[] = [];
    // Um grupo de parcelamento por despesa fixa (12 ocorrências)
    const gruposSaida = saidas.map(() => crypto.randomUUID());

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
          pagamento: data, // conta corrente: vencimento = data (sem pagamento as linhas somem de GET /transacoes)
          status: 'pendente',
          ispaycart: false,
        });
      }

      for (const [idxSaida, saida] of saidas.entries()) {
        const valorSaida = Number(saida.value ?? saida.valor);
        const dia = safeDay(year, month, Number(saida.day_of_month));
        const data = new Date(year, month, dia);

        todasTransacoes.push({
          tipo: 'saida',
          descricao: (saida.description || saida.descricao || 'Despesa fixa') + ' - Parcela',
          valor: Math.abs(valorSaida),
          categoria: saida.category ?? saida.categoria ?? undefined,
          data,
          pagamento: data,
          status: 'pendente',
          ispaycart: false,
          parcela_grupo_id: gruposSaida[idxSaida],
          parcela_numero: m + 1,
          parcela_total: monthsToGenerate,
        });
      }
    }

    const criadas = await TransacaoRepository.criarEmLote(todasTransacoes, userId);

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
    const mesValido = mes ?? new Date().getMonth() + 1;
    const anoValido = ano ?? new Date().getFullYear();

    let periodos: PeriodoConsulta[];
    if (cardId) {
      // Um cartão específico: período da fatura dele (ou mês civil se não encontrado)
      const cardIdNum = Number(cardId);
      if (!Number.isInteger(cardIdNum) || cardIdNum <= 0) {
        periodos = [];
      } else {
        const cartao = await CartaoRepository.buscar(cardIdNum, userid);
        periodos = [
          {
            cartaoid: cardIdNum,
            ...(cartao
              ? getPeriodoFatura(cartao.dia_fatura, mesValido, anoValido)
              : intervaloMes(mesValido, anoValido)),
          },
        ];
      }
    } else {
      periodos = await montarPeriodos(mesValido, anoValido, userid, true);
    }

    const linhas = await TransacaoRepository.listarMes(userid, periodos);
    const parceladas: TransacaoEntity[] = [];
    const adicionais: TransacaoEntity[] = [];
    const pagos: TransacaoEntity[] = [];
    for (const { grupo, ...linha } of linhas) {
      if (grupo === 'pagos') pagos.push(linha);
      else if (grupo === 'parceladas') parceladas.push(linha);
      else adicionais.push(linha);
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
    if (!t) throw new TransacaoNotFoundError();
    return t;
  },

  async atualizar(
    id: number | string,
    dados: Partial<CreateTransacaoDto>,
    userid: number
  ): Promise<TransacaoEntity | undefined> {
    const existente = await this.buscarPorId(id, userid);
    await validarCategoria(dados.idcategoria, userid);

    // idcategoria ausente/null mantém a atual (COALESCE no repositório)
    const idcategoriaEfetiva = vazio(dados.idcategoria) ? existente.idcategoria : dados.idcategoria;
    let subcategoria: { alterar: boolean; valor: number | null } = { alterar: false, valor: null };
    if (dados.idsubcategoria !== undefined) {
      subcategoria = {
        alterar: true,
        valor: await resolverSubcategoria(idcategoriaEfetiva, dados.idsubcategoria, null, userid),
      };
    } else if (dados.categoria !== undefined) {
      subcategoria = {
        alterar: true,
        valor: await resolverSubcategoria(idcategoriaEfetiva, null, dados.categoria, userid),
      };
    } else if (!vazio(dados.idcategoria) && Number(dados.idcategoria) !== Number(existente.idcategoria)) {
      // Trocou de categoria sem informar subcategoria: a anterior não pertence mais a ela
      subcategoria = { alterar: true, valor: null };
    }

    // Coluna legada: sem 'categoria' no payload mantém a atual (antes era apagada em todo PUT),
    // a menos que a subcategoria/categoria tenha mudado
    const categoria =
      dados.categoria !== undefined
        ? dados.categoria
        : subcategoria.alterar
        ? (categoriaLegada(null, subcategoria.valor, idcategoriaEfetiva) as CreateTransacaoDto['categoria'])
        : existente.categoria;

    return await TransacaoRepository.atualizar(id, { ...dados, categoria }, userid, subcategoria);
  },

  async excluir(id: number | string, userid: number): Promise<boolean> {
    await this.buscarPorId(id, userid);
    return await TransacaoRepository.excluir(id, userid);
  },

  async listaDespesasParceladas(
    mes: number | null,
    ano: number | null,
    userid: number
  ): Promise<{ parcelas: DespesaParceladaItem[]; mensal: { pendente: number } }> {
    const mesValido = mes ?? new Date().getMonth() + 1;
    const anoValido = ano ?? new Date().getFullYear();

    const periodos = await montarPeriodos(mesValido, anoValido, userid, true);
    const array: DespesaParceladaItem[] = await TransacaoRepository.listaDespesasParceladas(userid, periodos);

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
    agrupamento: AgrupamentoTipoItem[];
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

  async uptopago(id: number | string, userid: number): Promise<boolean> {
    const atualizado = await TransacaoRepository.uptopago(id, userid);
    if (!atualizado) throw new TransacaoNotFoundError();
    return atualizado;
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

  /**
   * Extrato por competência. Sem `cursor`/`paginado` mantém o comportamento antigo
   * (array completo, `limit` opcional). Com paginação, usa keyset (data, id) e devolve
   * `next_cursor` (formato `YYYY-MM-DD_id`) quando há próxima página.
   */
  async extrato(
    params: {
      limit?: number | string | null;
      mes?: number | string | null;
      ano?: number | string | null;
      cursor?: string | null;
      paginado?: boolean;
    },
    userid: number
  ): Promise<{ items: TransacaoEntity[]; next_cursor: string | null; totais?: ExtratoTotais }> {
    const mes = params.mes ? Number(params.mes) : null;
    const ano = params.ano ? Number(params.ano) : null;
    if (mes !== null && (!Number.isInteger(mes) || mes < 1 || mes > 12)) {
      throw new Error('Mês inválido.');
    }
    if (ano !== null && (!Number.isInteger(ano) || ano < 1900 || ano > 9999)) {
      throw new Error('Ano inválido.');
    }

    let inicio: string | null = null;
    let fimExclusivo: string | null = null;
    if (ano !== null) {
      if (mes !== null) {
        inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
        fimExclusivo = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
      } else {
        inicio = `${ano}-01-01`;
        fimExclusivo = `${ano + 1}-01-01`;
      }
    }

    // Ordem no mesmo dia: lançamentos de conta (id desc) e depois parcelas de cartão (id desc).
    // O cursor aponta para o último item, seja `YYYY-MM-DD_<id>` ou `YYYY-MM-DD_cartao:<uuid>`.
    let cursor: ExtratoCursor | null = null;
    let cursorCartao: ExtratoCartaoCursor | null = null;
    if (params.cursor) {
      const match = /^(\d{4}-\d{2}-\d{2})_(?:(\d+)|cartao:([0-9a-f-]{36}))$/i.exec(params.cursor);
      if (!match) throw new Error("Cursor inválido. Formato esperado: 'YYYY-MM-DD_id'.");
      const [, data, idConta, idCartao] = match;
      if (idConta) {
        cursor = { data, id: Number(idConta) };
        // Parcelas de cartão do mesmo dia ainda não foram exibidas: 'g' é maior que qualquer uuid em hex
        cursorCartao = { data, chave: 'g' };
      } else {
        // Todos os lançamentos de conta do dia já foram exibidos (ids > 0)
        cursor = { data, id: 0 };
        cursorCartao = { data, chave: idCartao.toLowerCase() };
      }
    }

    const paginado = Boolean(params.paginado || cursor);
    const limitInformado = params.limit && Number(params.limit) > 0 ? Math.floor(Number(params.limit)) : null;
    const limit = paginado
      ? Math.min(limitInformado ?? EXTRATO_LIMIT_PADRAO, EXTRATO_LIMIT_MAX)
      : limitInformado;

    // Totais do período inteiro só na 1ª página paginada: o scroll infinito mostra o resumo do mês
    // sem depender das páginas já carregadas
    const [itensConta, itensCartao, totais] = await Promise.all([
      TransacaoRepository.extrato(userid, inicio, fimExclusivo, cursor, limit),
      TransacaoRepository.extratoCartao(userid, inicio, fimExclusivo, cursorCartao, limit),
      paginado && !cursor ? TransacaoRepository.extratoTotais(userid, inicio, fimExclusivo) : undefined,
    ]);

    const mesclados = [...itensConta, ...itensCartao].sort(compararItensExtrato);
    const items = limit ? mesclados.slice(0, limit) : mesclados;

    const ultimo = items[items.length - 1];
    const next_cursor =
      paginado && limit && items.length === limit && ultimo ? `${ultimo.data}_${ultimo.id}` : null;

    return totais ? { items, next_cursor, totais } : { items, next_cursor };
  },
};

