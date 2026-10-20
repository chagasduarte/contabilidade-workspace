import { SubcategoriaRepository } from './subcategoria.repository';
import {
  SubcategoriaEntity,
  CreateSubcategoriaDto,
  UpdateSubcategoriaDto,
} from './subcategoria.types';

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

  async atualizar(
    subcategoriaId: number | string,
    dto: UpdateSubcategoriaDto
  ): Promise<SubcategoriaEntity | undefined> {
    if (dto.nome !== undefined && !dto.nome.trim()) {
      throw new Error('Nome da subcategoria não pode ser vazio');
    }
    return await SubcategoriaRepository.atualizar(subcategoriaId, dto);
  },

  async deletar(subcategoriaId: number | string): Promise<SubcategoriaEntity | undefined> {
    return await SubcategoriaRepository.deletar(subcategoriaId);
  },
};


