import { SubcategoriaRepository } from './subcategoria.repository';
import { SubcategoriaEntity, CreateSubcategoriaDto } from './subcategoria.types';

export const SubcategoriaBusiness = {
  async criar(subcategoria: CreateSubcategoriaDto): Promise<SubcategoriaEntity> {
    if (!subcategoria.nome?.trim() || !subcategoria.idcategoria) {
      throw new Error('Nome e idcategoria são obrigatórios');
    }
    return await SubcategoriaRepository.criar(subcategoria);
  },

  async listar(): Promise<SubcategoriaEntity[]> {
    return await SubcategoriaRepository.listar();
  },

  async listarPorCategoria(idcategoria: number | string): Promise<SubcategoriaEntity[]> {
    return await SubcategoriaRepository.listarPorCategoria(idcategoria);
  },

  async buscar(subcategoriaId: number | string): Promise<SubcategoriaEntity | undefined> {
    return await SubcategoriaRepository.buscar(subcategoriaId);
  },

  async deletar(subcategoriaId: number | string): Promise<SubcategoriaEntity | undefined> {
    return await SubcategoriaRepository.deletar(subcategoriaId);
  },
};

