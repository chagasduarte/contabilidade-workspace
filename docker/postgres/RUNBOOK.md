# Runbook: migrations 002–007 e scripts manuais

Responsável: Lastro (DBA). Aprovado pelo usuário em 2026-10-26: itens (a) migration 005, (b) backfill de parcelas, (c) DROP de índices redundantes, (d) normalização RECEITA/DESPESA e migration 006 com o backfill de `loans`, (e) VALIDATE.

> **Escopo: só o banco LOCAL** (`docker compose up -d postgres`). Nada deste runbook roda contra produção sem uma nova autorização explícita.
> Todos os comandos rodam a partir da raiz do repositório.

Atalho usado abaixo:

```sh
PSQL='docker compose exec -T postgres sh -c "psql -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\""'
# uso: eval "$PSQL" < arquivo.sql
```

Os scripts manuais terminam em `ROLLBACK;`. Na primeira execução, **rode como está** e confira as contagens. Para valer, rode de novo trocando `ROLLBACK;` por `COMMIT;`:

```sh
sed 's/^ROLLBACK; -- trocar por COMMIT.*/COMMIT;/' docker/postgres/manual/<script>.sql | eval "$PSQL"
```

---

## 0. Pré-requisitos

- `docker compose up -d postgres` está de pé e `docker compose ps` mostra o serviço `healthy`.
- A API rodando é a versão com a **correção P1**, em que o settlement grava `entrada`/`saida`. Sem ela, o CHECK estrito do passo 3.3 rejeita os próximos settlements.
- Nenhuma outra sessão está escrevendo no banco local durante os passos 3 a 5.

## 1. Backup

```sh
mkdir -p backups
docker compose exec -T postgres sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > backups/contabilidade_$(date +%Y%m%d_%H%M).dump
ls -lh backups/   # o arquivo não pode estar vazio
docker compose exec -T postgres pg_restore --list < backups/<arquivo>.dump | head   # o dump precisa ser legível
```

Rollback total, se algo der errado:

```sh
docker compose exec -T postgres sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backups/<arquivo>.dump
```

## 2. Migrations (001–009, não destrutivas e idempotentes)

```sh
sh docker/postgres/migrate.sh
```

Depois, confira:

```sql
SELECT version, applied_at FROM schema_migrations ORDER BY version;
-- esperado: 002 ... 009
```

Leia os `NOTICE` da saída. Um `... NÃO criado` indica duplicados que impediram um UNIQUE (`invoice_items`, `loan_installments`, `uq_transacoes_source`, categorias ou usuários). Anote e trate antes do passo 5. Rodar a migration de novo depois da limpeza cria o índice.

## 3. Backfills (alteram dados)

Ordem: primeiro rode cada um com ROLLBACK e confira o resultado; depois rode com COMMIT.

| # | Script | Conferir antes do COMMIT |
|---|---|---|
| 3.1 | `manual/backfill_parcelas.sql` | `linhas_com_grupo` e `grupos` fazem sentido. **Limitação:** a mesma descrição no mesmo cartão vira um grupo só. |
| 3.2 | `manual/backfill_loans_usuario.sql` | `sem_dono = 0` e `orfaos = 0`. Se não der, **não** dê COMMIT. |
| 3.3 | `manual/normalizar_tipo_transacoes.sql` | O segundo `GROUP BY tipo` mostra só `entrada`, `saida` e `cartao`. |

`manual/sync_cartoes_legado.sql` e `manual/backfill_idsubcategoria.sql` (fase 3 do campo categoria) **não** estão entre os itens aprovados. Só rode cada um com uma autorização específica.

## 4. Diagnóstico (somente leitura)

```sh
sed -n '/^-- DIAGNÓSTICO/,/^-- VALIDATE/p' docker/postgres/manual/validar_constraints.sql | eval "$PSQL"
```

Toda linha precisa dar `qtd = 0`.
- Se alguma constraint tiver qtd diferente de 0, **não** rode o VALIDATE dela. Corrigir esses dados é outra mudança e precisa de aprovação.
- As duas contagens de padrão de parcela (`parcelas_fora_do_padrao` e `like_sem_hifen`) são só informativas.

