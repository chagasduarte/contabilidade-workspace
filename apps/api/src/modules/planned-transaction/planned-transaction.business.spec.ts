// planned-transaction.business.spec.ts
// Testes unitários para PlannedTransactionBusiness com Vitest

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PlannedTransactionBusiness,
  PlannedTransactionValidationError,
  PlannedTransactionNotFoundError,
} from './planned-transaction.business';
import { PlannedTransactionRepository } from './planned-transaction.repository';
import { codificarCursor, decodificarCursor, PaginacaoInvalidaError } from '../../common/utils/paginacao';
import { PlannedTransactionEntity } from './planned-transaction.entity';
import { CreatePlannedTransactionDto } from './planned-transaction.dto';
import { CategoriaBusiness } from '../categoria/categoria.business';

vi.mock('../categoria/categoria.business', () => ({
  CategoriaBusiness: {
    categoriaVisivel: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('./planned-transaction.repository', () => ({
  PlannedTransactionRepository: {
    criar: vi.fn(),
    listar: vi.fn(),
    listarPagina: vi.fn(),
    buscarPorId: vi.fn(),
    atualizar: vi.fn(),
    deletar: vi.fn(),
    cancelar: vi.fn(),
    buscarMestresAtivos: vi.fn(),
    existeOcorrenciaNoMesAno: vi.fn(),
    atualizarEmMassaFuturas: vi.fn(),
  },
}));

describe('PlannedTransactionBusiness', () => {
  const mockUserId = 42;
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';

  const mockEntity: PlannedTransactionEntity = {
    id: validUuid,
    userid: mockUserId,
    descricao: 'Salário Mensal Previsto',
    tipo: 'RECEITA',
    valor: 5000.0,
    data_prevista: new Date('2026-11-05T00:00:00Z'),
    idcategoria: 1,
    recorrencia: 'MENSAL',
    data_limite_recorrencia: null,
    status: 'PENDING',
    created_at: new Date('2026-10-16T12:00:00Z'),
    updated_at: new Date('2026-10-16T12:00:00Z'),
    categoria_nome: 'Salário',
    categoria_icone: 'cash-outline',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validação e Criação (criar)', () => {
    it('deve rejeitar idcategoria de categoria não visível ao usuário (outro dono)', async () => {
      vi.mocked(CategoriaBusiness.categoriaVisivel).mockResolvedValueOnce(false);

      await expect(
        PlannedTransactionBusiness.criar(
          { descricao: 'Aluguel', tipo: 'DESPESA', valor: 100, data_prevista: '2026-11-10', idcategoria: 77 },
          mockUserId
        )
      ).rejects.toThrow('Categoria não encontrada.');
      expect(CategoriaBusiness.categoriaVisivel).toHaveBeenCalledWith(77, mockUserId);
      expect(PlannedTransactionRepository.criar).not.toHaveBeenCalled();
    });

    it('deve lançar erro se a descrição for vazia ou ausente', async () => {
      const dto = {
        descricao: '   ',
        tipo: 'DESPESA' as const,
        valor: 100,
        data_prevista: '2026-11-01',
      };

      await expect(PlannedTransactionBusiness.criar(dto, mockUserId)).rejects.toThrow(
        PlannedTransactionValidationError
      );
      await expect(PlannedTransactionBusiness.criar(dto, mockUserId)).rejects.toThrow(
        'A descrição da transação planejada é obrigatória.'
      );
    });

    it('deve lançar erro se a descrição exceder 255 caracteres', async () => {
      const dto: CreatePlannedTransactionDto = {
        descricao: 'A'.repeat(256),
        tipo: 'DESPESA',
        valor: 100,
        data_prevista: '2026-11-01',
      };

      await expect(PlannedTransactionBusiness.criar(dto, mockUserId)).rejects.toThrow(
        'A descrição não pode ultrapassar 255 caracteres.'
      );
    });

    it('deve lançar erro se o tipo for inválido', async () => {
      const dto = {
        descricao: 'Compra Supermercado',
        tipo: 'INVALIDO' as any,
        valor: 150,
        data_prevista: '2026-11-01',
      };

      await expect(PlannedTransactionBusiness.criar(dto, mockUserId)).rejects.toThrow(
        /O tipo é obrigatório e deve ser 'RECEITA' ou 'DESPESA'/
      );
    });

    it('deve lançar erro se o valor for menor ou igual a zero', async () => {
      const dto: CreatePlannedTransactionDto = {
        descricao: 'Assinatura',
        tipo: 'DESPESA',
        valor: 0,
        data_prevista: '2026-11-01',
      };

      await expect(PlannedTransactionBusiness.criar(dto, mockUserId)).rejects.toThrow(
        'O valor deve ser um número positivo maior que zero.'
      );
    });

    it('deve lançar erro se a data prevista for inválida', async () => {
      const dto: CreatePlannedTransactionDto = {
        descricao: 'Boleto',
        tipo: 'DESPESA',
        valor: 120,
        data_prevista: 'data-invalida',
      };

      await expect(PlannedTransactionBusiness.criar(dto, mockUserId)).rejects.toThrow(
        'A data prevista é obrigatória e deve conter uma data válida.'
      );
    });

    it('deve lançar erro se a recorrência for inválida', async () => {
      const dto: CreatePlannedTransactionDto = {
        descricao: 'Boleto',
        tipo: 'DESPESA',
        valor: 120,
        data_prevista: '2026-11-10',
        recorrencia: 'DIARIO' as any,
      };

      await expect(PlannedTransactionBusiness.criar(dto, mockUserId)).rejects.toThrow(
        /Recorrência inválida/
      );
    });

    it('deve criar com sucesso com dados válidos e defaults preenchidos (avulso/NONE)', async () => {
      vi.mocked(PlannedTransactionRepository.criar).mockResolvedValue({
        ...mockEntity,
        recorrencia: 'NONE',
      });

      const dto: CreatePlannedTransactionDto = {
        descricao: ' Salário Mensal Previsto ',
        tipo: 'RECEITA',
        valor: 5000.0,
        data_prevista: '2026-11-05',
        recorrencia: 'NONE',
      };

      const resultado = await PlannedTransactionBusiness.criar(dto, mockUserId);

      expect(PlannedTransactionRepository.criar).toHaveBeenCalledWith(
        expect.objectContaining({
          descricao: 'Salário Mensal Previsto',
          tipo: 'RECEITA',
          valor: 5000.0,
          recorrencia: 'NONE',
          status: 'PENDING',
        }),
        mockUserId
      );

      expect(resultado.id).toBe(validUuid);
      expect(resultado.descricao).toBe('Salário Mensal Previsto');
      expect(resultado.tipo).toBe('RECEITA');
      expect(resultado.valor).toBe(5000.0);
    });

    it('deve criar transação com recorrência MENSAL e materializar automaticamente os próximos 3 meses', async () => {
      vi.mocked(PlannedTransactionRepository.criar).mockResolvedValue(mockEntity);

      const dto: CreatePlannedTransactionDto = {
        descricao: 'Aluguel Apartamento',
        tipo: 'DESPESA',
        valor: 2500.0,
        data_prevista: '2026-11-05',
        recorrencia: 'MENSAL',
      };

      const resultado = await PlannedTransactionBusiness.criar(dto, mockUserId);

      // 1 mestre + 3 ocorrências materializadas = 4 chamadas a PlannedTransactionRepository.criar
      expect(PlannedTransactionRepository.criar).toHaveBeenCalledTimes(4);

      // Chamada 1: Mestre
      expect(PlannedTransactionRepository.criar).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          descricao: 'Aluguel Apartamento',
          tipo: 'DESPESA',
          valor: 2500.0,
          data_prevista: '2026-11-05',
          recorrencia: 'MENSAL',
          parent_recurrence_id: null,
        }),
        mockUserId,
        undefined
      );

      // Chamada 2: 1º Mês subsequente (dezembro)
      expect(PlannedTransactionRepository.criar).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data_prevista: '2026-12-05',
          parent_recurrence_id: validUuid,
        }),
        mockUserId,
        undefined
      );

      // Chamada 3: 2º Mês subsequente (janeiro próximo ano)
      expect(PlannedTransactionRepository.criar).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          data_prevista: '2027-01-05',
          parent_recurrence_id: validUuid,
        }),
        mockUserId,
        undefined
      );

      // Chamada 4: 3º Mês subsequente (fevereiro próximo ano)
      expect(PlannedTransactionRepository.criar).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          data_prevista: '2027-02-05',
          parent_recurrence_id: validUuid,
        }),
        mockUserId,
        undefined
      );

      expect(resultado.id).toBe(validUuid);
    });
  });

  describe('Listagem com Filtros (listar)', () => {
    it('deve listar chamando o repositório com filtros repassados', async () => {
      vi.mocked(PlannedTransactionRepository.listar).mockResolvedValue([mockEntity]);

      const filtros = {
        status: 'PENDING',
        tipo: 'RECEITA',
        dataInicio: '2026-11-01',
        dataFim: '2026-11-30',
      };

      const resultado = await PlannedTransactionBusiness.listar(filtros, mockUserId);

      expect(PlannedTransactionRepository.listar).toHaveBeenCalledWith(filtros, mockUserId);
      expect(resultado).toHaveLength(1);
      expect(resultado[0].id).toBe(validUuid);
      expect(resultado[0].data_prevista).toBe('2026-11-05');
    });

    it('deve rejeitar se userid não for informado', async () => {
      await expect(PlannedTransactionBusiness.listar({}, 0)).rejects.toThrow(
        PlannedTransactionValidationError
      );
    });
  });

  describe('Listagem paginada (listarPagina)', () => {
    it('primeira página: sem cursor, mantém a janela e devolve next_cursor opaco', async () => {
      vi.mocked(PlannedTransactionRepository.buscarMestresAtivos).mockResolvedValue([]);
      const proxima = { data_prevista: '2026-11-05', created_at: '2026-11-01 10:00:00.123456+00', id: validUuid };
      vi.mocked(PlannedTransactionRepository.listarPagina).mockResolvedValue({ items: [mockEntity], proxima });

      const res = await PlannedTransactionBusiness.listarPagina({ tipo: 'RECEITA' }, mockUserId, null, 1);

      expect(PlannedTransactionRepository.listarPagina).toHaveBeenCalledWith({ tipo: 'RECEITA' }, mockUserId, null, 1);
      expect(PlannedTransactionRepository.buscarMestresAtivos).toHaveBeenCalled();
      expect(res.items[0].id).toBe(validUuid);
      expect(decodificarCursor(res.next_cursor as string, ['data_prevista', 'created_at', 'id'])).toEqual(proxima);
    });

    it('páginas seguintes repassam a chave decodificada e não mexem na janela', async () => {
      const chave = { data_prevista: '2026-11-05', created_at: '2026-11-01 10:00:00.123456+00', id: validUuid };
      vi.mocked(PlannedTransactionRepository.listarPagina).mockResolvedValue({ items: [], proxima: null });

      const res = await PlannedTransactionBusiness.listarPagina({}, mockUserId, codificarCursor(chave), 50);

      expect(PlannedTransactionRepository.listarPagina).toHaveBeenCalledWith({}, mockUserId, chave, 50);
      expect(PlannedTransactionRepository.buscarMestresAtivos).not.toHaveBeenCalled();
      expect(res.next_cursor).toBeNull();
    });

    it('cursor inválido é rejeitado', async () => {
      await expect(PlannedTransactionBusiness.listarPagina({}, mockUserId, 'lixo', 50)).rejects.toThrow(
        PaginacaoInvalidaError
      );
      const semUuid = codificarCursor({ data_prevista: '2026-11-05', created_at: 'x', id: '1; DROP' });
      await expect(PlannedTransactionBusiness.listarPagina({}, mockUserId, semUuid, 50)).rejects.toThrow(
        PaginacaoInvalidaError
      );
      expect(PlannedTransactionRepository.listarPagina).not.toHaveBeenCalled();
    });
  });

  describe('Busca por ID (buscarPorId)', () => {
    it('deve lançar erro se o ID não for um UUID válido', async () => {
      await expect(
        PlannedTransactionBusiness.buscarPorId('id-invalido', mockUserId)
      ).rejects.toThrow('ID da transação planejada deve ser um UUID válido.');
    });

    it('deve lançar PlannedTransactionNotFoundError se não encontrar registro', async () => {
      vi.mocked(PlannedTransactionRepository.buscarPorId).mockResolvedValue(null);

      await expect(
        PlannedTransactionBusiness.buscarPorId(validUuid, mockUserId)
      ).rejects.toThrow(PlannedTransactionNotFoundError);
    });

    it('deve retornar a transação planejada formatada quando encontrada', async () => {
      vi.mocked(PlannedTransactionRepository.buscarPorId).mockResolvedValue(mockEntity);

      const resultado = await PlannedTransactionBusiness.buscarPorId(validUuid, mockUserId);
      expect(resultado.id).toBe(validUuid);
      expect(resultado.descricao).toBe('Salário Mensal Previsto');
    });
  });

  describe('Atualização (atualizar)', () => {
    it('deve rejeitar idcategoria de categoria não visível ao usuário (outro dono)', async () => {
      vi.mocked(PlannedTransactionRepository.buscarPorId).mockResolvedValue(mockEntity);
      vi.mocked(CategoriaBusiness.categoriaVisivel).mockResolvedValueOnce(false);

      await expect(
        PlannedTransactionBusiness.atualizar(validUuid, { idcategoria: 77 }, mockUserId)
      ).rejects.toThrow(PlannedTransactionValidationError);
      expect(CategoriaBusiness.categoriaVisivel).toHaveBeenCalledWith(77, mockUserId);
      expect(PlannedTransactionRepository.atualizar).not.toHaveBeenCalled();
    });

    it('deve permitir remover a categoria (idcategoria null) sem consultar posse', async () => {
      vi.mocked(PlannedTransactionRepository.buscarPorId).mockResolvedValue(mockEntity);
      vi.mocked(PlannedTransactionRepository.atualizar).mockResolvedValue({ ...mockEntity, idcategoria: null });

      await PlannedTransactionBusiness.atualizar(validUuid, { idcategoria: null }, mockUserId);
      expect(CategoriaBusiness.categoriaVisivel).not.toHaveBeenCalled();
    });

    it('deve lançar erro se id for inválido', async () => {
      await expect(
        PlannedTransactionBusiness.atualizar('123', { valor: 200 }, mockUserId)
      ).rejects.toThrow('ID da transação planejada deve ser um UUID válido.');
    });

    it('deve lançar PlannedTransactionNotFoundError se transação não existir', async () => {
      vi.mocked(PlannedTransactionRepository.buscarPorId).mockResolvedValue(null);

      await expect(
        PlannedTransactionBusiness.atualizar(validUuid, { valor: 200 }, mockUserId)
      ).rejects.toThrow(PlannedTransactionNotFoundError);
    });

    it('deve atualizar com sucesso campos válidos', async () => {
      vi.mocked(PlannedTransactionRepository.buscarPorId).mockResolvedValue(mockEntity);
      const updatedEntity = { ...mockEntity, valor: 5500.0, status: 'SETTLED' as const };
      vi.mocked(PlannedTransactionRepository.atualizar).mockResolvedValue(updatedEntity);

      const resultado = await PlannedTransactionBusiness.atualizar(
        validUuid,
        { valor: 5500.0, status: 'SETTLED' },
        mockUserId
      );

      expect(PlannedTransactionRepository.atualizar).toHaveBeenCalledWith(
        validUuid,
        expect.objectContaining({ valor: 5500.0, status: 'SETTLED' }),
        mockUserId
      );
      expect(resultado.valor).toBe(5500.0);
      expect(resultado.status).toBe('SETTLED');
    });
  });

  describe('Exclusão Física e Lógica (deletar)', () => {
    it('deve realizar exclusão física com sucesso', async () => {
      vi.mocked(PlannedTransactionRepository.buscarPorId).mockResolvedValue(mockEntity);
      vi.mocked(PlannedTransactionRepository.deletar).mockResolvedValue(true);

      const resultado = await PlannedTransactionBusiness.deletar(validUuid, mockUserId, false);

      expect(PlannedTransactionRepository.deletar).toHaveBeenCalledWith(validUuid, mockUserId);
      expect(resultado.message).toBe('Transação planejada excluída com sucesso.');
    });

    it('deve realizar exclusão lógica (cancelamento) quando soft=true', async () => {
      vi.mocked(PlannedTransactionRepository.buscarPorId).mockResolvedValue(mockEntity);
      vi.mocked(PlannedTransactionRepository.cancelar).mockResolvedValue({
        ...mockEntity,
        status: 'CANCELLED',
      });

      const resultado = await PlannedTransactionBusiness.deletar(validUuid, mockUserId, true);

      expect(PlannedTransactionRepository.cancelar).toHaveBeenCalledWith(validUuid, mockUserId);
      expect(resultado.message).toBe('Transação planejada cancelada com sucesso.');
      expect(resultado.status).toBe('CANCELLED');
    });

    it('deve lançar PlannedTransactionNotFoundError se registro a deletar não for encontrado', async () => {
      vi.mocked(PlannedTransactionRepository.buscarPorId).mockResolvedValue(null);

      await expect(
        PlannedTransactionBusiness.deletar(validUuid, mockUserId)
      ).rejects.toThrow(PlannedTransactionNotFoundError);
    });
  });

  describe('Manutenção da Janela Deslizante (ensureRollingWindow)', () => {
    it('deve provisionar meses faltantes sem duplicatas', async () => {
      vi.mocked(PlannedTransactionRepository.buscarMestresAtivos).mockResolvedValue([mockEntity]);
      vi.mocked(PlannedTransactionRepository.existeOcorrenciaNoMesAno).mockResolvedValue(false);

      await PlannedTransactionBusiness.ensureRollingWindow(mockUserId, 3);

      expect(PlannedTransactionRepository.buscarMestresAtivos).toHaveBeenCalledWith(
        mockUserId,
        undefined
      );
      expect(PlannedTransactionRepository.existeOcorrenciaNoMesAno).toHaveBeenCalled();
      expect(PlannedTransactionRepository.criar).toHaveBeenCalled();
    });

    it('não deve criar ocorrência se já existir para o mês/ano (idempotência)', async () => {
      vi.mocked(PlannedTransactionRepository.buscarMestresAtivos).mockResolvedValue([mockEntity]);
      vi.mocked(PlannedTransactionRepository.existeOcorrenciaNoMesAno).mockResolvedValue(true);

      await PlannedTransactionBusiness.ensureRollingWindow(mockUserId, 3);

      expect(PlannedTransactionRepository.criar).not.toHaveBeenCalled();
    });
  });

  describe('Atualização com modos SINGLE e ALL_FUTURE', () => {
    it('deve atualizar apenas o registro específico quando updateMode for SINGLE', async () => {
      vi.mocked(PlannedTransactionRepository.buscarPorId).mockResolvedValue(mockEntity);
      vi.mocked(PlannedTransactionRepository.atualizar).mockResolvedValue({
        ...mockEntity,
        valor: 5200.0,
      });

      const resultado = await PlannedTransactionBusiness.atualizar(
        validUuid,
        { valor: 5200.0, updateMode: 'SINGLE' },
        mockUserId
      );

      expect(PlannedTransactionRepository.atualizar).toHaveBeenCalledWith(
        validUuid,
        expect.objectContaining({ valor: 5200.0 }),
        mockUserId
      );
      expect(PlannedTransactionRepository.atualizarEmMassaFuturas).not.toHaveBeenCalled();
      expect(resultado.valor).toBe(5200.0);
    });

    it('deve atualizar todas as instâncias pendentes futuras quando updateMode for ALL_FUTURE', async () => {
      vi.mocked(PlannedTransactionRepository.buscarPorId).mockResolvedValue(mockEntity);
      vi.mocked(PlannedTransactionRepository.atualizarEmMassaFuturas).mockResolvedValue(3);

      await PlannedTransactionBusiness.atualizar(
        validUuid,
        { valor: 5300.0, updateMode: 'ALL_FUTURE' },
        mockUserId
      );

      expect(PlannedTransactionRepository.atualizarEmMassaFuturas).toHaveBeenCalledWith(
        validUuid,
        mockEntity.data_prevista,
        expect.objectContaining({ valor: 5300.0, updateMode: 'ALL_FUTURE' }),
        mockUserId
      );
    });
  });
});

