import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoriaBusiness } from './categoria.business';
import { CategoriaRepository } from './categoria.repository';
import { SubcategoriaBusiness } from '../subcategoria/subcategoria.business';
import { SubcategoriaRepository } from '../subcategoria/subcategoria.repository';
import {
  CategoriaConflictError,
  CategoriaForbiddenError,
  CategoriaNotFoundError,
  CategoriaValidationError,
} from './categoria.types';

vi.mock('./categoria.repository', () => ({
  CategoriaRepository: {
    criar: vi.fn(),
    listar: vi.fn(),
    buscar: vi.fn(),
    existeGlobal: vi.fn(),
    atualizar: vi.fn(),
    deletar: vi.fn(),
  },
}));

vi.mock('../subcategoria/subcategoria.repository', () => ({
  SubcategoriaRepository: {
    criar: vi.fn(),
    listar: vi.fn(),
    listarPorCategoria: vi.fn(),
    buscar: vi.fn(),
    existeGlobal: vi.fn(),
    atualizar: vi.fn(),
    deletar: vi.fn(),
  },
}));

const duplicado = () =>
  Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'uq_categoria_dono_nome_tipo' });

describe('CategoriaBusiness (categorias por usuário)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cria a categoria com o userid do usuário autenticado', async () => {
    vi.mocked(CategoriaRepository.criar).mockResolvedValueOnce({ id: 1, nome: 'Pets', userid: 7 });

    await CategoriaBusiness.criar({ nome: '  Pets ', tipo: 'despesa' }, 7);

    expect(CategoriaRepository.criar).toHaveBeenCalledWith({ nome: 'Pets', tipo: 'despesa' }, 7);
  });

  it('rejeita tipo fora de despesa/receita', async () => {
    await expect(CategoriaBusiness.criar({ nome: 'X', tipo: 'outro' as never }, 7)).rejects.toBeInstanceOf(
      CategoriaValidationError
    );
    expect(CategoriaRepository.criar).not.toHaveBeenCalled();
  });

  it('nome duplicado no escopo do dono vira conflito (409)', async () => {
    vi.mocked(CategoriaRepository.criar).mockRejectedValueOnce(duplicado());

    await expect(CategoriaBusiness.criar({ nome: 'Mercado' }, 7)).rejects.toBeInstanceOf(CategoriaConflictError);
  });

  it('lista categorias do usuário + globais', async () => {
    vi.mocked(CategoriaRepository.listar).mockResolvedValueOnce([]);
    await CategoriaBusiness.listar(7, 'receita');
    expect(CategoriaRepository.listar).toHaveBeenCalledWith(7, 'receita');
  });

  it('atualizar categoria global responde proibido (403)', async () => {
    vi.mocked(CategoriaRepository.atualizar).mockResolvedValueOnce(undefined);
    vi.mocked(CategoriaRepository.existeGlobal).mockResolvedValueOnce(true);

    await expect(CategoriaBusiness.atualizar('3', { nome: 'Hack' }, 7)).rejects.toBeInstanceOf(
      CategoriaForbiddenError
    );
    expect(CategoriaRepository.atualizar).toHaveBeenCalledWith('3', { nome: 'Hack' }, 7);
  });

  it('excluir categoria inexistente ou de outro usuário responde não encontrada (404)', async () => {
    vi.mocked(CategoriaRepository.deletar).mockResolvedValueOnce(undefined);
    vi.mocked(CategoriaRepository.existeGlobal).mockResolvedValueOnce(false);

    await expect(CategoriaBusiness.deletar('99', 7)).rejects.toBeInstanceOf(CategoriaNotFoundError);
  });

  it('id não numérico não chega ao banco', async () => {
    expect(await CategoriaBusiness.buscar('abc', 7)).toBeUndefined();
    await expect(CategoriaBusiness.deletar('abc', 7)).rejects.toBeInstanceOf(CategoriaNotFoundError);
    expect(CategoriaRepository.buscar).not.toHaveBeenCalled();
    expect(CategoriaRepository.deletar).not.toHaveBeenCalled();
  });
});

describe('SubcategoriaBusiness (categorias por usuário)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cria subcategoria sob categoria visível, sempre com o userid do usuário', async () => {
    vi.mocked(CategoriaRepository.buscar).mockResolvedValueOnce({ id: 3, nome: 'Casa', userid: null });
    vi.mocked(SubcategoriaRepository.criar).mockResolvedValueOnce({ id: 1, idcategoria: 3, nome: 'Luz', userid: 7 });

    await SubcategoriaBusiness.criar({ idcategoria: 3, nome: 'Luz' }, 7);

    expect(CategoriaRepository.buscar).toHaveBeenCalledWith(3, 7);
    expect(SubcategoriaRepository.criar).toHaveBeenCalledWith({ idcategoria: 3, nome: 'Luz' }, 7);
  });

  it('não cria subcategoria sob categoria de outro usuário', async () => {
    vi.mocked(CategoriaRepository.buscar).mockResolvedValueOnce(undefined);

    await expect(SubcategoriaBusiness.criar({ idcategoria: 50, nome: 'X' }, 7)).rejects.toBeInstanceOf(
      CategoriaNotFoundError
    );
    expect(SubcategoriaRepository.criar).not.toHaveBeenCalled();
  });

  it('não move subcategoria para categoria de outro usuário', async () => {
    vi.mocked(CategoriaRepository.buscar).mockResolvedValueOnce(undefined);

    await expect(SubcategoriaBusiness.atualizar('1', { idcategoria: 50 }, 7)).rejects.toBeInstanceOf(
      CategoriaNotFoundError
    );
    expect(SubcategoriaRepository.atualizar).not.toHaveBeenCalled();
  });

  it('excluir subcategoria global responde proibido (403)', async () => {
    vi.mocked(SubcategoriaRepository.deletar).mockResolvedValueOnce(undefined);
    vi.mocked(SubcategoriaRepository.existeGlobal).mockResolvedValueOnce(true);

    await expect(SubcategoriaBusiness.deletar('4', 7)).rejects.toBeInstanceOf(CategoriaForbiddenError);
  });

  it('nome duplicado na mesma categoria vira conflito (409)', async () => {
    vi.mocked(CategoriaRepository.buscar).mockResolvedValueOnce({ id: 3, nome: 'Casa', userid: 7 });
    vi.mocked(SubcategoriaRepository.criar).mockRejectedValueOnce(
      Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'uq_subcategoria_dono_nome' })
    );

    await expect(SubcategoriaBusiness.criar({ idcategoria: 3, nome: 'Luz' }, 7)).rejects.toBeInstanceOf(
      CategoriaConflictError
    );
  });
});
