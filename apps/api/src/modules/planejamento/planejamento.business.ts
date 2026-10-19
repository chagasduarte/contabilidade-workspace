import { PlanejamentoRepository } from './planejamento.repository';
import {
  PlanejamentoEntity,
  CreatePlanejamentoDto,
  UpdatePlanejamentoDto,
  AgrupamentoTipoPlanejamento,
} from './planejamento.types';

export const PlanejamentoBusiness = {
  async criar(dados: CreatePlanejamentoDto, userid: number): Promise<PlanejamentoEntity> {
    if (!dados.categoriaid || dados.valor == null || !dados.tipo) {
      throw new Error('Campos obrigatórios não informados');
    }

    const data = new Date(dados.data);
    const mes = data.getMonth() + 1;
    const ano = data.getFullYear();

    const planejados = await PlanejamentoRepository.buscar(
      mes,
      ano,
      null,
      dados.tipo,
      dados.categoriaid,
      dados.subcategoriaid,
      userid
    );

    const plan = planejados[0];
    if (plan) {
      const novoValor = Number(plan.valor) + Number(dados.valor);
      const atualizado = await PlanejamentoRepository.atualizar(
        plan.id,
        {
          categoria: plan.categoria,
          subcategoria: plan.subcategoria || undefined,
          valor: novoValor,
          tipo: plan.tipo,
          categoriaid: plan.categoriaid,
          subcategoriaid: plan.subcategoriaid || undefined,
        },
        userid
      );
      if (!atualizado) throw new Error('Erro ao atualizar planejamento existente');
      return atualizado;
    } else {
      return await PlanejamentoRepository.criar(dados, userid);
    }
  },

  async atualizar(
    id: number | string,
    dados: UpdatePlanejamentoDto,
    userid: number
  ): Promise<PlanejamentoEntity> {
    const planejamento = await PlanejamentoRepository.buscarPorId(id, userid);
    if (!planejamento) {
      throw new Error('Planejamento não encontrado');
    }

    const atualizado = await PlanejamentoRepository.atualizar(id, dados, userid);
    if (!atualizado) throw new Error('Erro ao atualizar planejamento');
    return atualizado;
  },

  async deletar(id: number | string, userid: number): Promise<void> {
    const planejamento = await PlanejamentoRepository.buscarPorId(id, userid);
    if (!planejamento) {
      throw new Error('Planejamento não encontrado');
    }

    await PlanejamentoRepository.deletar(id, userid);
  },

  async listarAgrupado(
    mes?: number | string,
    ano?: number | string,
    userid?: number
  ): Promise<AgrupamentoTipoPlanejamento[]> {
    const rows = await PlanejamentoRepository.buscar(
      mes,
      ano,
      null,
      null,
      null,
      null,
      userid
    );

    const resultado: AgrupamentoTipoPlanejamento[] = [];

    for (const row of rows) {
      let tipoObj = resultado.find((t) => t.tipo === row.tipo);
      if (!tipoObj) {
        tipoObj = {
          tipo: row.tipo,
          soma: 0,
          agrupamentoTipo: [],
        };
        resultado.push(tipoObj);
      }

      tipoObj.soma += Number(row.valor);

      let categoriaObj = tipoObj.agrupamentoTipo.find(
        (c) => c.categoria === row.categoria
      );

      if (!categoriaObj) {
        categoriaObj = {
          categoria: row.categoria,
          categoriaid: row.categoriaid,
          soma: 0,
          planejamento: [],
        };
        tipoObj.agrupamentoTipo.push(categoriaObj);
      }

      categoriaObj.soma += Number(row.valor);
      categoriaObj.planejamento.push(row);
    }

    return resultado;
  },

  async listar(
    mes?: number | string,
    ano?: number | string,
    userid?: number
  ): Promise<PlanejamentoEntity[]> {
    return await PlanejamentoRepository.buscar(
      mes,
      ano,
      null,
      null,
      null,
      null,
      userid
    );
  },

  async buscar(id: number | string, userid: number): Promise<PlanejamentoEntity> {
    const planejamento = await PlanejamentoRepository.buscarPorId(id, userid);
    if (!planejamento) {
      throw new Error('Planejamento não encontrado');
    }
    return planejamento;
  },
};

