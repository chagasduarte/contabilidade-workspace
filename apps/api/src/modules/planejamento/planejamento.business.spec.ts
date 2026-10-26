import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanejamentoBusiness } from './planejamento.business';
import { PlanejamentoRepository } from './planejamento.repository';
import { CategoriaRepository } from '../categoria/categoria.repository';
import { SubcategoriaRepository } from '../subcategoria/subcategoria.repository';
import { PlanejamentoEntity, PlanejamentoNotFoundError, PlanejamentoValidationError } from './planejamento.types';

vi.mock('./planejamento.repository', () => ({
  PlanejamentoRepository: {
    criar: vi.fn(),
    atualizar: vi.fn(),
    deletar: vi.fn(),
    listar: vi.fn(),
    buscarPorId: vi.fn(),
    buscarMesmoGrupo: vi.fn(),
    resumoMes: vi.fn(),
  },
}));
vi.mock('../categoria/categoria.repository', () => ({ CategoriaRepository: { buscar: vi.fn() } }));
vi.mock('../subcategoria/subcategoria.repository', () => ({ SubcategoriaRepository: { buscar: vi.fn() } }));

const categoria = { id: 3, nome: 'Casa', tipo: 'despesa' as const, userid: 7 };
const existente: PlanejamentoEntity = {
  id: 10,
  categoria: 'Casa',
  subcategoria: null,
  valor: 500,
  tipo: 'despesa',
  categoriaid: 3,
  subcategoriaid: null,
  data: '2026-11-01',
  userid: 7,
};

