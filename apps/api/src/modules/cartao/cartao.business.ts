import { CartaoRepository } from './cartao.repository';
import { CartaoEntity, CreateCartaoDto } from './cartao.types';

export const CartaoBusiness = {
  async criar(cartao: CreateCartaoDto, userid: number): Promise<CartaoEntity> {
    if (!cartao.nome?.trim() || !cartao.dia_fatura) {
      throw new Error('Nome e dia da fatura são obrigatórios');
    }
    return await CartaoRepository.criar(cartao, userid);
  },

  async listar(userid: number): Promise<CartaoEntity[]> {
    return await CartaoRepository.listar(userid);
  },

  async buscar(cartaoid: number | string, userid: number): Promise<CartaoEntity | undefined> {
    return await CartaoRepository.buscar(cartaoid, userid);
  },
};

