// card.business.ts

import { PoolClient } from 'pg';
import { pool } from '../../core/config/database';
import {
  CreditCardEntity,
  CardInvoiceEntity,
  CardTransactionEntity,
  InvoiceItemEntity,
} from './card.entity';
import {
  CreateCardDto,
  UpdateCardDto,
  CreateTransactionDto,
  PayInvoiceDto,
  CardDetailsResponseDto,
  InvoiceDetailsResponseDto,
} from './card.dto';
import { CardRepository, mapCreditCardEntity } from './card.repository';
import { CategoriaBusiness } from '../categoria/categoria.business';

export class CardValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CardValidationError';
  }
}

export class CardNotFoundError extends Error {
  constructor(message = 'Cartão de crédito não encontrado.') {
    super(message);
    this.name = 'CardNotFoundError';
  }
}

export class InvoiceNotFoundError extends Error {
  constructor(message = 'Fatura não encontrada.') {
    super(message);
    this.name = 'InvoiceNotFoundError';
  }
}

/**
 * Utilitário para decompor a data em ano, mês (1..12) e dia respeitando fusos horários.
 */
function extrairAnoMesDia(dataInput: string | Date): { ano: number; mes: number; dia: number; dataObj: Date } {
  if (typeof dataInput === 'string') {
    const semHora = dataInput.split('T')[0];
    const partes = semHora.split('-');
    if (partes.length === 3) {
      const ano = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10);
      const dia = parseInt(partes[2], 10);
      return {
        ano,
        mes,
        dia,
        dataObj: new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0)),
      };
    }
  }

  const d = dataInput instanceof Date ? dataInput : new Date(dataInput);
  return {
    ano: d.getFullYear(),
    mes: d.getMonth() + 1,
    dia: d.getDate(),
    dataObj: d,
  };
}

/**
 * Calcula as datas de fechamento e vencimento de uma fatura para um dado mês/ano de referência.
 */
export function calcularDatasFatura(
  diaFechamento: number,
  diaVencimento: number,
  mesReferencia: number,
  anoReferencia: number
): { dataFechamento: Date; dataVencimento: Date } {
  // 1. Data de Fechamento: no próprio mês de referência
  const ultimoDiaMesRef = new Date(anoReferencia, mesReferencia, 0).getDate();
  const diaFechamentoEfetivo = Math.min(diaFechamento, ultimoDiaMesRef);
  const dataFechamento = new Date(Date.UTC(anoReferencia, mesReferencia - 1, diaFechamentoEfetivo, 23, 59, 59));

  // 2. Data de Vencimento:
  // Se dia de vencimento for maior que o dia de fechamento, vence no mesmo mês de referência.
  // Se dia de vencimento for menor ou igual ao dia de fechamento, vence no mês seguinte.
  let mesVenc = mesReferencia;
  let anoVenc = anoReferencia;

  if (diaVencimento <= diaFechamento) {
    mesVenc += 1;
    if (mesVenc > 12) {
      mesVenc = 1;
      anoVenc += 1;
    }
  }

  const ultimoDiaMesVenc = new Date(anoVenc, mesVenc, 0).getDate();
  const diaVencimentoEfetivo = Math.min(diaVencimento, ultimoDiaMesVenc);
  const dataVencimento = new Date(Date.UTC(anoVenc, mesVenc - 1, diaVencimentoEfetivo, 23, 59, 59));

  return { dataFechamento, dataVencimento };
}

/**
 * Determina o mês e ano da 1ª fatura baseado na data da compra e dia de fechamento.
 */
export function calcularMesAnoPrimeiraFatura(
  diaCompra: number,
  mesCompra: number,
  anoCompra: number,
  diaFechamento: number
): { mesInicial: number; anoInicial: number } {
  // Se a data de compra for menor ou igual ao fechamento, cai no mês da compra
  if (diaCompra <= diaFechamento) {
    return { mesInicial: mesCompra, anoInicial: anoCompra };
  }

  // Se for após o fechamento, cai no mês seguinte
  let mesInicial = mesCompra + 1;
  let anoInicial = anoCompra;
  if (mesInicial > 12) {
    mesInicial = 1;
    anoInicial += 1;
  }
  return { mesInicial, anoInicial };
}

