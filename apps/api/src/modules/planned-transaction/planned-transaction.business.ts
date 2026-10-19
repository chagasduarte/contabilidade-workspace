import { PoolClient } from 'pg';
import { pool } from '../../core/config/database';
import {
  CreatePlannedTransactionDto,
  formatPlannedTransactionResponse,
  PlannedTransactionFilterDto,
  PlannedTransactionResponseDto,
  UpdatePlannedTransactionDto,
} from './planned-transaction.dto';
import {
  PlannedTransactionRecurrence,
  PlannedTransactionStatus,
  PlannedTransactionType,
} from './planned-transaction.entity';
import { PlannedTransactionRepository } from './planned-transaction.repository';
import { addMonthsPreservingDay, toIsoDateString } from './planned-transaction.utils';

export class PlannedTransactionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlannedTransactionValidationError';
  }
}

export class PlannedTransactionNotFoundError extends Error {
  constructor(message = 'Transação planejada não encontrada.') {
    super(message);
    this.name = 'PlannedTransactionNotFoundError';
  }
}

const TIPOS_VALIDOS: PlannedTransactionType[] = ['RECEITA', 'DESPESA'];
const RECORRENCIAS_VALIDAS: PlannedTransactionRecurrence[] = [
  'NONE',
  'MENSAL',
  'SEMANAL',
  'ANUAL',
];
const STATUS_VALIDOS: PlannedTransactionStatus[] = [
  'PENDING',
  'SETTLED',
  'SKIPPED',
  'CANCELLED',
];

/**
 * Validador de formato UUID v4 / PostgreSQL.
 */
function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

/**
 * Validador e normalizador de data.
 */
function isValidDateInput(dateInput: unknown): boolean {
  if (!dateInput) return false;
  if (dateInput instanceof Date) {
    return !isNaN(dateInput.getTime());
  }
  const str = String(dateInput).trim();
  const parsed = new Date(str);
  return !isNaN(parsed.getTime());
}

