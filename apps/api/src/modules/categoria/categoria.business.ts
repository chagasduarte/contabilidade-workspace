import { CategoriaRepository } from './categoria.repository';
import {
  CategoriaEntity,
  CreateCategoriaDto,
  TipoCategoria,
  UpdateCategoriaDto,
} from './categoria.types';

export const CategoriaBusiness = {
  async criar(categoria: CreateCategoriaDto): Promise<CategoriaEntity> {
    if (!categoria.nome?.trim()) {
      throw new Error('Nome da categoria é obrigatório');
    }
    return await CategoriaRepository.criar(categoria);
  },

  async listar(tipo?: TipoCategoria): Promise<CategoriaEntity[]> {
    return await CategoriaRepository.listar(tipo);
  },

  async buscar(categoriaId: number | string): Promise<CategoriaEntity | undefined> {
    return await CategoriaRepository.buscar(categoriaId);
  },

  async atualizar(
    categoriaId: number | string,
    dto: UpdateCategoriaDto
  ): Promise<CategoriaEntity | undefined> {
    if (dto.nome !== undefined && !dto.nome.trim()) {
      throw new Error('Nome da categoria não pode ser vazio');
    }
    return await CategoriaRepository.atualizar(categoriaId, dto);
  },

  async deletar(categoriaId: number | string): Promise<CategoriaEntity | undefined> {
    return await CategoriaRepository.deletar(categoriaId);
  },
};