/**
 * Valida os dados de cadastro/edição do cartão e devolve os campos numéricos normalizados.
 */
function validarDadosCartao(dto: CreateCardDto, usuarioId: number): CreateCardDto {
  if (!usuarioId || usuarioId <= 0) {
    throw new CardValidationError('Usuário não autenticado.');
  }
  if (!dto.nome || dto.nome.trim().length === 0) {
    throw new CardValidationError('Nome do cartão é obrigatório.');
  }
  const limiteTotal = Number(dto.limite_total);
  if (isNaN(limiteTotal) || limiteTotal <= 0) {
    throw new CardValidationError('O limite total deve ser maior que zero.');
  }
  const diaFechamento = Number(dto.dia_fechamento);
  if (!Number.isInteger(diaFechamento) || diaFechamento < 1 || diaFechamento > 31) {
    throw new CardValidationError('Dia de fechamento deve estar entre 1 e 31.');
  }
  const diaVencimento = Number(dto.dia_vencimento);
  if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
    throw new CardValidationError('Dia de vencimento deve estar entre 1 e 31.');
  }

  return {
    ...dto,
    limite_total: limiteTotal,
    dia_fechamento: diaFechamento,
    dia_vencimento: diaVencimento,
  };
}

export const CardBusiness = {
  /**
   * Cria um novo cartão de crédito validando os dados fornecidos.
   */
  async criarCartao(
    dto: CreateCardDto,
    usuarioId: number
  ): Promise<CreditCardEntity> {
    return await CardRepository.criarCartao(validarDadosCartao(dto, usuarioId), usuarioId);
  },

  /**
   * Edita um cartão do usuário.
   * Se os dias de fechamento/vencimento mudarem, recalcula as datas das faturas ainda não pagas;
   * as compras já lançadas permanecem nas faturas em que caíram.
   */
  async atualizarCartao(
    cartaoId: string,
    dto: UpdateCardDto,
    usuarioId: number
  ): Promise<CreditCardEntity> {
    const dados = validarDadosCartao(dto, usuarioId);

    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');

      // Trava o cartão para não concorrer com lançamentos que leem os dias de fechamento
      const lock = await client.query(
        'SELECT * FROM credit_cards WHERE id = $1 AND usuario_id = $2 FOR UPDATE',
        [cartaoId, usuarioId]
      );
      if (!lock.rows[0]) {
        throw new CardNotFoundError();
      }
      const anterior = mapCreditCardEntity(lock.rows[0]);

      const atualizado = await CardRepository.atualizarCartao(cartaoId, dados, usuarioId, client);
      if (!atualizado) {
        throw new CardNotFoundError();
      }

      const diasMudaram =
        anterior.dia_fechamento !== dados.dia_fechamento ||
        anterior.dia_vencimento !== dados.dia_vencimento;
      if (diasMudaram) {
        const faturas = await CardRepository.listarFaturas(cartaoId, undefined, client);
        for (const fatura of faturas.filter((f) => f.status !== 'PAID')) {
          const { dataFechamento, dataVencimento } = calcularDatasFatura(
            dados.dia_fechamento,
            dados.dia_vencimento,
            fatura.mes_referencia,
            fatura.ano_referencia
          );
          await CardRepository.atualizarDatasFatura(fatura.id, dataFechamento, dataVencimento, client);
        }
      }

      await client.query('COMMIT');

      await CardRepository.sincronizarCartaoLegado(anterior.nome, dados, usuarioId);
      return atualizado;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Lista todos os cartões do usuário consolidando seus limites (total, comprometido, disponível).
   */
  async listarCartoes(usuarioId: number): Promise<CardDetailsResponseDto[]> {
    if (!usuarioId || usuarioId <= 0) {
      throw new CardValidationError('Usuário não autenticado.');
    }

    const cartoes = await CardRepository.listarCartoesPorUsuario(usuarioId);
    const resultado: CardDetailsResponseDto[] = [];

    for (const cartao of cartoes) {
      const comprometido = await CardRepository.obterLimiteComprometido(cartao.id);
      const disponivel = Math.max(0, Number((cartao.limite_total - comprometido).toFixed(2)));

      // Busca fatura aberta mais recente ou atual
      const faturas = await CardRepository.listarFaturas(cartao.id);
      const hoje = new Date();
      const mesAtual = hoje.getMonth() + 1;
      const anoAtual = hoje.getFullYear();

      const faturaAtual =
        faturas.find((f) => f.mes_referencia === mesAtual && f.ano_referencia === anoAtual) ||
        faturas.find((f) => f.status === 'OPEN') ||
        faturas[faturas.length - 1];

      resultado.push({
        cartao,
        limite_total: cartao.limite_total,
        limite_comprometido: Number(comprometido.toFixed(2)),
        limite_disponivel: disponivel,
        fatura_atual: faturaAtual,
        faturas,
      });
    }

    return resultado;
  },

  /**
   * Obtém detalhes de um cartão específico incluindo seus limites e faturas.
   */
  async obterDetalhesCartao(
    cartaoId: string,
    usuarioId: number
  ): Promise<CardDetailsResponseDto> {
    const cartao = await CardRepository.buscarCartaoPorId(cartaoId, usuarioId);
    if (!cartao) {
      throw new CardNotFoundError();
    }

    const comprometido = await CardRepository.obterLimiteComprometido(cartao.id);
    const disponivel = Math.max(0, Number((cartao.limite_total - comprometido).toFixed(2)));
    const faturas = await CardRepository.listarFaturas(cartao.id);

    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    const faturaAtual =
      faturas.find((f) => f.mes_referencia === mesAtual && f.ano_referencia === anoAtual) ||
      faturas.find((f) => f.status === 'OPEN') ||
      faturas[faturas.length - 1];

    return {
      cartao,
      limite_total: cartao.limite_total,
      limite_comprometido: Number(comprometido.toFixed(2)),
      limite_disponivel: disponivel,
      fatura_atual: faturaAtual,
      faturas,
    };
  },

  /**
   * Lança uma nova compra (à vista ou parcelada) no cartão de crédito:
   * 1. Valida se o limite disponível comporta o valor integral.
   * 2. Calcula as faturas de destino de cada parcela com progressão mensal.
   * 3. Cria as faturas automaticamente se ainda não existirem.
   * 4. Salva a transação e os itens da fatura de forma atômica (`BEGIN`, `COMMIT`, `ROLLBACK`).
   */
  async lancarTransacao(
    dto: CreateTransactionDto,
    usuarioId: number
  ): Promise<{
    transacao: CardTransactionEntity;
    itens: InvoiceItemEntity[];
    cartaoAtualizado: CardDetailsResponseDto;
  }> {
    if (!dto.cartao_id) {
      throw new CardValidationError('ID do cartão é obrigatório.');
    }
    if (!dto.descricao || dto.descricao.trim().length === 0) {
      throw new CardValidationError('Descrição da transação é obrigatória.');
    }

    const valorTotal = Number(dto.valor_total);
    if (isNaN(valorTotal) || valorTotal <= 0) {
      throw new CardValidationError('O valor da compra deve ser maior que zero.');
    }

    if (dto.categoria_id !== undefined && dto.categoria_id !== null) {
      if (!(await CategoriaBusiness.categoriaVisivel(dto.categoria_id, usuarioId))) {
        throw new CardValidationError('Categoria não encontrada.');
      }
    }

    const quantidadeParcelas = Number(dto.quantidade_parcelas || 1);
    if (isNaN(quantidadeParcelas) || quantidadeParcelas < 1 || !Number.isInteger(quantidadeParcelas)) {
      throw new CardValidationError('A quantidade de parcelas deve ser um número inteiro maior ou igual a 1.');
    }

    // Busca o cartão e valida permissão
    const cartao = await CardRepository.buscarCartaoPorId(dto.cartao_id, usuarioId);
    if (!cartao) {
      throw new CardNotFoundError('Cartão de crédito não encontrado.');
    }

    // Validação de Limite Disponível
    const limiteComprometidoAtual = await CardRepository.obterLimiteComprometido(cartao.id);
    const limiteDisponivel = Number((cartao.limite_total - limiteComprometidoAtual).toFixed(2));

    if (valorTotal > limiteDisponivel) {
      throw new CardValidationError(
        `Limite disponível insuficiente para esta compra. Limite disponível: R$ ${limiteDisponivel.toFixed(
          2
        )}, Valor da compra: R$ ${valorTotal.toFixed(2)}.`
      );
    }

    // Decompõe a data da compra
    const { ano: anoCompra, mes: mesCompra, dia: diaCompra, dataObj: dataCompraFinal } =
      extrairAnoMesDia(dto.data_compra || new Date());

    // Calcula o mês e ano da 1ª parcela
    const { mesInicial, anoInicial } = calcularMesAnoPrimeiraFatura(
      diaCompra,
      mesCompra,
      anoCompra,
      cartao.dia_fechamento
    );

    // Divisão do valor das cotas
    const valorBaseParcela = Math.floor((valorTotal / quantidadeParcelas) * 100) / 100;
    let centavosResidual = Number((valorTotal - valorBaseParcela * quantidadeParcelas).toFixed(2));

    const parcelasCalculadas: {
      numeroParcela: number;
      valorParcela: number;
      mesReferencia: number;
      anoReferencia: number;
    }[] = [];

    for (let i = 1; i <= quantidadeParcelas; i++) {
      let mesParcela = mesInicial + (i - 1);
      let anoParcela = anoInicial;
      while (mesParcela > 12) {
        mesParcela -= 12;
        anoParcela += 1;
      }

      let valorParcela = valorBaseParcela;
      if (centavosResidual > 0.009) {
        valorParcela = Number((valorParcela + 0.01).toFixed(2));
        centavosResidual = Number((centavosResidual - 0.01).toFixed(2));
      }

      parcelasCalculadas.push({
        numeroParcela: i,
        valorParcela,
        mesReferencia: mesParcela,
        anoReferencia: anoParcela,
      });
    }

    // Execução Atômica via PoolClient
    const client: PoolClient = await pool.connect();

    try {
      await client.query('BEGIN');

      // 0. Serializa compras concorrentes no mesmo cartão: trava a linha do cartão e
      //    recalcula o limite comprometido dentro da transação (evita estourar o limite)
      await client.query(
        'SELECT id FROM credit_cards WHERE id = $1 AND usuario_id = $2 FOR UPDATE',
        [cartao.id, usuarioId]
      );
      const comprometidoTravado = await CardRepository.obterLimiteComprometido(cartao.id, client);
      const disponivelTravado = Number((cartao.limite_total - comprometidoTravado).toFixed(2));
      if (valorTotal > disponivelTravado) {
        throw new CardValidationError(
          `Limite disponível insuficiente para esta compra. Limite disponível: R$ ${disponivelTravado.toFixed(
            2
          )}, Valor da compra: R$ ${valorTotal.toFixed(2)}.`
        );
      }

      // 1. Garante que todas as faturas necessárias existam
      const faturasMap = new Map<string, string>(); // Chave: "ano-mes" -> faturaId

      for (const p of parcelasCalculadas) {
        const key = `${p.anoReferencia}-${p.mesReferencia}`;
        if (!faturasMap.has(key)) {
          let fatura = await CardRepository.buscarFaturaPorMesAno(
            cartao.id,
            p.mesReferencia,
            p.anoReferencia,
            client
          );

          if (!fatura) {
            const { dataFechamento, dataVencimento } = calcularDatasFatura(
              cartao.dia_fechamento,
              cartao.dia_vencimento,
              p.mesReferencia,
              p.anoReferencia
            );

            fatura = await CardRepository.criarFatura(
              {
                cartao_id: cartao.id,
                mes_referencia: p.mesReferencia,
                ano_referencia: p.anoReferencia,
                data_fechamento: dataFechamento,
                data_vencimento: dataVencimento,
                status: 'OPEN',
              },
              client
            );
          }

          faturasMap.set(key, fatura.id);
        }
      }

      // 2. Insere o registro em card_transactions
      const transacaoCriada = await CardRepository.criarTransacao(
        {
          cartao_id: cartao.id,
          categoria_id: dto.categoria_id,
          descricao: dto.descricao,
          valor_total: valorTotal,
          quantidade_parcelas: quantidadeParcelas,
          data_compra: dataCompraFinal,
        },
        client
      );

      // 3. Insere cada parcela em invoice_items
      const itensInput = parcelasCalculadas.map((p) => {
        const key = `${p.anoReferencia}-${p.mesReferencia}`;
        const faturaId = faturasMap.get(key)!;
        return {
          fatura_id: faturaId,
          transacao_id: transacaoCriada.id,
          numero_parcela: p.numeroParcela,
          valor_parcela: p.valorParcela,
        };
      });

      const itensCriados = await CardRepository.criarItensFatura(itensInput, client);

      await client.query('COMMIT');

      // 4. Retorna dados consolidados e atualizados do cartão
      const cartaoAtualizado = await this.obterDetalhesCartao(cartao.id, usuarioId);

      return {
        transacao: transacaoCriada,
        itens: itensCriados,
        cartaoAtualizado,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Lista todas as faturas do cartão (com navegação por mês/ano).
   */
  async listarFaturasCartao(
    cartaoId: string,
    usuarioId: number,
    ano?: number
  ): Promise<CardInvoiceEntity[]> {
    const cartao = await CardRepository.buscarCartaoPorId(cartaoId, usuarioId);
    if (!cartao) {
      throw new CardNotFoundError();
    }
    return await CardRepository.listarFaturas(cartaoId, ano);
  },

  /**
   * Retorna os detalhes de uma fatura com todos os seus lançamentos (`invoice_items`).
   */
  async obterDetalhesFatura(
    faturaId: string,
    usuarioId: number
  ): Promise<InvoiceDetailsResponseDto> {
    const fatura = await CardRepository.buscarFaturaPorId(faturaId);
    if (!fatura) {
      throw new InvoiceNotFoundError();
    }

    const cartao = await CardRepository.buscarCartaoPorId(fatura.cartao_id, usuarioId);
    if (!cartao) {
      throw new CardNotFoundError();
    }

    const itens = await CardRepository.listarItensPorFatura(fatura.id);
    const totalItens = itens.reduce((acc, curr) => acc + curr.valor_parcela, 0);

    return {
      fatura,
      cartao,
      itens,
      valor_total: Number(totalItens.toFixed(2)),
    };
  },

  /**
   * Liquida uma fatura de cartão de crédito:
   * - Marca a fatura como 'PAID', registrando a data e valor pago.
   * - A quitação recompõe automaticamente o limite disponível para novas compras.
   */
  async pagarFatura(
    faturaId: string,
    usuarioId: number,
    dto: PayInvoiceDto = {}
  ): Promise<{
    fatura: CardInvoiceEntity;
    cartaoAtualizado: CardDetailsResponseDto;
  }> {
    const fatura = await CardRepository.buscarFaturaPorId(faturaId);
    if (!fatura) {
      throw new InvoiceNotFoundError();
    }

    const cartao = await CardRepository.buscarCartaoPorId(fatura.cartao_id, usuarioId);
    if (!cartao) {
      throw new CardNotFoundError();
    }

    if (fatura.status === 'PAID') {
      throw new CardValidationError('Esta fatura já se encontra quitada.');
    }

    const dataPagamento = dto.data_pagamento
      ? new Date(dto.data_pagamento)
      : new Date();

    const valorPago =
      dto.valor_pago !== undefined && dto.valor_pago > 0
        ? Number(dto.valor_pago)
        : Number(fatura.total_fatura ?? 0);

    const faturaAtualizada = await CardRepository.atualizarStatusFatura(
      fatura.id,
      'PAID',
      dataPagamento,
      valorPago
    );

    if (!faturaAtualizada) {
      throw new InvoiceNotFoundError('Erro ao atualizar status da fatura.');
    }

    // Como os itens agora pertencem a uma fatura 'PAID', o limite é recomposto automaticamente
    const cartaoAtualizado = await this.obterDetalhesCartao(cartao.id, usuarioId);

    return {
      fatura: faturaAtualizada,
      cartaoAtualizado,
    };
  },
};

