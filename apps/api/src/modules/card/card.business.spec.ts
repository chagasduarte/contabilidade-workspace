// card.business.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CardBusiness,
  CardValidationError,
  CardNotFoundError,
  InvoiceNotFoundError,
  calcularDatasFatura,
  calcularMesAnoPrimeiraFatura,
} from './card.business';
import { CardRepository } from './card.repository';
import { pool } from '../../core/config/database';

vi.mock('./card.repository', () => ({
  CardRepository: {
    criarCartao: vi.fn(),
    listarCartoesPorUsuario: vi.fn(),
    buscarCartaoPorId: vi.fn(),
    obterLimiteComprometido: vi.fn(),
    buscarFaturaPorMesAno: vi.fn(),
    criarFatura: vi.fn(),
    listarFaturas: vi.fn(),
    buscarFaturaPorId: vi.fn(),
    atualizarStatusFatura: vi.fn(),
    criarTransacao: vi.fn(),
    criarItensFatura: vi.fn(),
    listarItensPorFatura: vi.fn(),
  },
}));

vi.mock('../../core/config/database', () => ({
  pool: {
    connect: vi.fn(),
  },
}));

describe('CardBusiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Funções Utilitárias de Fatura', () => {
    it('deve calcular corretamente a primeira fatura para compra antes do fechamento', () => {
      // Compra dia 10, fechamento dia 20 -> fatura do mesmo mês (Outubro 2026)
      const res = calcularMesAnoPrimeiraFatura(10, 10, 2026, 20);
      expect(res).toEqual({ mesInicial: 10, anoInicial: 2026 });
    });

    it('deve calcular corretamente a primeira fatura para compra no mesmo dia do fechamento', () => {
      // Compra dia 20, fechamento dia 20 -> fatura do mesmo mês
      const res = calcularMesAnoPrimeiraFatura(20, 10, 2026, 20);
      expect(res).toEqual({ mesInicial: 10, anoInicial: 2026 });
    });

    it('deve jogar a primeira parcela para o mês seguinte para compra após o fechamento', () => {
      // Compra dia 21, fechamento dia 20 -> fatura do mês seguinte (Novembro 2026)
      const res = calcularMesAnoPrimeiraFatura(21, 10, 2026, 20);
      expect(res).toEqual({ mesInicial: 11, anoInicial: 2026 });
    });

    it('deve virar o ano ao avançar do mês 12 após o fechamento', () => {
      // Compra 25/12/2026 com fechamento dia 20 -> fatura de Janeiro 2027
      const res = calcularMesAnoPrimeiraFatura(25, 12, 2026, 20);
      expect(res).toEqual({ mesInicial: 1, anoInicial: 2027 });
    });

    it('deve calcular datas de fechamento e vencimento quando vencimento for posterior ao fechamento', () => {
      // Fechamento dia 20, Vencimento dia 28 -> Vence no mesmo mês
      const { dataFechamento, dataVencimento } = calcularDatasFatura(20, 28, 10, 2026);
      expect(dataFechamento.getUTCDate()).toBe(20);
      expect(dataFechamento.getUTCMonth()).toBe(9); // 0-indexed Outubro
      expect(dataVencimento.getUTCDate()).toBe(28);
      expect(dataVencimento.getUTCMonth()).toBe(9);
    });

    it('deve calcular datas de fechamento e vencimento quando vencimento for menor ou igual ao fechamento', () => {
      // Fechamento dia 25, Vencimento dia 5 -> Vence no mês seguinte
      const { dataFechamento, dataVencimento } = calcularDatasFatura(25, 5, 10, 2026);
      expect(dataFechamento.getUTCDate()).toBe(25);
      expect(dataFechamento.getUTCMonth()).toBe(9);
      expect(dataVencimento.getUTCDate()).toBe(5);
      expect(dataVencimento.getUTCMonth()).toBe(10); // Novembro
    });
  });

  describe('criarCartao', () => {
    it('deve validar campos obrigatórios ao criar cartão', async () => {
      await expect(
        CardBusiness.criarCartao(
          {
            nome: '',
            limite_total: 0,
            dia_fechamento: 0,
            dia_vencimento: 0,
          },
          1
        )
      ).rejects.toThrow(CardValidationError);
    });

    it('deve cadastrar cartão com sucesso', async () => {
      const mockCartao = {
        id: 'card-1',
        usuario_id: 1,
        nome: 'Nubank Ultravioleta',
        bandeira: 'Mastercard',
        limite_total: 5000,
        dia_fechamento: 20,
        dia_vencimento: 28,
        cor_identificacao: '#820AD1',
        ativo: true,
      };

      vi.mocked(CardRepository.criarCartao).mockResolvedValue(mockCartao);

      const res = await CardBusiness.criarCartao(
        {
          nome: 'Nubank Ultravioleta',
          bandeira: 'Mastercard',
          limite_total: 5000,
          dia_fechamento: 20,
          dia_vencimento: 28,
          cor_identificacao: '#820AD1',
        },
        1
      );

      expect(res.id).toBe('card-1');
      expect(res.limite_total).toBe(5000);
      expect(CardRepository.criarCartao).toHaveBeenCalledTimes(1);
    });
  });

  describe('lancarTransacao', () => {
    const mockCartao = {
      id: 'card-1',
      usuario_id: 1,
      nome: 'Nubank',
      limite_total: 3000,
      dia_fechamento: 20,
      dia_vencimento: 28,
      cor_identificacao: '#820AD1',
      ativo: true,
    };

    it('deve lançar erro se o limite disponível for insuficiente', async () => {
      vi.mocked(CardRepository.buscarCartaoPorId).mockResolvedValue(mockCartao);
      vi.mocked(CardRepository.obterLimiteComprometido).mockResolvedValue(2500); // Disponível: 500

      await expect(
        CardBusiness.lancarTransacao(
          {
            cartao_id: 'card-1',
            descricao: 'Notebook Gamer',
            valor_total: 600, // Excede 500 disponível
            quantidade_parcelas: 3,
            data_compra: '2026-10-15',
          },
          1
        )
      ).rejects.toThrow(CardValidationError);
    });

    it('deve parcelar compra e criar faturas automaticamente em transação atômica', async () => {
      vi.mocked(CardRepository.buscarCartaoPorId).mockResolvedValue(mockCartao);
      vi.mocked(CardRepository.obterLimiteComprometido).mockResolvedValue(0);
      vi.mocked(CardRepository.listarFaturas).mockResolvedValue([]);

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      vi.mocked(pool.connect).mockResolvedValue(mockClient as any);

      vi.mocked(CardRepository.buscarFaturaPorMesAno).mockResolvedValue(undefined);
      vi.mocked(CardRepository.criarFatura).mockImplementation(async (dados) => ({
        id: `fat-${dados.mes_referencia}`,
        cartao_id: dados.cartao_id,
        mes_referencia: dados.mes_referencia,
        ano_referencia: dados.ano_referencia,
        data_fechamento: dados.data_fechamento,
        data_vencimento: dados.data_vencimento,
        status: 'OPEN',
      }));

      vi.mocked(CardRepository.criarTransacao).mockResolvedValue({
        id: 'tx-1',
        cartao_id: 'card-1',
        descricao: 'Smartphone',
        valor_total: 300,
        quantidade_parcelas: 3,
        data_compra: new Date('2026-10-10'),
      });

      vi.mocked(CardRepository.criarItensFatura).mockImplementation(async (itens) =>
        itens.map((it, idx) => ({
          id: `item-${idx + 1}`,
          fatura_id: it.fatura_id,
          transacao_id: it.transacao_id,
          numero_parcela: it.numero_parcela,
          valor_parcela: it.valor_parcela,
        }))
      );

      const res = await CardBusiness.lancarTransacao(
        {
          cartao_id: 'card-1',
          descricao: 'Smartphone',
          valor_total: 300,
          quantidade_parcelas: 3,
          data_compra: '2026-10-10',
        },
        1
      );

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(CardRepository.criarTransacao).toHaveBeenCalledTimes(1);
      expect(CardRepository.criarItensFatura).toHaveBeenCalledTimes(1);

      // Compra dia 10 (antes do fechamento 20) -> 1ª parcela no mês 10, 2ª no mês 11, 3ª no mês 12
      expect(CardRepository.criarFatura).toHaveBeenCalledTimes(3);
      expect(res.itens).toHaveLength(3);
      expect(res.itens[0].valor_parcela).toBe(100);
      expect(res.itens[1].valor_parcela).toBe(100);
      expect(res.itens[2].valor_parcela).toBe(100);
    });
  });

  describe('pagarFatura', () => {
    it('deve marcar fatura como PAID e recompor limite', async () => {
      const mockCartao = {
        id: 'card-1',
        usuario_id: 1,
        nome: 'Nubank',
        limite_total: 2000,
        dia_fechamento: 20,
        dia_vencimento: 28,
        cor_identificacao: '#820AD1',
        ativo: true,
      };

      const mockFatura = {
        id: 'fat-1',
        cartao_id: 'card-1',
        mes_referencia: 10,
        ano_referencia: 2026,
        data_fechamento: new Date(),
        data_vencimento: new Date(),
        status: 'OPEN' as const,
        total_fatura: 750,
      };

      vi.mocked(CardRepository.buscarFaturaPorId).mockResolvedValue(mockFatura);
      vi.mocked(CardRepository.buscarCartaoPorId).mockResolvedValue(mockCartao);
      vi.mocked(CardRepository.atualizarStatusFatura).mockResolvedValue({
        ...mockFatura,
        status: 'PAID',
        valor_pago: 750,
        data_pagamento: new Date(),
      });
      vi.mocked(CardRepository.obterLimiteComprometido).mockResolvedValue(0);
      vi.mocked(CardRepository.listarFaturas).mockResolvedValue([]);

      const res = await CardBusiness.pagarFatura('fat-1', 1, { valor_pago: 750 });

      expect(res.fatura.status).toBe('PAID');
      expect(res.cartaoAtualizado.limite_disponivel).toBe(2000);
      expect(CardRepository.atualizarStatusFatura).toHaveBeenCalledWith(
        'fat-1',
        'PAID',
        expect.any(Date),
        750
      );
    });

    it('deve rejeitar pagamento de fatura já liquidada', async () => {
      const mockCartao = {
        id: 'card-1',
        usuario_id: 1,
        nome: 'Nubank',
        limite_total: 2000,
        dia_fechamento: 20,
        dia_vencimento: 28,
        cor_identificacao: '#820AD1',
        ativo: true,
      };

      const mockFaturaPaga = {
        id: 'fat-1',
        cartao_id: 'card-1',
        mes_referencia: 10,
        ano_referencia: 2026,
        data_fechamento: new Date(),
        data_vencimento: new Date(),
        status: 'PAID' as const,
      };

      vi.mocked(CardRepository.buscarFaturaPorId).mockResolvedValue(mockFaturaPaga);
      vi.mocked(CardRepository.buscarCartaoPorId).mockResolvedValue(mockCartao);

      await expect(CardBusiness.pagarFatura('fat-1', 1)).rejects.toThrow(
        CardValidationError
      );
    });
  });
});

