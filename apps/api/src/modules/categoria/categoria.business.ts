import { CategoriaRepository } from './categoria.repository';
import { CategoriaEntity, CreateCategoriaDto } from './categoria.types';

export const CategoriaBusiness = {
  async criar(categoria: CreateCategoriaDto): Promise<CategoriaEntity> {
    if (!categoria.nome?.trim()) {
      throw new Error('Nome da categoria é obrigatório');
    }
    return await CategoriaRepository.criar(categoria);
  },

  async listar(): Promise<CategoriaEntity[]> {
    return await CategoriaRepository.listar();
  },

  async buscar(categoriaId: number | string): Promise<CategoriaEntity | undefined> {
    return await CategoriaRepository.buscar(categoriaId);
  },

  async deletar(categoriaId: number | string): Promise<CategoriaEntity | undefined> {
    return await CategoriaRepository.deletar(categoriaId);
  },
};