export const PlannedTransactionBusiness = {
  /**
   * Valida payload de criação de transação planejada.
   */
  validarCriacao(dto: CreatePlannedTransactionDto): void {
    if (!dto.descricao || typeof dto.descricao !== 'string' || dto.descricao.trim().length === 0) {
      throw new PlannedTransactionValidationError(
        'A descrição da transação planejada é obrigatória.'
      );
    }

    if (dto.descricao.trim().length > 255) {
      throw new PlannedTransactionValidationError(
        'A descrição não pode ultrapassar 255 caracteres.'
      );
    }

    const tipoUpper = (dto.tipo || '').toUpperCase() as PlannedTransactionType;
    if (!TIPOS_VALIDOS.includes(tipoUpper)) {
      throw new PlannedTransactionValidationError(
        `O tipo é obrigatório e deve ser 'RECEITA' ou 'DESPESA'. Recebido: '${dto.tipo}'`
      );
    }

    const valorNum = Number(dto.valor);
    if (isNaN(valorNum) || valorNum <= 0) {
      throw new PlannedTransactionValidationError(
        'O valor deve ser um número positivo maior que zero.'
      );
    }

    if (!dto.data_prevista || !isValidDateInput(dto.data_prevista)) {
      throw new PlannedTransactionValidationError(
        'A data prevista é obrigatória e deve conter uma data válida.'
      );
    }

    if (dto.recorrencia) {
      const recUpper = dto.recorrencia.toUpperCase() as PlannedTransactionRecurrence;
      if (!RECORRENCIAS_VALIDAS.includes(recUpper)) {
        throw new PlannedTransactionValidationError(
          `Recorrência inválida. Valores aceitos: ${RECORRENCIAS_VALIDAS.join(', ')}.`
        );
      }
    }

    if (dto.status) {
      const statusUpper = dto.status.toUpperCase() as PlannedTransactionStatus;
      if (!STATUS_VALIDOS.includes(statusUpper)) {
        throw new PlannedTransactionValidationError(
          `Status inválido. Valores aceitos: ${STATUS_VALIDOS.join(', ')}.`
        );
      }
    }

    if (dto.data_limite_recorrencia && !isValidDateInput(dto.data_limite_recorrencia)) {
      throw new PlannedTransactionValidationError(
        'A data limite da recorrência deve ser uma data válida.'
      );
    }
  },

  /**
   * Valida payload de atualização parcial.
   */
  validarAtualizacao(dto: UpdatePlannedTransactionDto): void {
    if (dto.descricao !== undefined) {
      if (typeof dto.descricao !== 'string' || dto.descricao.trim().length === 0) {
        throw new PlannedTransactionValidationError('A descrição não pode ser vazia.');
      }
      if (dto.descricao.trim().length > 255) {
        throw new PlannedTransactionValidationError(
          'A descrição não pode ultrapassar 255 caracteres.'
        );
      }
    }

    if (dto.tipo !== undefined) {
      const tipoUpper = (dto.tipo || '').toUpperCase() as PlannedTransactionType;
      if (!TIPOS_VALIDOS.includes(tipoUpper)) {
        throw new PlannedTransactionValidationError(
          `O tipo deve ser 'RECEITA' ou 'DESPESA'. Recebido: '${dto.tipo}'`
        );
      }
    }

    if (dto.valor !== undefined) {
      const valorNum = Number(dto.valor);
      if (isNaN(valorNum) || valorNum <= 0) {
        throw new PlannedTransactionValidationError(
          'O valor deve ser um número positivo maior que zero.'
        );
      }
    }

    if (dto.data_prevista !== undefined && !isValidDateInput(dto.data_prevista)) {
      throw new PlannedTransactionValidationError('A data prevista informada é inválida.');
    }

    if (dto.recorrencia !== undefined) {
      const recUpper = (dto.recorrencia || '').toUpperCase() as PlannedTransactionRecurrence;
      if (!RECORRENCIAS_VALIDAS.includes(recUpper)) {
        throw new PlannedTransactionValidationError(
          `Recorrência inválida. Valores aceitos: ${RECORRENCIAS_VALIDAS.join(', ')}.`
        );
      }
    }

    if (dto.status !== undefined) {
      const statusUpper = (dto.status || '').toUpperCase() as PlannedTransactionStatus;
      if (!STATUS_VALIDOS.includes(statusUpper)) {
        throw new PlannedTransactionValidationError(
          `Status inválido. Valores aceitos: ${STATUS_VALIDOS.join(', ')}.`
        );
      }
    }

    if (
      dto.data_limite_recorrencia !== undefined &&
      dto.data_limite_recorrencia !== null &&
      !isValidDateInput(dto.data_limite_recorrencia)
    ) {
      throw new PlannedTransactionValidationError(
        'A data limite da recorrência deve ser uma data válida.'
      );
    }
  },

  /**
   * Cria uma transação planejada validando regras de negócio e vinculando ao usuário autenticado.
   */
  async criar(
    dto: CreatePlannedTransactionDto,
    userid: number
  ): Promise<PlannedTransactionResponseDto> {
    if (!userid || isNaN(Number(userid))) {
      throw new PlannedTransactionValidationError('Identificação do usuário (userid) inválida.');
    }

    this.validarCriacao(dto);

    const dtoNormalizado: CreatePlannedTransactionDto = {
      descricao: dto.descricao.trim(),
      tipo: dto.tipo.toUpperCase() as PlannedTransactionType,
      valor: Number(dto.valor),
      data_prevista: dto.data_prevista,
      idcategoria:
        dto.idcategoria !== null && dto.idcategoria !== undefined && !isNaN(Number(dto.idcategoria))
          ? Number(dto.idcategoria)
          : null,
      recorrencia: (dto.recorrencia
        ? dto.recorrencia.toUpperCase()
        : 'NONE') as PlannedTransactionRecurrence,
      data_limite_recorrencia: dto.data_limite_recorrencia || null,
      status: (dto.status ? dto.status.toUpperCase() : 'PENDING') as PlannedTransactionStatus,
      parent_recurrence_id: dto.parent_recurrence_id ?? null,
    };

    // Criação com Recorrência Mensal: Materialização automática de 3 meses em transação de banco de dados
    if (dtoNormalizado.recorrencia === 'MENSAL') {
      let client: PoolClient | undefined;
      if (pool && typeof pool.connect === 'function') {
        try {
          client = await pool.connect();
        } catch {
          client = undefined;
        }
      }

      try {
        if (client) await client.query('BEGIN');
        const master = await PlannedTransactionRepository.criar(
          { ...dtoNormalizado, parent_recurrence_id: null },
          userid,
          client
        );

        const baseDate = master.data_prevista instanceof Date
          ? master.data_prevista
          : new Date(master.data_prevista);
        const originalDay = baseDate.getUTCDate();

        // Materializa ocorrências para os próximos 3 meses (offset 1, 2, 3)
        for (let i = 1; i <= 3; i++) {
          const targetDate = addMonthsPreservingDay(baseDate, i, originalDay);
          if (
            master.data_limite_recorrencia &&
            targetDate > new Date(master.data_limite_recorrencia)
          ) {
            break;
          }

          const targetDateStr = toIsoDateString(targetDate);
          await PlannedTransactionRepository.criar(
            {
              descricao: master.descricao,
              tipo: master.tipo,
              valor: master.valor,
              data_prevista: targetDateStr,
              idcategoria: master.idcategoria,
              recorrencia: 'MENSAL',
              data_limite_recorrencia: master.data_limite_recorrencia
                ? toIsoDateString(new Date(master.data_limite_recorrencia))
                : null,
              status: 'PENDING',
              parent_recurrence_id: master.id,
            },
            userid,
            client
          );
        }

        if (client) await client.query('COMMIT');
        return formatPlannedTransactionResponse(master);
      } catch (error) {
        if (client) await client.query('ROLLBACK');
        throw error;
      } finally {
        if (client) client.release();
      }
    }

    const entity = await PlannedTransactionRepository.criar(dtoNormalizado, userid);
    return formatPlannedTransactionResponse(entity);
  },

  /**
   * Mantém a janela deslizante de ocorrências para os próximos N meses (padrão = 3).
   * Busca todas as regras mestres ativas e provisiona instâncias faltantes com idempotência.
   */
  async ensureRollingWindow(
    userId: number,
    monthsAhead = 3,
    client?: PoolClient
  ): Promise<void> {
    if (!userId || isNaN(Number(userId))) return;

    const mestres = await PlannedTransactionRepository.buscarMestresAtivos(userId, client);
    if (!mestres || mestres.length === 0) return;

    const hoje = new Date();
    const anoHoje = hoje.getUTCFullYear();
    const mesHoje = hoje.getUTCMonth(); // 0..11

    for (const mestre of mestres) {
      const baseDate = mestre.data_prevista instanceof Date
        ? mestre.data_prevista
        : new Date(mestre.data_prevista);
      const originalDay = baseDate.getUTCDate();
      const mestreYear = baseDate.getUTCFullYear();
      const mestreMonth = baseDate.getUTCMonth();

      for (let i = 0; i <= monthsAhead; i++) {
        const targetMonthIndex = mesHoje + i;
        const targetYear = anoHoje + Math.floor(targetMonthIndex / 12);
        const targetMonth = ((targetMonthIndex % 12) + 12) % 12; // 0..11
        const targetMonth1Based = targetMonth + 1;

        // Não gera ocorrência para meses anteriores à data de início da regra mestre
        if (targetYear < mestreYear || (targetYear === mestreYear && targetMonth < mestreMonth)) {
          continue;
        }

        const jaExiste = await PlannedTransactionRepository.existeOcorrenciaNoMesAno(
          mestre.id,
          targetMonth1Based,
          targetYear,
          client
        );

        if (!jaExiste) {
          const totalMonthOffset = (targetYear - mestreYear) * 12 + (targetMonth - mestreMonth);
          const targetDate = addMonthsPreservingDay(baseDate, totalMonthOffset, originalDay);

          if (
            mestre.data_limite_recorrencia &&
            targetDate > new Date(mestre.data_limite_recorrencia)
          ) {
            continue;
          }

          const targetDateStr = toIsoDateString(targetDate);
          await PlannedTransactionRepository.criar(
            {
              descricao: mestre.descricao,
              tipo: mestre.tipo,
              valor: mestre.valor,
              data_prevista: targetDateStr,
              idcategoria: mestre.idcategoria,
              recorrencia: 'MENSAL',
              data_limite_recorrencia: mestre.data_limite_recorrencia
                ? toIsoDateString(new Date(mestre.data_limite_recorrencia))
                : null,
              status: 'PENDING',
              parent_recurrence_id: mestre.id,
            },
            userId,
            client
          );
        }
      }
    }
  },

  /**
   * Lista transações planejadas do usuário com suporte a filtros de status, tipo e intervalo de datas.
   */
  async listar(
    filtros: PlannedTransactionFilterDto,
    userid: number
  ): Promise<PlannedTransactionResponseDto[]> {
    if (!userid || isNaN(Number(userid))) {
      throw new PlannedTransactionValidationError('Identificação do usuário (userid) inválida.');
    }

    // Executa a manutenção da janela deslizante para garantir que previsões estejam atualizadas
    try {
      await this.ensureRollingWindow(userid, 3);
    } catch (err) {
      console.warn('[PlannedTransactionBusiness] Aviso ao executar ensureRollingWindow:', err);
    }

    const entities = await PlannedTransactionRepository.listar(filtros, userid);
    return entities.map(formatPlannedTransactionResponse);
  },

  /**
   * Busca transação planejada por ID garantindo pertencimento ao usuário.
   */
  async buscarPorId(id: string, userid: number): Promise<PlannedTransactionResponseDto> {
    if (!id || typeof id !== 'string' || !isUuid(id.trim())) {
      throw new PlannedTransactionValidationError('ID da transação planejada deve ser um UUID válido.');
    }

    if (!userid || isNaN(Number(userid))) {
      throw new PlannedTransactionValidationError('Identificação do usuário (userid) inválida.');
    }

    const entity = await PlannedTransactionRepository.buscarPorId(id.trim(), userid);
    if (!entity) {
      throw new PlannedTransactionNotFoundError();
    }

    return formatPlannedTransactionResponse(entity);
  },

  /**
   * Atualiza dados de uma transação planejada existente.
   * Suporta atualização pontual ('SINGLE') ou em massa de instâncias futuras ('ALL_FUTURE').
   */
  async atualizar(
    id: string,
    dto: UpdatePlannedTransactionDto,
    userid: number
  ): Promise<PlannedTransactionResponseDto> {
    if (!id || typeof id !== 'string' || !isUuid(id.trim())) {
      throw new PlannedTransactionValidationError('ID da transação planejada deve ser um UUID válido.');
    }

    if (!userid || isNaN(Number(userid))) {
      throw new PlannedTransactionValidationError('Identificação do usuário (userid) inválida.');
    }

    this.validarAtualizacao(dto);

    // Verifica existência prévia
    const existente = await PlannedTransactionRepository.buscarPorId(id.trim(), userid);
    if (!existente) {
      throw new PlannedTransactionNotFoundError();
    }

    const dtoNormalizado: UpdatePlannedTransactionDto = {};
    if (dto.descricao !== undefined) dtoNormalizado.descricao = dto.descricao.trim();
    if (dto.tipo !== undefined) dtoNormalizado.tipo = dto.tipo.toUpperCase() as PlannedTransactionType;
    if (dto.valor !== undefined) dtoNormalizado.valor = Number(dto.valor);
    if (dto.data_prevista !== undefined) dtoNormalizado.data_prevista = dto.data_prevista;
    if (dto.idcategoria !== undefined) {
      dtoNormalizado.idcategoria =
        dto.idcategoria !== null && !isNaN(Number(dto.idcategoria))
          ? Number(dto.idcategoria)
          : null;
    }
    if (dto.recorrencia !== undefined) {
      dtoNormalizado.recorrencia = dto.recorrencia.toUpperCase() as PlannedTransactionRecurrence;
    }
    if (dto.data_limite_recorrencia !== undefined) {
      dtoNormalizado.data_limite_recorrencia = dto.data_limite_recorrencia || null;
    }
    if (dto.status !== undefined) {
      dtoNormalizado.status = dto.status.toUpperCase() as PlannedTransactionStatus;
    }
    if (dto.updateMode !== undefined) {
      dtoNormalizado.updateMode = dto.updateMode;
    }

    // Modo ALL_FUTURE: atualiza a ocorrência atual e todas as ocorrências pendentes futuras do mesmo mestre
    if (dto.updateMode === 'ALL_FUTURE') {
      const masterId = existente.parent_recurrence_id || existente.id;
      await PlannedTransactionRepository.atualizarEmMassaFuturas(
        masterId,
        existente.data_prevista,
        dtoNormalizado,
        userid
      );
      const entityAtualizada = await PlannedTransactionRepository.buscarPorId(id.trim(), userid);
      return formatPlannedTransactionResponse(entityAtualizada ?? existente);
    }

    // Modo SINGLE (padrão): atualiza apenas este registro
    const entity = await PlannedTransactionRepository.atualizar(
      id.trim(),
      dtoNormalizado,
      userid
    );

    if (!entity) {
      throw new PlannedTransactionNotFoundError();
    }

    return formatPlannedTransactionResponse(entity);
  },

  /**
   * Remove uma transação planejada (física por padrão ou lógica se soft=true).
   */
  async deletar(
    id: string,
    userid: number,
    soft = false
  ): Promise<{ message: string; id: string; status?: string }> {
    if (!id || typeof id !== 'string' || !isUuid(id.trim())) {
      throw new PlannedTransactionValidationError('ID da transação planejada deve ser um UUID válido.');
    }

    if (!userid || isNaN(Number(userid))) {
      throw new PlannedTransactionValidationError('Identificação do usuário (userid) inválida.');
    }

    const existente = await PlannedTransactionRepository.buscarPorId(id.trim(), userid);
    if (!existente) {
      throw new PlannedTransactionNotFoundError();
    }

    if (soft) {
      const cancelado = await PlannedTransactionRepository.cancelar(id.trim(), userid);
      return {
        message: 'Transação planejada cancelada com sucesso.',
        id: id.trim(),
        status: cancelado?.status || 'CANCELLED',
      };
    }

    const sucesso = await PlannedTransactionRepository.deletar(id.trim(), userid);
    if (!sucesso) {
      throw new PlannedTransactionNotFoundError();
    }

    return {
      message: 'Transação planejada excluída com sucesso.',
      id: id.trim(),
    };
  },
};

