import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pool } from '../../core/config/database';
import { UserRepository } from './user.repository';

vi.mock('../../core/config/database', () => ({
  pool: { query: vi.fn() },
}));

describe('UserRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
  });

  it('não executa DDL em runtime (tabela e índices únicos vêm de init.sql + migrations 001/007)', async () => {
    await UserRepository.buscaPorNome('ana');
    await UserRepository.buscaPorEmail('ana@x.com');
    await UserRepository.buscaPorNomeOuEmail('ana');
    await UserRepository.buscaPorId(1);
    await UserRepository.buscaAvatar(1);

    const sqls = vi.mocked(pool.query).mock.calls.map(([sql]) => String(sql));
    expect(sqls).toHaveLength(5);
    expect(sqls.some((q) => /CREATE\s+(TABLE|UNIQUE|INDEX)|ALTER\s+TABLE/i.test(q))).toBe(false);
  });
});
