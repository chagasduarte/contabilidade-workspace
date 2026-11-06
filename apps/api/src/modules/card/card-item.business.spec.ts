import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardBusiness, CardValidationError, InvoiceNotFoundError } from './card.business';
import { CardItemRepository } from './card-item.repository';
import { CategoriaBusiness } from '../categoria/categoria.business';
import { SubcategoriaBusiness } from '../subcategoria/subcategoria.business';
vi.mock('./card-item.repository', () => ({ CardItemRepository: { atualizar: vi.fn() } }));
vi.mock('../categoria/categoria.business', () => ({ CategoriaBusiness: { categoriaVisivel: vi.fn() } }));
vi.mock('../subcategoria/subcategoria.business', () => ({ SubcategoriaBusiness: { subcategoriaDaCategoria: vi.fn() } }));
vi.mock('../../core/config/database', () => ({ pool: {} }));
const id = '12345678-1234-1234-1234-123456789012';
const dto = { descricao: ' Mercado ', valor_parcela: 250, categoria_id: 1, subcategoria_id: 11 };
describe('Validação da edição de despesa', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(CategoriaBusiness.categoriaVisivel).mockResolvedValue(true);
    vi.mocked(SubcategoriaBusiness.subcategoriaDaCategoria).mockResolvedValue(true);
    vi.mocked(CardItemRepository.atualizar).mockResolvedValue('updated');
  });
  it('valida a classificação e encaminha o usuário autenticado ao repositório', async () => {
    await CardBusiness.atualizarItem(id, 7, dto);
    expect(SubcategoriaBusiness.subcategoriaDaCategoria).toHaveBeenCalledWith(11, 1, 7);
    expect(CardItemRepository.atualizar).toHaveBeenCalledWith(id, 7, { ...dto, descricao: 'Mercado' });
  });
  it.each([NaN, Infinity, 0, -1, 1.001])('rejeita valor inválido %s', async valor_parcela => {
    await expect(CardBusiness.atualizarItem(id, 7, { ...dto, valor_parcela })).rejects.toThrow(CardValidationError);
    expect(CardItemRepository.atualizar).not.toHaveBeenCalled();
  });
  it('rejeita identificador inválido', async () => {
    await expect(CardBusiness.atualizarItem('invalido', 7, dto)).rejects.toThrow(CardValidationError);
  });
  it('rejeita subcategoria de outra categoria ou usuário', async () => {
    vi.mocked(SubcategoriaBusiness.subcategoriaDaCategoria).mockResolvedValue(false);
    await expect(CardBusiness.atualizarItem(id, 7, dto)).rejects.toThrow(CardValidationError);
    expect(CardItemRepository.atualizar).not.toHaveBeenCalled();
  });
  it('não distingue item inexistente de item alheio', async () => {
    vi.mocked(CardItemRepository.atualizar).mockResolvedValue('not-found');
    await expect(CardBusiness.atualizarItem(id, 7, dto)).rejects.toThrow(InvoiceNotFoundError);
  });
  it.each(['paid', 'limit'] as const)('traduz a restrição %s para erro de validação', async resultado => {
    vi.mocked(CardItemRepository.atualizar).mockResolvedValue(resultado);
    await expect(CardBusiness.atualizarItem(id, 7, dto)).rejects.toThrow(CardValidationError);
  });
});
