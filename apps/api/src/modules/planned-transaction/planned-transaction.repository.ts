// planned-transaction.repository.ts
// Camada de persistência para Planned Transactions com queries parametrizadas em PostgreSQL

import { PoolClient } from 'pg';
import { pool } from '../../core/config/database';
import {
  PlannedTransactionEntity,
  mapPlannedTransactionEntity,
} from './planned-transaction.entity';
import {
  CreatePlannedTransactionDto,
  PlannedTransactionFilterDto,
  UpdatePlannedTransactionDto,
} from './planned-transaction.dto';

let tableVerified = false;

export const PlannedTransactionRepository = {
  /**
   * Garante idempotentemente que a tabela e índices existam no banco de dados.
   */
  async ensureTableExists(client?: PoolClient): Promise<void> {
    if (tableVerified) return;
    const runner = client ?? pool;
    try {
      await runner.query(`
        CREATE TABLE IF NOT EXISTS planned_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          userid INTEGER NOT NULL,
          descricao VARCHAR(255) NOT NULL,
          tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
          valor NUMERIC(12, 2) NOT NULL,
          data_prevista DATE NOT NULL,
          idcategoria INTEGER NULL,
          recorrencia VARCHAR(20) NOT NULL DEFAULT 'NONE' CHECK (recorrencia IN ('NONE', 'MENSAL', 'SEMANAL', 'ANUAL')),
          data_limite_recorrencia DATE NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SETTLED', 'SKIPPED', 'CANCELLED')),
          parent_recurrence_id UUID NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp()
        );

        ALTER TABLE planned_transactions ADD COLUMN IF NOT EXISTS parent_recurrence_id UUID NULL;

        CREATE INDEX IF NOT EXISTS idx_planned_tx_userid_date 
          ON planned_transactions(userid, data_prevista);
        CREATE INDEX IF NOT EXISTS idx_planned_tx_status 
          ON planned_transactions(status);
        CREATE INDEX IF NOT EXISTS idx_planned_tx_parent_rec 
          ON planned_transactions(parent_recurrence_id);
      `);
      tableVerified = true;
    } catch (error) {
      console.warn('[PlannedTransactionRepository] Falha ao verificar/criar tabela:', error);
    }
  },

  /**
   * Cadastra uma nova transação planejada vinculada obrigatoriamente ao userid.
   */
  async criar(
    dto: CreatePlannedTransactionDto,
    userid: number,
    client?: PoolClient
  ): Promise<PlannedTransactionEntity> {
    await this.ensureTableExists(client);
    const runner = client ?? pool;

    const query = `
      INSERT INTO planned_transactions (
        userid,
        descricao,
        tipo,
        valor,
        data_prevista,
        idcategoria,
        recorrencia,
        data_limite_recorrencia,
        status,
        parent_recurrence_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      userid,
      dto.descricao.trim(),
      dto.tipo,
      Number(dto.valor),
      dto.data_prevista,
      dto.idcategoria ?? null,
      dto.recorrencia ?? 'NONE',
      dto.data_limite_recorrencia ?? null,
      dto.status ?? 'PENDING',
      dto.parent_recurrence_id ?? null,
    ];

    const result = await runner.query(query, values);
    const createdRow = result.rows[0];

    // Se possui categoria, enriquece com nome e ícone
    if (createdRow.idcategoria) {
      const catRes = await runner.query(
        'SELECT nome, icone FROM categoria WHERE id = $1',
        [createdRow.idcategoria]
      );
      if (catRes.rows.length > 0) {
        createdRow.categoria_nome = catRes.rows[0].nome;
        createdRow.categoria_icone = catRes.rows[0].icone;
      }
    }

    return mapPlannedTransactionEntity(createdRow);
  },

  /**
   * Lista transações planejadas aplicando filtros dinâmicos e sempre isolando por userid.
   */
  async listar(
    filtros: PlannedTransactionFilterDto,
    userid: number,
    client?: PoolClient
  ): Promise<PlannedTransactionEntity[]> {
    await this.ensureTableExists(client);
    const runner = client ?? pool;

    const conditions: string[] = ['pt.userid = $1'];
    const params: unknown[] = [userid];

    // Filtro por status (suporta único ou lista separada por vírgula)
    if (filtros.status) {
      const rawStatus = String(filtros.status).trim();
      if (rawStatus.includes(',')) {
        const statusList = rawStatus.split(',').map((s) => s.trim().toUpperCase());
        params.push(statusList);
        conditions.push(`pt.status = ANY($${params.length})`);
      } else {
        params.push(rawStatus.toUpperCase());
        conditions.push(`pt.status = $${params.length}`);
      }
    }

    // Filtro por tipo (RECEITA / DESPESA)
    if (filtros.tipo) {
      params.push(String(filtros.tipo).trim().toUpperCase());
      conditions.push(`pt.tipo = $${params.length}`);
    }

    // Intervalo de datas (dataInicio e dataFim)
    const dataInicio = filtros.dataInicio || filtros.data_inicio;
    if (dataInicio) {
      params.push(dataInicio);
      conditions.push(`pt.data_prevista >= $${params.length}`);
    }

    const dataFim = filtros.dataFim || filtros.data_fim;
    if (dataFim) {
      params.push(dataFim);
      conditions.push(`pt.data_prevista <= $${params.length}`);
    }

    // Filtro por categoria
    if (filtros.idcategoria !== undefined && filtros.idcategoria !== null && filtros.idcategoria !== '') {
      params.push(Number(filtros.idcategoria));
      conditions.push(`pt.idcategoria = $${params.length}`);
    }

    const query = `
      SELECT 
        pt.*,
        c.nome AS categoria_nome,
        c.icone AS categoria_icone
      FROM planned_transactions pt
      LEFT JOIN categoria c ON c.id = pt.idcategoria
      WHERE ${conditions.join(' AND ')}
      ORDER BY pt.data_prevista ASC, pt.created_at ASC
    `;

    const result = await runner.query(query, params);
    return result.rows.map(mapPlannedTransactionEntity);
  },

  /**
   * Busca uma transação planejada por ID e valida propriedade pelo userid autenticado.
   */
  async buscarPorId(
    id: string,
    userid: number,
    client?: PoolClient
  ): Promise<PlannedTransactionEntity | null> {
    await this.ensureTableExists(client);
    const runner = client ?? pool;

    const query = `
      SELECT 
        pt.*,
        c.nome AS categoria_nome,
        c.icone AS categoria_icone
      FROM planned_transactions pt
      LEFT JOIN categoria c ON c.id = pt.idcategoria
      WHERE pt.id = $1 AND pt.userid = $2
      LIMIT 1
    `;

    const result = await runner.query(query, [id, userid]);
    if (result.rows.length === 0) {
      return null;
    }
    return mapPlannedTransactionEntity(result.rows[0]);
  },

  /**
   * Atualização parcial dos campos da transação planejada.
   */
  async atualizar(
    id: string,
    dto: UpdatePlannedTransactionDto,
    userid: number,
    client?: PoolClient
  ): Promise<PlannedTransactionEntity | null> {
    await this.ensureTableExists(client);
    const runner = client ?? pool;

    const setClauses: string[] = ['updated_at = clock_timestamp()'];
    const params: unknown[] = [id, userid];

    if (dto.descricao !== undefined) {
      params.push(dto.descricao.trim());
      setClauses.push(`descricao = $${params.length}`);
    }

    if (dto.tipo !== undefined) {
      params.push(dto.tipo);
      setClauses.push(`tipo = $${params.length}`);
    }

    if (dto.valor !== undefined) {
      params.push(Number(dto.valor));
      setClauses.push(`valor = $${params.length}`);
    }

    if (dto.data_prevista !== undefined) {
      params.push(dto.data_prevista);
      setClauses.push(`data_prevista = $${params.length}`);
    }

    if (dto.idcategoria !== undefined) {
      params.push(dto.idcategoria);
      setClauses.push(`idcategoria = $${params.length}`);
    }

    if (dto.recorrencia !== undefined) {
      params.push(dto.recorrencia);
      setClauses.push(`recorrencia = $${params.length}`);
    }

    if (dto.data_limite_recorrencia !== undefined) {
      params.push(dto.data_limite_recorrencia);
      setClauses.push(`data_limite_recorrencia = $${params.length}`);
    }

    if (dto.status !== undefined) {
      params.push(dto.status);
      setClauses.push(`status = $${params.length}`);
    }

    const query = `
      UPDATE planned_transactions
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND userid = $2
      RETURNING *
    `;

    const result = await runner.query(query, params);
    if (result.rows.length === 0) {
      return null;
    }

    const updatedRow = result.rows[0];
    if (updatedRow.idcategoria) {
      const catRes = await runner.query(
        'SELECT nome, icone FROM categoria WHERE id = $1',
        [updatedRow.idcategoria]
      );
      if (catRes.rows.length > 0) {
        updatedRow.categoria_nome = catRes.rows[0].nome;
        updatedRow.categoria_icone = catRes.rows[0].icone;
      }
    }

    return mapPlannedTransactionEntity(updatedRow);
  },

  /**
   * Busca todas as regras mestres ativas do usuário para recorrência mensal.
   * Regra mestre: recorrencia = 'MENSAL', parent_recurrence_id IS NULL, status != 'CANCELLED'.
   */
  async buscarMestresAtivos(
    userid: number,
    client?: PoolClient
  ): Promise<PlannedTransactionEntity[]> {
    await this.ensureTableExists(client);
    const runner = client ?? pool;

    const query = `
      SELECT 
        pt.*,
        c.nome AS categoria_nome,
        c.icone AS categoria_icone
      FROM planned_transactions pt
      LEFT JOIN categoria c ON c.id = pt.idcategoria
      WHERE pt.userid = $1
        AND pt.recorrencia = 'MENSAL'
        AND pt.parent_recurrence_id IS NULL
        AND pt.status != 'CANCELLED'
        AND (pt.data_limite_recorrencia IS NULL OR pt.data_limite_recorrencia >= CURRENT_DATE)
      ORDER BY pt.data_prevista ASC
    `;

    const result = await runner.query(query, [userid]);
    return result.rows.map(mapPlannedTransactionEntity);
  },

  /**
   * Verifica se já existe uma ocorrência (seja o mestre ou filha) para a regra no mês/ano informados.
   */
  async existeOcorrenciaNoMesAno(
    masterId: string,
    mes: number,
    ano: number,
    client?: PoolClient
  ): Promise<boolean> {
    await this.ensureTableExists(client);
    const runner = client ?? pool;

    const query = `
      SELECT 1 FROM planned_transactions
      WHERE (id = $1::uuid OR parent_recurrence_id = $1::uuid)
        AND EXTRACT(MONTH FROM data_prevista) = $2
        AND EXTRACT(YEAR FROM data_prevista) = $3
        AND status != 'CANCELLED'
      LIMIT 1
    `;

    const result = await runner.query(query, [masterId, mes, ano]);
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Atualização em massa de ocorrências pendentes futuras vinculadas ao mesmo mestre.
   * Atualiza a ocorrência atual e todas as ocorrências pendentes futuras onde data_prevista >= dataCorte.
   * Também atualiza o registro mestre se aplicável para que novas ocorrências geradas herdem as alterações.
   */
  async atualizarEmMassaFuturas(
    masterId: string,
    dataCorte: string | Date,
    dto: UpdatePlannedTransactionDto,
    userid: number,
    client?: PoolClient
  ): Promise<number> {
    await this.ensureTableExists(client);
    const runner = client ?? pool;

    const setClauses: string[] = ['updated_at = clock_timestamp()'];
    const params: unknown[] = [masterId, userid, dataCorte];

    if (dto.descricao !== undefined) {
      params.push(dto.descricao.trim());
      setClauses.push(`descricao = $${params.length}`);
    }

    if (dto.tipo !== undefined) {
      params.push(dto.tipo);
      setClauses.push(`tipo = $${params.length}`);
    }

    if (dto.valor !== undefined) {
      params.push(Number(dto.valor));
      setClauses.push(`valor = $${params.length}`);
    }

    if (dto.idcategoria !== undefined) {
      params.push(dto.idcategoria);
      setClauses.push(`idcategoria = $${params.length}`);
    }

    if (dto.data_limite_recorrencia !== undefined) {
      params.push(dto.data_limite_recorrencia);
      setClauses.push(`data_limite_recorrencia = $${params.length}`);
    }

    // 1. Atualiza registros pendentes com data_prevista >= dataCorte
    const updateInstancesQuery = `
      UPDATE planned_transactions
      SET ${setClauses.join(', ')}
      WHERE (id = $1::uuid OR parent_recurrence_id = $1::uuid)
        AND userid = $2
        AND data_prevista >= $3::date
        AND status = 'PENDING'
    `;

    const resInstances = await runner.query(updateInstancesQuery, params);

    // 2. Atualiza os dados de template do registro mestre
    const masterClauses: string[] = ['updated_at = clock_timestamp()'];
    const masterParams: unknown[] = [masterId, userid];

    if (dto.descricao !== undefined) {
      masterParams.push(dto.descricao.trim());
      masterClauses.push(`descricao = $${masterParams.length}`);
    }
    if (dto.tipo !== undefined) {
      masterParams.push(dto.tipo);
      masterClauses.push(`tipo = $${masterParams.length}`);
    }
    if (dto.valor !== undefined) {
      masterParams.push(Number(dto.valor));
      masterClauses.push(`valor = $${masterParams.length}`);
    }
    if (dto.idcategoria !== undefined) {
      masterParams.push(dto.idcategoria);
      masterClauses.push(`idcategoria = $${masterParams.length}`);
    }
    if (dto.data_limite_recorrencia !== undefined) {
      masterParams.push(dto.data_limite_recorrencia);
      masterClauses.push(`data_limite_recorrencia = $${masterParams.length}`);
    }

    if (masterClauses.length > 1) {
      await runner.query(
        `UPDATE planned_transactions
         SET ${masterClauses.join(', ')}
         WHERE id = $1::uuid AND userid = $2`,
        masterParams
      );
    }

    return resInstances.rowCount ?? 0;
  },

  /**
   * Exclusão física definitiva do registro filtrado estritamente por id e userid.
   */
  async deletar(
    id: string,
    userid: number,
    client?: PoolClient
  ): Promise<boolean> {
    await this.ensureTableExists(client);
    const runner = client ?? pool;

    const result = await runner.query(
      'DELETE FROM planned_transactions WHERE id = $1 AND userid = $2',
      [id, userid]
    );

    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Exclusão lógica (soft-delete): altera o status para 'CANCELLED'.
   */
  async cancelar(
    id: string,
    userid: number,
    client?: PoolClient
  ): Promise<PlannedTransactionEntity | null> {
    return this.atualizar(
      id,
      { status: 'CANCELLED' },
      userid,
      client
    );
  },
};

