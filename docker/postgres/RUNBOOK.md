# Runbook: migrations 001–009, scripts manuais e deploy da nova API

Responsável: Lastro (DBA). Branch: `feat/revisao-seguranca-performance-telas`.

O que foi aprovado pelo usuário em 2026-10-26:
- (a) migration 005;
- (b) backfill de parcelas;
- (c) DROP de índices redundantes;
- (d) normalização RECEITA/DESPESA e migration 006 com o backfill de `loans`;
- (e) VALIDATE;
- `manual/sync_cartoes_legado.sql`.

`manual/backfill_idsubcategoria.sql` (fase 3 do campo categoria) **não** está aprovado e não faz parte deste runbook.

> **Execução:** primeiro o ensaio completo no banco **LOCAL** (`docker compose up -d postgres`), seguindo exatamente a ordem da seção B.
> **Produção** só roda com autorização explícita do Maestro no momento da janela. Este documento descreve a ordem; ele não autoriza executar.
> Todos os comandos rodam a partir da raiz do repositório.

## A. Atalhos

```sh
# LOCAL (docker compose)
PSQL='docker compose exec -T postgres sh -c "psql -X -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\""'

# PRODUÇÃO (DATABASE_URL da produção; cliente psql/pg_dump >= versão do servidor)
PSQL='psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1'

# uso: eval "$PSQL" < arquivo.sql
```

Os scripts manuais terminam em `ROLLBACK;`. **Sempre** rode primeiro como estão e confira as contagens. Para valer, rode de novo com COMMIT:

```sh
sed 's/^ROLLBACK; -- trocar por COMMIT.*/COMMIT;/' docker/postgres/manual/<script>.sql | eval "$PSQL"
```

---

## B. Ordem final de deploy (produção; o ensaio local segue a mesma ordem)

| # | Passo | Quando | Gate (só avança se...) |
|---|---|---|---|
| 1 | Backup `pg_dump -Fc` | antes de tudo | o dump existe, não está vazio e `pg_restore --list` lê |
| 2 | Migrations 001–009 | API antiga no ar | `schema_migrations` tem 002…009; NOTICEs anotados |
| 3 | **Sync de cartões (OBRIGATÓRIO)** | API antiga no ar | `faltando_no_legado_depois = 0` |
| 4 | Backfills pré-deploy: parcelas, loans | API antiga no ar | `sem_dono = 0` e `orfaos = 0` em loans |
| 5 | **Deploy da nova API** | após os passos 1–4 | smoke test OK (ver 5) |
| 6 | Normalização RECEITA/DESPESA | **após** o deploy | só `entrada`/`saida`/`cartao` |
| 7 | Diagnóstico + VALIDATE | após o passo 6 | diagnóstico todo 0; 0 constraints não validadas |
| 8 | EXPLAIN (ANALYZE, BUFFERS) | após o passo 7 | nenhum `Seq Scan on transacoes` nas queries principais |
| 9 | DROP dos índices redundantes | após o passo 8 | só índices que não aparecem em nenhum plano |

**Por que a normalização (6) vem depois do deploy.** Ela troca `ck_transacoes_tipo` pela versão estrita (`entrada`/`saida`/`cartao`). A API antiga ainda grava `RECEITA`/`DESPESA` no settlement. Se a normalização rodasse antes do deploy:
- os settlements falhariam até a nova API subir;
- um rollback da API (5) deixaria de ser possível sem mexer no banco.

Os passos 2–4 são todos compatíveis com a API antiga: colunas novas são NULLABLE ou têm DEFAULT, e os CHECKs da 003 ainda aceitam RECEITA/DESPESA.

### 1. Backup

```sh
mkdir -p backups
# LOCAL
docker compose exec -T postgres sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > backups/contabilidade_$(date +%Y%m%d_%H%M).dump
# PRODUÇÃO
pg_dump -Fc "$DATABASE_URL" > backups/contabilidade_prod_$(date +%Y%m%d_%H%M).dump

ls -lh backups/                                   # não pode estar vazio
pg_restore --list backups/<arquivo>.dump | head   # precisa ser legível
```

Restauração total (último recurso). **Em produção, só com decisão do Maestro**, porque apaga o que foi escrito depois do dump:

```sh
pg_restore --clean --if-exists -d "<conexão>" backups/<arquivo>.dump
```

### 2. Migrations 001–009 (não destrutivas e idempotentes)

```sh
# LOCAL
sh docker/postgres/migrate.sh
# PRODUÇÃO (mesmas 2 passadas do migrate.sh, sem docker)
for f in docker/postgres/migrations/*.sql; do eval "$PSQL" < "$f"; done
eval "$PSQL" < docker/postgres/init.sql
for f in docker/postgres/migrations/*.sql; do eval "$PSQL" < "$f"; done
```

