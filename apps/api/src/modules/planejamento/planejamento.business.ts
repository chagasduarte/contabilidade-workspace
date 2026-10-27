import { PlanejamentoRepository } from './planejamento.repository';
import { CategoriaRepository } from '../categoria/categoria.repository';
import { SubcategoriaRepository } from '../subcategoria/subcategoria.repository';
import {
  PlanejamentoEntity,
  PlanejamentoGravacao,
  CreatePlanejamentoDto,
  UpdatePlanejamentoDto,
  AgrupamentoTipoPlanejamento,
  ResumoPlanejamento,
  TipoPlanejamento,
  PlanejamentoNotFoundError,
  PlanejamentoValidationError,
} from './planejamento.types';

const TIPOS: TipoPlanejamento[] = ['despesa', 'receita'];
const idValido = (id: unknown): boolean => /^\d+$/.test(String(id ?? ''));
const arred = (n: number): number => Math.round(n * 100) / 100;

function dataValida(valor: unknown): string {
  const s = String(valor ?? '').trim().split('T')[0];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  if (!m || !d || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
    throw new PlanejamentoValidationError('data deve ser uma data válida no formato YYYY-MM-DD.');
  }
  return s;
}

/** mes/ano de query string: ausentes -> null; presentes precisam ser válidos. */
function mesAno(mes: unknown, ano: unknown): { mes: number | null; ano: number | null } {
  const m = mes === undefined || mes === null || mes === '' ? null : Number(mes);
  const a = ano === undefined || ano === null || ano === '' ? null : Number(ano);
  if (m !== null && (!Number.isInteger(m) || m < 1 || m > 12)) throw new PlanejamentoValidationError('Mês inválido.');
  if (a !== null && (!Number.isInteger(a) || a < 1900 || a > 9999)) throw new PlanejamentoValidationError('Ano inválido.');
  return { mes: m, ano: a };
}

/**
 * Valida categoria (visível ao usuário), subcategoria (da categoria), tipo e valor, e resolve os
 * nomes a partir do banco: o cliente não define mais os textos `categoria`/`subcategoria`.
 */
async function montarGravacao(
  dados: { categoriaid?: unknown; subcategoriaid?: unknown; valor?: unknown; tipo?: unknown },
  userid: number
): Promise<Omit<PlanejamentoGravacao, 'data'>> {
  if (!idValido(dados.categoriaid)) throw new PlanejamentoValidationError('categoriaid é obrigatório.');
  const categoria = await CategoriaRepository.buscar(Number(dados.categoriaid), userid);
  if (!categoria) throw new PlanejamentoValidationError('Categoria não encontrada.');

  let subcategoria: { id: number; nome: string } | null = null;
  if (dados.subcategoriaid !== undefined && dados.subcategoriaid !== null && dados.subcategoriaid !== '') {
    const sub = idValido(dados.subcategoriaid)
      ? await SubcategoriaRepository.buscar(Number(dados.subcategoriaid), userid)
      : undefined;
    if (!sub || Number(sub.idcategoria) !== Number(categoria.id)) {
      throw new PlanejamentoValidationError('Subcategoria não encontrada.');
    }
    subcategoria = { id: Number(sub.id), nome: sub.nome };
  }

  const tipo = (dados.tipo ?? categoria.tipo ?? 'despesa') as TipoPlanejamento;
  if (!TIPOS.includes(tipo)) throw new PlanejamentoValidationError("tipo deve ser 'despesa' ou 'receita'.");

  const valor = typeof dados.valor === 'string' && dados.valor.trim() !== '' ? Number(dados.valor) : dados.valor;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    throw new PlanejamentoValidationError('valor deve ser um número maior que zero.');
  }

  return {
    categoria: categoria.nome,
    subcategoria: subcategoria?.nome ?? null,
    valor: arred(valor),
    tipo,
    categoriaid: Number(categoria.id),
    subcategoriaid: subcategoria?.id ?? null,
  };
}

