import { CategoriaRepository } from './categoria.repository';
import {
  CategoriaEntity,
  CategoriaForbiddenError,
  CategoriaNotFoundError,
  CategoriaValidationError,
  CreateCategoriaDto,
  TipoCategoria,
  UpdateCategoriaDto,
  mapearConflitoCategoria,
} from './categoria.types';

const TIPOS_VALIDOS: TipoCategoria[] = ['despesa', 'receita'];
const MSG_DUPLICADA = 'Você já possui uma categoria com este nome e tipo.';

const idValido = (id: number | string): boolean => /^\d+$/.test(String(id));

function validarTipo(tipo: unknown): void {
  if (tipo !== undefined && tipo !== null && !TIPOS_VALIDOS.includes(tipo as TipoCategoria)) {
    throw new CategoriaValidationError("Tipo deve ser 'despesa' ou 'receita'.");
  }
}

/**
 * Nada foi alterado: distingue categoria global (403) de inexistente/de outro usuário (404).
 */
async function falhaEscrita(categoriaId: number | string): Promise<never> {
  if (await CategoriaRepository.existeGlobal(categoriaId)) {
    throw new CategoriaForbiddenError();
  }
  throw new CategoriaNotFoundError();
}

export const CategoriaBusiness = {
  async criar(categoria: CreateCategoriaDto, userid: number): Promise<CategoriaEntity> {
    if (!categoria.nome?.trim()) {
      throw new CategoriaValidationError('Nome da categoria é obrigatório');
    }
    validarTipo(categoria.tipo);
    try {
      return await CategoriaRepository.criar({ ...categoria, nome: categoria.nome.trim() }, userid);
    } catch (error) {
      throw mapearConflitoCategoria(error, MSG_DUPLICADA);
    }
  },

  async listar(userid: number, tipo?: TipoCategoria): Promise<CategoriaEntity[]> {
    validarTipo(tipo);
    return await CategoriaRepository.listar(userid, tipo);
  },

  async buscar(categoriaId: number | string, userid: number): Promise<CategoriaEntity | undefined> {
    if (!idValido(categoriaId)) return undefined;
    return await CategoriaRepository.buscar(categoriaId, userid);
  },

  async atualizar(
    categoriaId: number | string,
    dto: UpdateCategoriaDto,
    userid: number
  ): Promise<CategoriaEntity> {
    if (!idValido(categoriaId)) throw new CategoriaNotFoundError();
    if (dto.nome !== undefined && !dto.nome.trim()) {
      throw new CategoriaValidationError('Nome da categoria não pode ser vazio');
    }
    validarTipo(dto.tipo);

    let atualizada: CategoriaEntity | undefined;
    try {
      atualizada = await CategoriaRepository.atualizar(categoriaId, dto, userid);
    } catch (error) {
      throw mapearConflitoCategoria(error, MSG_DUPLICADA);
    }
    return atualizada ?? (await falhaEscrita(categoriaId));
  },

  /**
   * true se a categoria existe e é visível ao usuário (dele ou global).
   * Usado por transações, planejadas e cartão antes de gravar uma referência de categoria.
   */
  async categoriaVisivel(categoriaId: number | string, userid: number): Promise<boolean> {
    if (!idValido(categoriaId)) return false;
    return Boolean(await CategoriaRepository.buscar(categoriaId, userid));
  },

  async deletar(categoriaId: number | string, userid: number): Promise<CategoriaEntity> {
    if (!idValido(categoriaId)) throw new CategoriaNotFoundError();
    const removida = await CategoriaRepository.deletar(categoriaId, userid);
    return removida ?? (await falhaEscrita(categoriaId));
  },
};