```sql
SELECT version, applied_at FROM schema_migrations ORDER BY version;   -- esperado: 002 ... 009
```

- Leia os `NOTICE`. Um `... NÃO criado` indica duplicados que impediram um UNIQUE (`invoice_items`, `loan_installments`, `uq_transacoes_source`, categorias ou usuários). Anote e trate antes do passo 7; rodar a migration de novo depois da limpeza cria o índice.
- `init.sql` executa `CREATE EXTENSION pgcrypto` e `uuid-ossp`. O usuário de produção precisa de permissão para isso; se as extensões já existirem, nada acontece.
- **Locks:** `CREATE INDEX` sem CONCURRENTLY bloqueia escrita na tabela enquanto o índice é criado. Com o volume atual são segundos. Se `transacoes` passar de ~1 milhão de linhas, crie os índices da 002 com `CONCURRENTLY`, um a um, antes do passo 2.

### 3. Sync de cartões — OBRIGATÓRIO antes do deploy

A nova API tira o INSERT de sincronização do `GET /cartao`. Sem este passo, cartões que só existem em `credit_cards` somem de `GET /cartao` e de `GET /transacoes`.

```sh
eval "$PSQL" < docker/postgres/manual/sync_cartoes_legado.sql                        # 1ª: ROLLBACK, conferir
sed 's/^ROLLBACK; -- trocar por COMMIT.*/COMMIT;/' docker/postgres/manual/sync_cartoes_legado.sql | eval "$PSQL"
```

- **Gate:** `faltando_no_legado_depois = 0`.
- O script é só aditivo (INSERT … WHERE NOT EXISTS) e idempotente.
- Ele é rodado de novo no passo 5 (o esperado é inserir 0) para cobrir cartões criados durante a janela.

### 4. Backfills pré-deploy (alteram dados)

| # | Script | Conferir antes do COMMIT |
|---|---|---|
| 4.1 | `manual/backfill_parcelas.sql` | `linhas_com_grupo` e `grupos` fazem sentido. Limitação: a mesma descrição no mesmo cartão vira um grupo só. |
| 4.2 | `manual/backfill_loans_usuario.sql` | `sem_dono = 0` e `orfaos = 0`. Se não der, **não** dê COMMIT e **não** faça o deploy: a nova API filtra empréstimos por `usuario_id`. |

Os dois são idempotentes. Parcelas criadas pela API antiga durante a janela ficam sem grupo. Rode o 4.1 de novo depois do passo 5; ele só preenche o que estiver NULL.

### 5. Deploy da nova API

- **Pré-condições:** passos 1–4 OK; o build da branch `feat/revisao-seguranca-performance-telas` está aprovado pelo BackEnd.
- **Smoke test logo após subir:**
  - `GET /cartao` lista os cartões de um usuário que tem cartão;
  - `GET /transacoes?mes=&ano=` devolve parceladas, adicionais e pagos;
  - `GET /categoria` mostra as globais e as do usuário;
  - um settlement de teste grava `tipo` = `entrada` ou `saida`.
- **Logo depois do smoke:** rode de novo o sync do passo 3 (esperado: insere 0) e o `backfill_parcelas.sql` do 4.1.
- **Rollback deste passo:** basta subir de novo a versão anterior da API. **Não** é preciso restaurar o banco, porque os passos 2–4 são compatíveis com ela. Isso deixa de valer depois do passo 6.

### 6. Normalização RECEITA/DESPESA (após o deploy)

```sh
eval "$PSQL" < docker/postgres/manual/normalizar_tipo_transacoes.sql       # ROLLBACK, conferir
sed 's/^ROLLBACK; -- trocar por COMMIT.*/COMMIT;/' docker/postgres/manual/normalizar_tipo_transacoes.sql | eval "$PSQL"
```

- **Gate:** o segundo `GROUP BY tipo` mostra só `entrada`, `saida` e `cartao`.
- **A partir daqui, voltar à API antiga exige reverter o CHECK:**
  ```sql
  ALTER TABLE transacoes DROP CONSTRAINT ck_transacoes_tipo;
  ALTER TABLE transacoes ADD CONSTRAINT ck_transacoes_tipo
    CHECK (tipo IN ('entrada','saida','cartao','RECEITA','DESPESA')) NOT VALID;
  ```

### 7. Diagnóstico e VALIDATE