export const PlanejamentoBusiness = {
  /**
   * Cria o planejamento do mês. Se já existe um do mesmo mês/tipo/categoria/subcategoria,
   * soma o valor nele em vez de duplicar (comportamento mantido).
   */
  async criar(dados: CreatePlanejamentoDto, userid: number): Promise<PlanejamentoEntity> {
    const gravacao: PlanejamentoGravacao = {
      ...(await montarGravacao(dados ?? {}, userid)),
      data: dataValida(dados?.data),
    };

    const existente = await PlanejamentoRepository.buscarMesmoGrupo(gravacao, userid);
    if (existente) {
      const atualizado = await PlanejamentoRepository.atualizar(
        existente.id,
        { ...gravacao, valor: arred(existente.valor + gravacao.valor) },
        userid
      );
      if (!atualizado) throw new PlanejamentoNotFoundError();
      return atualizado;
    }
    return await PlanejamentoRepository.criar(gravacao, userid);
  },

  /** Atualização parcial: campos ausentes mantêm o valor atual (o mês não muda). */
  async atualizar(id: number | string, dados: UpdatePlanejamentoDto, userid: number): Promise<PlanejamentoEntity> {
    const atual = idValido(id) ? await PlanejamentoRepository.buscarPorId(id, userid) : undefined;
    if (!atual) throw new PlanejamentoNotFoundError();

    const trocouCategoria = dados?.categoriaid !== undefined && Number(dados.categoriaid) !== atual.categoriaid;
    const gravacao = await montarGravacao(
      {
        categoriaid: dados?.categoriaid ?? atual.categoriaid,
        // Trocar a categoria sem informar subcategoria descarta a anterior (pertencia à outra categoria)
        subcategoriaid:
          dados?.subcategoriaid !== undefined ? dados.subcategoriaid : trocouCategoria ? null : atual.subcategoriaid,
        valor: dados?.valor ?? atual.valor,
        tipo: dados?.tipo ?? atual.tipo,
      },
      userid
    );

    const atualizado = await PlanejamentoRepository.atualizar(id, gravacao, userid);
    if (!atualizado) throw new PlanejamentoNotFoundError();
    return atualizado;
  },

  async deletar(id: number | string, userid: number): Promise<void> {
    if (!idValido(id) || !(await PlanejamentoRepository.deletar(id, userid))) {
      throw new PlanejamentoNotFoundError();
    }
  },

  async listar(mes: unknown, ano: unknown, userid: number): Promise<PlanejamentoEntity[]> {
    const filtro = mesAno(mes, ano);
    return await PlanejamentoRepository.listar(userid, filtro.mes, filtro.ano);
  },

  async listarAgrupado(mes: unknown, ano: unknown, userid: number): Promise<AgrupamentoTipoPlanejamento[]> {
    const rows = await this.listar(mes, ano, userid);
    const resultado: AgrupamentoTipoPlanejamento[] = [];

    for (const row of rows) {
      let tipoObj = resultado.find((t) => t.tipo === row.tipo);
      if (!tipoObj) {
        tipoObj = { tipo: row.tipo, soma: 0, agrupamentoTipo: [] };
        resultado.push(tipoObj);
      }
      tipoObj.soma = arred(tipoObj.soma + row.valor);

      let categoriaObj = tipoObj.agrupamentoTipo.find((c) => c.categoriaid === row.categoriaid);
      if (!categoriaObj) {
        categoriaObj = { categoria: row.categoria, categoriaid: row.categoriaid, soma: 0, planejamento: [] };
        tipoObj.agrupamentoTipo.push(categoriaObj);
      }
      categoriaObj.soma = arred(categoriaObj.soma + row.valor);
      categoriaObj.planejamento.push(row);
    }

    return resultado;
  },

  async buscar(id: number | string, userid: number): Promise<PlanejamentoEntity> {
    const planejamento = idValido(id) ? await PlanejamentoRepository.buscarPorId(id, userid) : undefined;
    if (!planejamento) throw new PlanejamentoNotFoundError();
    return planejamento;
  },

  /** Planejado x realizado por categoria no mês (padrão: mês corrente, tipo despesa). */
  async resumo(mes: unknown, ano: unknown, tipo: unknown, userid: number): Promise<ResumoPlanejamento> {
    const filtro = mesAno(mes, ano);
    const tipoFiltro = (tipo === undefined || tipo === null || tipo === '' ? 'despesa' : tipo) as TipoPlanejamento;
    if (!TIPOS.includes(tipoFiltro)) throw new PlanejamentoValidationError("tipo deve ser 'despesa' ou 'receita'.");

    const hoje = new Date();
    const m = filtro.mes ?? hoje.getMonth() + 1;
    const a = filtro.ano ?? hoje.getFullYear();

    const categorias = await PlanejamentoRepository.resumoMes(userid, m, a, tipoFiltro);
    const totais = categorias.reduce(
      (acc, c) => ({
        planejado: arred(acc.planejado + c.planejado),
        realizado_pago: arred(acc.realizado_pago + c.realizado_pago),
        realizado_pendente: arred(acc.realizado_pendente + c.realizado_pendente),
      }),
      { planejado: 0, realizado_pago: 0, realizado_pendente: 0 }
    );

    return { mes: m, ano: a, tipo: tipoFiltro, totais, categorias };
  },
};