describe('PlanejamentoBusiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CategoriaRepository.buscar).mockResolvedValue(categoria);
  });

  describe('criar', () => {
    it('resolve o nome pela categoria do banco, usa o tipo da categoria e valor como number', async () => {
      vi.mocked(PlanejamentoRepository.buscarMesmoGrupo).mockResolvedValueOnce(undefined);
      vi.mocked(PlanejamentoRepository.criar).mockResolvedValueOnce(existente);

      await PlanejamentoBusiness.criar({ categoriaid: 3, valor: '500' as never, data: '2026-11-10' }, 7);

      expect(CategoriaRepository.buscar).toHaveBeenCalledWith(3, 7);
      expect(PlanejamentoRepository.criar).toHaveBeenCalledWith(
        {
          categoria: 'Casa',
          subcategoria: null,
          valor: 500,
          tipo: 'despesa',
          categoriaid: 3,
          subcategoriaid: null,
          data: '2026-11-10',
        },
        7
      );
    });

    it('soma no planejamento do mesmo grupo em vez de duplicar', async () => {
      vi.mocked(PlanejamentoRepository.buscarMesmoGrupo).mockResolvedValueOnce(existente);
      vi.mocked(PlanejamentoRepository.atualizar).mockResolvedValueOnce({ ...existente, valor: 750 });

      await PlanejamentoBusiness.criar({ categoriaid: 3, valor: 250, data: '2026-11-20' }, 7);

      expect(PlanejamentoRepository.buscarMesmoGrupo).toHaveBeenCalledWith(
        expect.objectContaining({ subcategoriaid: null, categoriaid: 3, tipo: 'despesa' }),
        7
      );
      expect(PlanejamentoRepository.atualizar).toHaveBeenCalledWith(10, expect.objectContaining({ valor: 750 }), 7);
      expect(PlanejamentoRepository.criar).not.toHaveBeenCalled();
    });

    it.each([
      [{ categoriaid: 3, valor: 0, data: '2026-11-10' }, 'valor deve ser um número maior que zero.'],
      [{ categoriaid: 3, valor: 10, data: '2026-13-01' }, 'data deve ser uma data válida no formato YYYY-MM-DD.'],
      [{ categoriaid: 3, valor: 10, data: '2026-11-10', tipo: 'outro' }, "tipo deve ser 'despesa' ou 'receita'."],
      [{ valor: 10, data: '2026-11-10' }, 'categoriaid é obrigatório.'],
    ])('rejeita %o', async (dto, mensagem) => {
      await expect(PlanejamentoBusiness.criar(dto as never, 7)).rejects.toThrow(mensagem);
      expect(PlanejamentoRepository.criar).not.toHaveBeenCalled();
    });

    it('categoria não visível ao usuário -> 400', async () => {
      vi.mocked(CategoriaRepository.buscar).mockResolvedValueOnce(undefined);
      await expect(
        PlanejamentoBusiness.criar({ categoriaid: 99, valor: 10, data: '2026-11-10' }, 7)
      ).rejects.toThrow('Categoria não encontrada.');
    });

    it('subcategoria de outra categoria -> 400', async () => {
      vi.mocked(SubcategoriaRepository.buscar).mockResolvedValueOnce({ id: 5, idcategoria: 4, nome: 'X', userid: 7 });
      await expect(
        PlanejamentoBusiness.criar({ categoriaid: 3, subcategoriaid: 5, valor: 10, data: '2026-11-10' }, 7)
      ).rejects.toThrow('Subcategoria não encontrada.');
    });
  });

  describe('atualizar / deletar / buscar', () => {
    it('PUT parcial mantém os demais campos; trocar categoria descarta a subcategoria', async () => {
      vi.mocked(PlanejamentoRepository.buscarPorId).mockResolvedValueOnce({ ...existente, subcategoriaid: 5 });
      vi.mocked(CategoriaRepository.buscar).mockResolvedValueOnce({ id: 4, nome: 'Lazer', tipo: 'despesa', userid: 7 });
      vi.mocked(PlanejamentoRepository.atualizar).mockResolvedValueOnce(existente);

      await PlanejamentoBusiness.atualizar('10', { categoriaid: 4 }, 7);

      expect(PlanejamentoRepository.atualizar).toHaveBeenCalledWith(
        '10',
        expect.objectContaining({ categoriaid: 4, categoria: 'Lazer', subcategoriaid: null, valor: 500 }),
        7
      );
    });

    it('não encontrado -> 404 (antes respondia 400)', async () => {
      vi.mocked(PlanejamentoRepository.buscarPorId).mockResolvedValue(undefined);
      vi.mocked(PlanejamentoRepository.deletar).mockResolvedValueOnce(false);
      await expect(PlanejamentoBusiness.atualizar('10', { valor: 1 }, 8)).rejects.toBeInstanceOf(PlanejamentoNotFoundError);
      await expect(PlanejamentoBusiness.deletar('10', 8)).rejects.toBeInstanceOf(PlanejamentoNotFoundError);
      await expect(PlanejamentoBusiness.buscar('10', 8)).rejects.toBeInstanceOf(PlanejamentoNotFoundError);
    });

    it('listar rejeita mês inválido', async () => {
      await expect(PlanejamentoBusiness.listar('13', '2026', 7)).rejects.toBeInstanceOf(PlanejamentoValidationError);
    });
  });

  describe('resumo (planejado x realizado)', () => {
    it('separa pago e pendente, soma totais e usa despesa como tipo padrão', async () => {
      vi.mocked(PlanejamentoRepository.resumoMes).mockResolvedValueOnce([
        { idcategoria: 3, categoria_nome: 'Casa', planejado: 1000, realizado_pago: 800, realizado_pendente: 450 },
        { idcategoria: 4, categoria_nome: 'Lazer', planejado: 0, realizado_pago: 90.1, realizado_pendente: 0.2 },
      ]);

      const r = await PlanejamentoBusiness.resumo('11', '2026', undefined, 7);

      expect(PlanejamentoRepository.resumoMes).toHaveBeenCalledWith(7, 11, 2026, 'despesa');
      expect(r.tipo).toBe('despesa');
      expect(r.categorias[0]).toEqual({
        idcategoria: 3,
        categoria_nome: 'Casa',
        planejado: 1000,
        realizado_pago: 800,
        realizado_pendente: 450,
      });
      expect(r.totais).toEqual({ planejado: 1000, realizado_pago: 890.1, realizado_pendente: 450.2 });
    });

    it('aceita tipo=receita e rejeita tipo inválido', async () => {
      vi.mocked(PlanejamentoRepository.resumoMes).mockResolvedValueOnce([]);
      await PlanejamentoBusiness.resumo('11', '2026', 'receita', 7);
      expect(PlanejamentoRepository.resumoMes).toHaveBeenCalledWith(7, 11, 2026, 'receita');

      await expect(PlanejamentoBusiness.resumo('11', '2026', 'saida', 7)).rejects.toBeInstanceOf(
        PlanejamentoValidationError
      );
    });
  });
});
