import { SubcategoriaRepository } from './subcategoria.repository';
import { CategoriaRepository } from '../categoria/categoria.repository';
import {
  CategoriaForbiddenError,
  CategoriaNotFoundError,
  CategoriaValidationError,
  mapearConflitoCategoria,
} from '../categoria/categoria.types';
import {
  SubcategoriaEntity,
  CreateSubcategoriaDto,
  UpdateSubcategoriaDto,
} from './subcategoria.types';

const MSG_DUPLICADA = 'Você já possui uma subcategoria com este nome nesta categoria.';

/**
 * A categoria-pai precisa ser visível ao usuário (dele ou global).
 * A subcategoria criada pelo usuário é sempre dele (userid do token), mesmo sob categoria global.
 */
async function validarCategoriaPai(idcategoria: number | string, userid: number): Promise<void> {
  if (!/^\d+$/.test(String(idcategoria))) {
    throw new CategoriaValidationError('idcategoria inválido');
  }
  const pai = await CategoriaRepository.buscar(idcategoria, userid);
  if (!pai) {
    throw new CategoriaNotFoundError('Categoria não encontrada');
  }
}

/** Nada foi alterado: distingue subcategoria global (403) de inexistente/de outro usuário (404). */
async function falhaEscrita(subcategoriaId: number | string): Promise<never> {
  if (await SubcategoriaRepository.existeGlobal(subcategoriaId)) {
    throw new CategoriaForbiddenError('Subcategorias padrão do sistema não podem ser alteradas.');
  }
  throw new CategoriaNotFoundError('Subcategoria não encontrada');
}

export const SubcategoriaBusiness = {
  async criar(subcategoria: CreateSubcategoriaDto, userid: number): Promise<SubcategoriaEntity> {
    if (!subcategoria.nome?.trim() || !subcategoria.idcategoria) {
      throw new CategoriaValidationError('Nome e idcategoria são obrigatórios');
    }
    await validarCategoriaPai(subcategoria.idcategoria, userid);
    try {
      return await SubcategoriaRepository.criar({ ...subcategoria, nome: subcategoria.nome.trim() }, userid);
    } catch (error) {
      throw mapearConflitoCategoria(error, MSG_DUPLICADA);
    }
  },

  async listar(userid: number): Promise<SubcategoriaEntity[]> {
    return await SubcategoriaRepository.listar(userid);
  },

  async listarPorCategoria(idcategoria: number | string, userid: number): Promise<SubcategoriaEntity[]> {
    if (!/^\d+$/.test(String(idcategoria))) return [];
    return await SubcategoriaRepository.listarPorCategoria(idcategoria, userid);
  },

  async buscar(subcategoriaId: number | string, userid: number): Promise<SubcategoriaEntity | undefined> {
    if (!/^\d+$/.test(String(subcategoriaId))) return undefined;
    return await SubcategoriaRepository.buscar(subcategoriaId, userid);
  },

  /**
   * true se a subcategoria é visível ao usuário (dele ou global) e pertence à categoria informada.
   */
  async subcategoriaDaCategoria(
    subcategoriaId: number | string,
    idcategoria: number | string,
    userid: number
  ): Promise<boolean> {
    if (!/^\d+$/.test(String(subcategoriaId)) || !/^\d+$/.test(String(idcategoria))) return false;
    const sub = await SubcategoriaRepository.buscar(subcategoriaId, userid);
    return Boolean(sub && Number(sub.idcategoria) === Number(idcategoria));
  },

  async atualizar(
    subcategoriaId: number | string,
    dto: UpdateSubcategoriaDto,
    userid: number
  ): Promise<SubcategoriaEntity> {
    if (!/^\d+$/.test(String(subcategoriaId))) throw new CategoriaNotFoundError('Subcategoria não encontrada');
    if (dto.nome !== undefined && !dto.nome.trim()) {
      throw new CategoriaValidationError('Nome da subcategoria não pode ser vazio');
    }
    if (dto.idcategoria !== undefined && dto.idcategoria !== null) {
      await validarCategoriaPai(dto.idcategoria, userid);
    }

    let atualizada: SubcategoriaEntity | undefined;
    try {
      atualizada = await SubcategoriaRepository.atualizar(subcategoriaId, dto, userid);
    } catch (error) {
      throw mapearConflitoCategoria(error, MSG_DUPLICADA);
    }
    return atualizada ?? (await falhaEscrita(subcategoriaId));
  },

  async deletar(subcategoriaId: number | string, userid: number): Promise<SubcategoriaEntity> {
    if (!/^\d+$/.test(String(subcategoriaId))) throw new CategoriaNotFoundError('Subcategoria não encontrada');
    const removida = await SubcategoriaRepository.deletar(subcategoriaId, userid);
    return removida ?? (await falhaEscrita(subcategoriaId));
  },
};
