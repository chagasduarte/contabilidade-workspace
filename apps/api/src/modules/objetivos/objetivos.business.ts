import { ObjetivosRepository } from './objetivos.repository';
import { ObjetivoEntity, CreateObjetivoDto } from './objetivos.types';

export const ObjetivosBusiness = {
  async criar(objetivo: CreateObjetivoDto, userid: number): Promise<ObjetivoEntity> {
    if (!objetivo.nome?.trim() || objetivo.valor_objetivo == null) {
      throw new Error('Nome e valor do objetivo são obrigatórios');
    }
    return await ObjetivosRepository.criar(objetivo, userid);
  },

  async listar(userid: number): Promise<ObjetivoEntity[]> {
    return await ObjetivosRepository.listar(userid);
  },

  async buscar(objetivoid: number | string): Promise<ObjetivoEntity | undefined> {
    return await ObjetivosRepository.buscar(objetivoid);
  },
};

