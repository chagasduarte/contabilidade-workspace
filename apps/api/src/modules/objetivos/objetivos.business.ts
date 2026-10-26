import { ObjetivosRepository } from './objetivos.repository';
import {
  ObjetivoEntity,
  ObjetivoResponse,
  CreateObjetivoDto,
  UpdateObjetivoDto,
  ObjetivoNotFoundError,
  ObjetivoValidationError,
} from './objetivos.types';

const idValido = (id: number | string): boolean => /^\d+$/.test(String(id));
const arred = (n: number): number => Math.round(n * 100) / 100;

/** Aceita número ou string numérica; rejeita vazio, NaN e infinito. */
function numero(valor: unknown, campo: string): number {
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new ObjetivoValidationError(`${campo} deve ser um número válido.`);
  }
  return n;
}

function dataValida(valor: unknown): string {
  const s = String(valor ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  // Rejeita datas inexistentes (ex.: 2026-02-30), que o Date "rolaria" para o mês seguinte
  if (!m || !d || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
    throw new ObjetivoValidationError('data_final deve ser uma data válida no formato YYYY-MM-DD.');
  }
  return s;
}

function texto(valor: unknown, campo: string, max: number): string {
  const s = typeof valor === 'string' ? valor.trim() : '';
  if (!s) throw new ObjetivoValidationError(`${campo} é obrigatório.`);
  if (s.length > max) throw new ObjetivoValidationError(`${campo} deve ter no máximo ${max} caracteres.`);
  return s;
}

/** Valida e normaliza os campos presentes; `parcial` permite omitir campos (PUT). */
function normalizar(dto: UpdateObjetivoDto, parcial: boolean): UpdateObjetivoDto {
  const out: UpdateObjetivoDto = {};
  const presente = (k: keyof UpdateObjetivoDto) => !parcial || dto[k] !== undefined;

  if (presente('nome')) out.nome = texto(dto.nome, 'nome', 255);
  if (presente('tipo')) out.tipo = texto(dto.tipo, 'tipo', 50);
  if (presente('valor_objetivo')) {
    out.valor_objetivo = numero(dto.valor_objetivo, 'valor_objetivo');
    if (out.valor_objetivo <= 0) throw new ObjetivoValidationError('valor_objetivo deve ser maior que zero.');
  }
  if (dto.valor_mensal !== undefined) {
    out.valor_mensal = numero(dto.valor_mensal, 'valor_mensal');
    if (out.valor_mensal < 0) throw new ObjetivoValidationError('valor_mensal não pode ser negativo.');
  }
  if (dto.valor_acumulado !== undefined) {
    out.valor_acumulado = numero(dto.valor_acumulado, 'valor_acumulado');
    if (out.valor_acumulado < 0) throw new ObjetivoValidationError('valor_acumulado não pode ser negativo.');
  }
  if (presente('data_final')) out.data_final = dataValida(dto.data_final);
  return out;
}

/** Progresso calculado a partir do acumulado e do prazo; `hoje` injetável para testes. */
export function calcularProgresso(obj: ObjetivoEntity, hoje: Date = new Date()): ObjetivoResponse {
  const [ano, mes, dia] = obj.data_final.split('-').map(Number);
  let meses = (ano - hoje.getUTCFullYear()) * 12 + (mes - (hoje.getUTCMonth() + 1));
  if (dia < hoje.getUTCDate()) meses -= 1;
  const meses_restantes = Math.max(meses, 0);

  const valor_restante = arred(Math.max(obj.valor_objetivo - obj.valor_acumulado, 0));
  return {
    ...obj,
    progresso_percentual: arred((obj.valor_acumulado / obj.valor_objetivo) * 100),
    valor_restante,
    meses_restantes,
    valor_mensal_necessario: meses_restantes > 0 ? arred(valor_restante / meses_restantes) : null,
  };
}

export const ObjetivosBusiness = {
  async criar(objetivo: CreateObjetivoDto, userid: number): Promise<ObjetivoResponse> {
    const dto = normalizar(objetivo ?? ({} as CreateObjetivoDto), false) as CreateObjetivoDto;
    return calcularProgresso(await ObjetivosRepository.criar(dto, userid));
  },

  async listar(userid: number): Promise<ObjetivoResponse[]> {
    const lista = await ObjetivosRepository.listar(userid);
    return lista.map((o) => calcularProgresso(o));
  },

  async buscar(objetivoid: number | string, userid: number): Promise<ObjetivoResponse> {
    const obj = idValido(objetivoid) ? await ObjetivosRepository.buscar(objetivoid, userid) : undefined;
    if (!obj) throw new ObjetivoNotFoundError();
    return calcularProgresso(obj);
  },

  async atualizar(
    objetivoid: number | string,
    dados: UpdateObjetivoDto,
    userid: number
  ): Promise<ObjetivoResponse> {
    if (!idValido(objetivoid)) throw new ObjetivoNotFoundError();
    const dto = normalizar(dados ?? {}, true);
    const atualizado = await ObjetivosRepository.atualizar(objetivoid, dto, userid);
    if (!atualizado) throw new ObjetivoNotFoundError();
    return calcularProgresso(atualizado);
  },

  async deletar(objetivoid: number | string, userid: number): Promise<void> {
    if (!idValido(objetivoid) || !(await ObjetivosRepository.deletar(objetivoid, userid))) {
      throw new ObjetivoNotFoundError();
    }
  },
};