## 5. VALIDATE (verifica as linhas antigas sem bloquear leitura ou escrita)

```sh
sed -n 's/^-- \(ALTER TABLE .*VALIDATE CONSTRAINT.*\)/\1/p' docker/postgres/manual/validar_constraints.sql | eval "$PSQL"
```

```sql
SELECT conrelid::regclass, conname FROM pg_constraint
WHERE conname ~ '^(fk|ck)_' AND NOT convalidated;   -- esperado: 0 linhas
```

## 6. EXPLAIN (ANALYZE, BUFFERS)

```sql
-- escolha o usuário com mais transações e um mês com dados
SELECT userid, COUNT(*) FROM transacoes GROUP BY 1 ORDER BY 2 DESC LIMIT 5;
```

```sh
docker compose exec -T postgres sh -c \
  'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v uid=<userid> -v ano=<ano> -v mes=<mes>' \
  < docker/postgres/manual/explain_queries.sql > backups/explain_$(date +%Y%m%d_%H%M).txt
grep -E "^===|Scan|Execution Time" backups/explain_*.txt
```

Critérios:
- Nenhuma query principal faz `Seq Scan on transacoes` se a tabela tiver mais de ~10 mil linhas.
- As queries do mês ficam abaixo de ~10 ms.

## 7. DROP dos índices redundantes (só se o EXPLAIN confirmar)

Script: `manual/remover_indices_redundantes.sql`, que usa `DROP INDEX CONCURRENTLY` e por isso deve rodar fora de transação.

**Regra:**
- Um índice só cai se **não aparecer em nenhum plano** do passo 6.
- `idx_scan = 0` em `pg_stat_user_indexes` **não basta**: num banco local sem tráfego, todo índice tem 0.
- Quem aparecer no EXPLAIN fica, e a linha dele no script é comentada.

| Índice | Substituto | Situação na simulação (PGlite, 200k linhas) |
|---|---|---|
| `idx_transacoes_userid_data` | `idx_transacoes_userid_data_id` | **USADO** pela Q1 e por `getSaldoAtual` (o planner prefere o índice menor). Pela regra, **fica**; a linha já vem comentada no script. |
| `idx_transacoes_source` | `uq_transacoes_source` (se criado na 003) | Não apareceu. Só cai se `uq_transacoes_source` existir. |
| `idx_transacoes_status` | índices parciais por status | Não apareceu. |
| `idx_planned_tx_status` | `idx_planned_tx_userid_pending_date` | Não apareceu. |

Comente no script as linhas dos índices que vão ficar e rode:

```sh
eval "$PSQL" < docker/postgres/manual/remover_indices_redundantes.sql
```

## 8. Encerramento

- Guarde em `backups/` o dump e o arquivo de EXPLAIN. Não commitar: o dump contém dados.
- Reporte ao Maestro: saída do passo 2 (NOTICEs), contagens do passo 3, diagnóstico, EXPLAIN e índices removidos ou mantidos.
- Depois que a 007 rodar, o BackEnd pode remover `UserRepository.ensureTableExists`.

---

### Simulação já feita (sem Docker)

Em 2026-10-26, todos os passos 2 a 7 rodaram com o **psql real** contra PGlite (PG 17.5 em WASM) exposto por socket. O ponto de partida foi um banco "legado": `init.sql` do HEAD com 200 mil transações, 30 linhas RECEITA/DESPESA e loans com UUID "fake".

Resultados:
- migrations 002–007 aplicadas nas duas passadas;
- backfill de parcelas: 53.333 linhas em 320 grupos;
- loans: `sem_dono = 0`, `orfaos = 0`;
- tipos normalizados;
- diagnóstico com tudo 0;
- 21/21 constraints validadas;
- EXPLAIN de todas as queries abaixo de 2,5 ms, usando os índices esperados.

O passo 1 (`pg_dump`) não foi simulado. Ainda falta repetir tudo no Postgres 16 do Docker local.