```sh
# diagnóstico (somente leitura): toda linha precisa dar qtd = 0
sed -n '/^-- DIAGNÓSTICO/,/^-- VALIDATE/p' docker/postgres/manual/validar_constraints.sql | eval "$PSQL"
# VALIDATE: verifica as linhas antigas sem bloquear leitura nem escrita
sed -n 's/^-- \(ALTER TABLE .*VALIDATE CONSTRAINT.*\)/\1/p' docker/postgres/manual/validar_constraints.sql | eval "$PSQL"
```

```sql
SELECT conrelid::regclass, conname FROM pg_constraint
WHERE conname ~ '^(fk|ck)_' AND NOT convalidated;   -- esperado: 0 linhas
```

- Constraint com `qtd` diferente de 0: **não** rode o VALIDATE dela. Corrigir esses dados é outra mudança e precisa de aprovação.
- `parcelas_fora_do_padrao` e `like_sem_hifen` são só informativas.

### 8. EXPLAIN (ANALYZE, BUFFERS)

```sql
SELECT userid, COUNT(*) FROM transacoes GROUP BY 1 ORDER BY 2 DESC LIMIT 5;   -- escolha um uid "pesado"
```

```sh
# LOCAL
docker compose exec -T postgres sh -c \
  'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v uid=<userid> -v ano=<ano> -v mes=<mes>' \
  < docker/postgres/manual/explain_queries.sql > backups/explain_$(date +%Y%m%d_%H%M).txt
# PRODUÇÃO (só leitura; EXPLAIN ANALYZE executa os SELECTs)
psql "$DATABASE_URL" -X -v uid=<userid> -v ano=<ano> -v mes=<mes> \
  -f docker/postgres/manual/explain_queries.sql > backups/explain_prod_$(date +%Y%m%d_%H%M).txt

grep -E "^===|Scan|Execution Time" backups/explain_*.txt
```

**Critério:** nenhuma query principal faz `Seq Scan on transacoes` quando a tabela passa de ~10 mil linhas; as queries do mês ficam abaixo de ~10 ms.

### 9. DROP dos índices redundantes (só se o EXPLAIN confirmar)

Script: `manual/remover_indices_redundantes.sql`. Usa `DROP INDEX CONCURRENTLY`, então roda fora de transação.

**Regra:**
- Um índice só cai se **não aparecer em nenhum plano** do passo 8.
- `idx_scan = 0` sozinho não basta. Em produção ele ajuda, se as estatísticas não tiverem sido zeradas recentemente; no banco local, todo índice tem 0.
- Quem aparecer no EXPLAIN fica, e a linha dele no script é comentada.

| Índice | Substituto | Situação na simulação (PGlite, 200 mil linhas) |
|---|---|---|
| `idx_transacoes_userid_data` | `idx_transacoes_userid_data_id` | **USADO** pela Q1 e por `getSaldoAtual`. **Fica**; a linha já vem comentada no script. |
| `idx_transacoes_source` | `uq_transacoes_source` | Não apareceu. Só cai se `SELECT to_regclass('uq_transacoes_source')` não for NULL. |
| `idx_transacoes_status` | índices parciais por status | Não apareceu. |
| `idx_planned_tx_status` | `idx_planned_tx_userid_pending_date` | Não apareceu. |

```sh
eval "$PSQL" < docker/postgres/manual/remover_indices_redundantes.sql
```

Para desfazer um DROP, recrie o índice. A definição está em `init.sql`.

### 10. Encerramento

- Guarde em `backups/` o dump e o arquivo de EXPLAIN. **Não commitar**, porque contêm dados. `backups/` deveria estar no `.gitignore`.
- Reporte ao Maestro: NOTICEs do passo 2, contagens dos passos 3, 4 e 6, diagnóstico, EXPLAIN e índices removidos ou mantidos.
- Depois do deploy, o BackEnd remove `UserRepository.ensureTableExists`, porque a 007 já cobre esses índices.

---

### Simulação já feita (sem Docker)

Em 2026-10-26, rodei o psql real contra PGlite (PG 17.5 em WASM), exposto por socket. O ponto de partida foi um banco "legado": `init.sql` do HEAD, 200 mil transações, 30 linhas RECEITA/DESPESA e loans com UUID "fake".

Resultados:
- migrations 002–007 nas duas passadas;
- 53.333 parcelas em 320 grupos;
- loans com 0 sem dono e 0 órfãos;
- tipos normalizados;
- diagnóstico todo 0;
- 21/21 constraints validadas;
- EXPLAIN abaixo de 2,5 ms.

Separadamente, também no PGlite:
- 008 e 009 testadas: 009 sem rewrite;
- `sync_cartoes_legado.sql` testado: insere só os que faltam e a 2ª execução insere 0.

O que ainda **não** foi feito:
- `pg_dump`;
- ensaio no Postgres 16 do Docker local;
- qualquer passo em produção.
