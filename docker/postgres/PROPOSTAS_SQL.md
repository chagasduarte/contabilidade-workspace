# Propostas SQL do DBA para a API

Autor: Lastro (DBA). Dono do código da API: BackEnd.
Testado em PGlite (Postgres 16 em WASM) com 200 mil transações para 200 usuários, porque não há Docker nem servidor Postgres nesta máquina. **Ainda não rodei EXPLAIN no banco real.** Quando houver acesso, rodar `EXPLAIN (ANALYZE, BUFFERS)` das queries abaixo.

## Migrations

| Arquivo | O que faz | Estado |
|---|---|---|
| `migrations/002_indices_performance.sql` | Índices para os filtros reais e para FKs sem índice | Pronta |
| `migrations/003_integridade_constraints.sql` | FKs para `usuarios`, CHECKs `NOT VALID`, UNIQUEs criados só se não houver duplicados | Pronta |
| `migrations/004_transacoes_parcelas.sql` | Colunas `parcela_grupo_id`, `parcela_numero` e `parcela_total`, todas NULLABLE | Pronta |
| `migrations/009_objetivos_progresso.sql` | `objetivos.valor_acumulado` NOT NULL DEFAULT 0 (sem rewrite) + 3 CHECKs `NOT VALID` | Pronta |
| `migrations/008_transacoes_idsubcategoria.sql` | `transacoes.idsubcategoria` + FK `ON DELETE SET NULL NOT VALID` + índice parcial (fase 1 do campo categoria) | Pronta |
| `manual/backfill_idsubcategoria.sql` | Rascunho da fase 3: preenche `idsubcategoria` a partir da coluna legada `categoria`, só com par coerente; ignora settlement | Precisa de aprovação |
| `migrations/007_usuarios_unicos.sql` | Únicos `LOWER(nome)` e `LOWER(email)` em `usuarios`, criados só se não houver duplicados (senão NOTICE). Saíram do `init.sql` para não abortar o `migrate.sh` | Pronta |
| `manual/sync_cartoes_legado.sql` | Copia para `cartoes` os `credit_cards` ativos sem par (só INSERT, idempotente; termina em ROLLBACK) | Precisa de aprovação |
| `migrations/005_categorias_por_usuario.sql` | `categoria.userid` e `subcategoria.userid` | Aprovada em 2026-10-26 |
| `migrations/006_loans_usuario_id.sql` | `loans.usuario_id` INTEGER + FK `NOT VALID` + índice (backfill em `manual/backfill_loans_usuario.sql`) | Aprovada em 2026-10-26 |
| `manual/validar_constraints.sql` | Diagnóstico (só leitura) e depois `VALIDATE CONSTRAINT` | Manual |
| `manual/backfill_parcelas.sql` | Preenche as colunas de parcela nas linhas legadas (**altera dados**) | Precisa de aprovação |
| `manual/remover_indices_redundantes.sql` | `DROP INDEX` de 4 índices redundantes | Precisa de aprovação |

Como as migrations são aplicadas:
- `migrate.sh` agora roda em duas passadas: migrations, depois `init.sql`, depois migrations de novo. Num banco novo, a 002–004 pulam as tabelas na primeira passada.
- Num volume novo, o `docker-compose.yml` monta `initdb-migrations.sh` e a pasta `migrations/`.
- Ordem de execução e scripts manuais: ver `RUNBOOK.md`.

---

## P1. Settlement grava `tipo` RECEITA/DESPESA em `transacoes` (bug de dado)

- **Arquivo:** `settlement/settlement.repository.ts`, métodos `settlePlannedTransaction` e `settleLoanInstallment`.
- **Hoje:** `tipoFinal = plannedRow.tipo`, que vale `'RECEITA'` ou `'DESPESA'`. O loan grava `'DESPESA'`.
- **Efeito:** `GET /transacoes/entradas` e `GET /transacoes` filtram `tipo = 'entrada'` ou `'saida'`, então os lançamentos efetivados **nunca aparecem** ali. Só o dashboard e o forecast enxergam, porque usam `LOWER(tipo) IN (...)`.
- **Proposta:**
  ```ts
  const tipoFinal = plannedRow.tipo === 'RECEITA' ? 'entrada' : 'saida';
  // loan: 'saida' no lugar de 'DESPESA'
  ```
- **Contrato HTTP:** o campo `transacao.tipo` da resposta de `/settlement` passa de `RECEITA`/`DESPESA` para `entrada`/`saida`. Confirmar com o front.
- **Depois:** corrigir as linhas antigas (altera dados, precisa de aprovação) com `UPDATE transacoes SET tipo = CASE tipo WHEN 'RECEITA' THEN 'entrada' ELSE 'saida' END WHERE tipo IN ('RECEITA','DESPESA')`. Em seguida, trocar `ck_transacoes_tipo` para `('entrada','saida','cartao')`.

## P2. Bugs de SQL que hoje falham em silêncio (o catch devolve [] ou 0)

1. **`dashboard.repository.ts` → `getTransacoesMes`**
   - **Bug:** usa `t.data_criacao`, uma coluna que não existe. A query sempre dá erro e o método sempre devolve `[]`.
   - **Proposta:** usar `t.criado_em AS criado_em, t.criado_em AS created_at` e trocar o `EXTRACT` por faixa de datas (ver P4).
2. **`forecast.repository.ts` → `getPendingLoanInstallments`**
   - **Bug:** `l.user_id = $1::uuid` compara uma coluna VARCHAR com uuid e gera o erro `operator does not exist`. Por isso **o forecast nunca mostra parcelas de empréstimo**.
   - **Proposta:** `WHERE l.user_id IN ($1, $2)`, sem o cast. É o mesmo padrão do dashboard.
3. **`transacao.business.ts` → `saveNewuser`**
   - **Bug:** não define `pagamento`, então as linhas entram com `pagamento NULL`. Como `listaParceladas`, `listaAdicionais` e `linhaTemporal` filtram por `pagamento`, **o onboarding não aparece em GET /transacoes**.
   - **Proposta:** `pagamento = data` (é conta corrente, sem cartão), igual a `calcularDataPagamento(data, null)`.
4. **`transacao.repository.ts` → `listaDespesasParceladas`**
   - **Bug:** o `IN (select descricao ...)` não filtra `userid` nem `cartaoid`. Um grupo de parcelas entra na lista porque **outro usuário** (ou outro cartão) tem a mesma descrição pagando no período.
   - **Correção:** a Q2 abaixo resolve.

## P3. `loans.user_id VARCHAR(36)` com UUID "fake"

- **Hoje:** `normalizeUserIdToUuid(7)` vira `'00000000-0000-0000-0000-000000000007'`. Isso deixa a coluna sem FK e obriga a usar `IN ($uuid, $id)` em todas as queries, e não existe índice bom para esse `IN`.
- **Proposta em 2 passos, não destrutiva:**
  1. Migration 006 (`migrations/006_loans_usuario_id.sql`, aprovada): `ALTER TABLE loans ADD COLUMN usuario_id INTEGER NULL REFERENCES usuarios(id) NOT VALID`, mais um índice `(usuario_id, status)`. O backfill altera dados e precisa de aprovação:
     ```sql
     UPDATE loans SET usuario_id = CASE
       WHEN user_id ~ '^\d+$' THEN user_id::int
       ELSE NULLIF(regexp_replace(split_part(user_id, '-', 5), '^0+', ''), '')::int END
     WHERE usuario_id IS NULL;
     ```
  2. **API** (`loan.repository.ts`, `dashboard.repository.ts`, `forecast.repository.ts`, `settlement.repository.ts`):
     - gravar `usuario_id` em `criarComParcelas`;
     - filtrar por `l.usuario_id = $1` (int), no lugar de `user_id IN (...)`;
     - em `settleLoanInstallment`, validar a posse dentro do SQL (`AND l.usuario_id = $2`) em vez do `endsWith` em JS.
  3. Bem depois, com aprovação: parar de gravar `user_id` e removê-la.
- **Contrato HTTP:** nenhum. Os DTOs já expõem `usuario_id` pelo `parseUserIdFromUuid`.

## P4. Queries reescritas

Todas foram testadas. Q1 e Q2 devolvem **as mesmas linhas** das versões antigas no conjunto de teste.

### Q1. GET /transacoes (`TransacaoBusiness.listar`): de 1 + 3 + 3×N queries para 1

- **Hoje:** `CartaoRepository.listar` faz um INSERT (sincronização) a cada GET. Depois vêm 3 queries para a conta e mais 3 por cartão.
- **Proposta:** o JS monta os períodos (`getPeriodoFatura`) e envia tudo em arrays. Na conta corrente, `cartaoid` vai como `null`. Use só ids numéricos de `cartoes`; o fallback de `credit_cards` devolve UUID, que já quebrava o `cartaoid = $4` antigo.

```sql
WITH periodo AS (
  SELECT * FROM unnest($2::int[], $3::date[], $4::date[]) AS p(cartaoid, inicio, fim)
)
SELECT CASE WHEN t.status = 'pago' THEN 'pagos'
            WHEN t.descricao LIKE '%- Parcela' THEN 'parceladas'
            ELSE 'adicionais' END AS grupo,
       t.id, t.descricao, t.tipo, t.valor, t.categoria,
       TO_CHAR(t.data, 'YYYY-MM-DD') AS data, t.status, t.ispaycart, t.cartaoid, t.pagamento
FROM periodo p
JOIN transacoes t
  ON t.userid = $1
 AND t.tipo = 'saida'
 AND (
      (t.status = 'pendente'
       AND t.pagamento BETWEEN p.inicio AND p.fim
       AND (CASE WHEN p.cartaoid IS NULL THEN t.ispaycart IS FALSE ELSE t.cartaoid = p.cartaoid END))
   OR (t.status = 'pago'
       AND t.data BETWEEN p.inicio AND p.fim
       AND t.cartaoid IS NOT DISTINCT FROM p.cartaoid)
 )
ORDER BY grupo, t.data, t.id;
```

- **Plano:** BitmapOr entre `idx_transacoes_saida_pendente_pagamento` e `(userid, data)`, ~4 ms.
- **Em JS:** separar por `grupo` e somar.
- **Mudança de semântica:** o antigo usava `like '%Parcela'`, sem o hífen. Rode o diagnóstico em `manual/validar_constraints.sql` (`like_sem_hifen`) para medir. Se der 0, a troca é neutra.
- **Contrato HTTP:** o mesmo. As linhas ganham `cartaoid` e `pagamento`; dá para tirar se o front reclamar.
- **Sincronização de cartões:** o INSERT de `CartaoRepository.listar` deve sair do caminho de leitura. `criarCartao` e `CartaoRepository.criar` já sincronizam na criação.

### Q2. GET /transacoes/parceladas (`listaDespesasParceladas`): de 1 + N queries para 1

Mesmos parâmetros da Q1. Já corrige o vazamento entre usuários do P2.4.

```sql
WITH periodo AS (
  SELECT * FROM unnest($2::int[], $3::date[], $4::date[]) AS p(cartaoid, inicio, fim)
)
SELECT t.descricao,
       SUM(t.valor) AS total_parcelado,
       SUM(CASE WHEN t.status = 'pago' THEN t.valor ELSE 0 END) AS total_pago,
       SUM(CASE WHEN t.status = 'pendente' THEN t.valor ELSE 0 END) AS total_pendente,
       COUNT(*) AS qtd_parcelas,
       SUM(CASE WHEN t.status = 'pago' THEN 1 ELSE 0 END) AS qtd_parcelas_pagas,
       SUM(CASE WHEN t.status = 'pendente' AND t.pagamento BETWEEN p.inicio AND p.fim
                THEN t.valor ELSE 0 END) AS valor_pendente_mes,
       CASE WHEN bool_or(t.status = 'pendente' AND t.pagamento BETWEEN p.inicio AND p.fim)
            THEN 'pendente' ELSE 'pago' END AS status
FROM periodo p
JOIN transacoes t
  ON t.userid = $1
 AND t.tipo = 'saida'
 AND t.descricao LIKE '%- Parcela'
 AND t.cartaoid IS NOT DISTINCT FROM p.cartaoid
GROUP BY p.cartaoid, t.descricao
HAVING bool_or(t.pagamento BETWEEN p.inicio AND p.fim)
ORDER BY p.cartaoid NULLS FIRST, t.descricao;
```

- **Desempenho:** a antiga levou 218 ms no teste (subquery sem userid e com `ILIKE`); a nova leva ~6 ms usando `idx_transacoes_parcela`.
- **Atenção:** o índice parcial só é usado se a query trouxer **exatamente** `descricao LIKE '%- Parcela'`. Com `ILIKE`, o índice é ignorado. Antes de trocar, confira `parcelas_fora_do_padrao = 0` com o diagnóstico.
- **Contrato HTTP:** o mesmo, com as mesmas colunas e tipos.

### Q3. INSERT em lote atômico (POST /transacoes/parceladas e /transacoes/save)

- **Hoje:** um `await criar()` por linha, fora de transação. Uma falha no meio deixa parcelas pela metade; `/save` chega a fazer 12×N round-trips.
- **Proposta:** `TransacaoRepository.criarEmLote(rows, userid, client?)`, com um único statement, que já é atômico sozinho:

```sql
INSERT INTO transacoes (tipo, descricao, valor, categoria, idcategoria, data, pagamento, status,
                        userid, ispaycart, cartaoid, parcela_grupo_id, parcela_numero, parcela_total)
SELECT x.tipo, x.descricao, x.valor, x.categoria, x.idcategoria, x.data, x.pagamento, x.status,
       $9, x.ispaycart, x.cartaoid,
       CASE WHEN x.parcela_numero IS NULL THEN NULL ELSE $12::uuid END, x.parcela_numero, x.parcela_total
FROM unnest($1::varchar[], $2::varchar[], $3::numeric[], $4::int[], $5::int[], $6::date[], $7::date[],
            $8::varchar[], $10::bool[], $11::int[], $13::int[], $14::int[])
     AS x(tipo, descricao, valor, categoria, idcategoria, data, pagamento, status, ispaycart, cartaoid,
          parcela_numero, parcela_total)
RETURNING *;
```

- **`parcela_grupo_id`:**
  - em `/parceladas`, um único `crypto.randomUUID()`;
  - em `/save`, um UUID **por item fixo** (e não um por request). Ali `parcela_total = 12`.
  - os UUIDs também podem ir como array `$12::uuid[]`.
- A ordem do RETURNING não é garantida. Ordene em JS por `data`, depois `id`.
- **Contrato HTTP:** o mesmo. As linhas ganham 3 campos novos.

### Q4. Extrato com faixa de competência e keyset (`TransacaoRepository.extrato`)

- **Hoje:**
  ```sql
  $ano = CASE WHEN cartaoid IS NOT NULL THEN extract(year FROM pagamento) ELSE extract(year FROM data) END
  ```
  O `EXTRACT` impede o uso de índice. Também não há cursor, só `limit`.
- **Proposta:**
  - `inicio = make_date(ano, mes ?? 1, 1)`;
  - `fimExclusivo = mes ? inicio + 1 mês : make_date(ano + 1, 1, 1)`;
  - a expressão CASE precisa ser **idêntica** à de `idx_transacoes_userid_competencia`.

```sql
SELECT id, descricao, tipo, valor, categoria, TO_CHAR(t.data, 'YYYY-MM-DD') AS data, status, cartaoid, pagamento
FROM transacoes t
WHERE t.userid = $1
  AND ($2::date IS NULL OR (CASE WHEN cartaoid IS NOT NULL THEN pagamento ELSE data END) >= $2)
  AND ($3::date IS NULL OR (CASE WHEN cartaoid IS NOT NULL THEN pagamento ELSE data END) <  $3)
  AND ($4::date IS NULL OR (t.data, t.id) < ($4, $5))      -- cursor
ORDER BY t.data DESC, t.id DESC
LIMIT $6;                                                   -- default 50, máx 200
```

- **Plano:** `Index Scan Backward using idx_transacoes_userid_data_id` sem filtro de mês, ou bitmap em `idx_transacoes_userid_competencia` com filtro. Fica abaixo de 0,4 ms nos dois casos.
- **Contrato HTTP (opcional e retrocompatível):**
  - aceitar `?cursor=<data>_<id>` na entrada;
  - devolver `X-Next-Cursor` no header, ou `{ items, next_cursor }` com `?paginado=true`, para não quebrar o array atual.
- **Mesma expressão em outros lugares** (por enquanto só no WHERE):
  - `agrupamentoTipo` já usa `CASE ... BETWEEN` e já pega o índice;
  - `dashboard.getAgrupamentoCategoria` deve ficar assim:
    ```sql
    (CASE WHEN cartaoid IS NOT NULL THEN pagamento ELSE data END) >= make_date($1,1,1)
      AND < make_date($1+1,1,1)
    ```
    Note que ali a expressão está escrita como `CASE WHEN cartaoid IS NULL THEN data ELSE pagamento END`. Reescreva na forma do índice.

### Q5. Trocar `EXTRACT(...) = $n` por faixa de datas

Mesmo resultado, mas usa índice. O padrão é `col >= make_date(a,m,1) AND col < (make_date(a,m,1) + interval '1 month')::date`.

| Arquivo → método | Coluna | Índice que passa a usar |
|---|---|---|
| `transacao.repository` → `somaTransacoes`, `linhaTemporal`, `buscaPorDia` (`pagamento = make_date(a,m,d)`) | pagamento | `idx_transacoes_userid_pagamento` / `idx_transacoes_parcela` |
| `dashboard.repository` → `getSaldoAtual` (`data < make_date($ano,$mes,1) + 1 mês`), `getTransacoesMes`, `getProjecaoMensal` (CTE de transacoes, planned, loans e invoices) | data / data_prevista / due_date / data_vencimento | `(userid,data,id)`, `idx_planned_tx_userid_pending_date`, `idx_loan_installments_due`, `idx_card_invoices_cartao_venc_aberta` |
| `dashboard.repository` → `getPlannedTransactionsMes`, `getLoanInstallmentsMes`, `getCardInvoicesMes` | idem | idem |
| `planned-transaction.repository` → `existeOcorrenciaNoMesAno` | data_prevista | `idx_planned_tx_parent_rec` + PK |
| `planejamento.repository` → filtro por mes/ano | data | `idx_planejamento_userid_data` |

- **`linhaTemporal`:** a versão antiga levou 39 ms; a nova leva 0,7 ms.
- **Contrato HTTP:** nenhum.

## P5. Outros pontos (por prioridade)

1. **Corrida no limite do cartão** (`card.business.ts` → `lancarTransacao`):
   - **Problema:** `obterLimiteComprometido` roda **fora** da transação e sem lock. Duas compras ao mesmo tempo podem estourar o limite.
   - **Proposta:** depois do `BEGIN`, fazer `SELECT ... FROM credit_cards WHERE id = $1 AND usuario_id = $2 FOR UPDATE` e só então calcular o comprometido com o mesmo `client`.
2. **DDL em runtime** (`user.repository.ensureTableExists`, `planned-transaction.repository.ensureTableExists`, `settlement.repository.ensureColumnsExist`):
   - **Problema:** esse DDL já está coberto por `init.sql` e pelas migrations. Ele exige que o usuário da app tenha privilégio de DDL, e a versão em runtime de `planned_transactions` cria a tabela **sem as FKs**, divergindo do schema. Além disso, `ensureColumnsExist` recria `idx_transacoes_source`, que eu quero remover em favor de `uq_transacoes_source`.
   - **Proposta:** remover os três métodos e as chamadas.
3. **`CartaoRepository.buscar`:**
   - **Problema:** `WHERE id::text = $1` em `credit_cards` impede o uso da PK e força seq scan. A função também não filtra por `userid` (risco de IDOR); vale passar o userid.
   - **Proposta:** validar o UUID por regex e usar `WHERE id = $1::uuid AND usuario_id = $2`.
4. **Login:** `LOWER(TRIM(nome))` não usava o índice `LOWER(nome)`. A 002 cria índices com `LOWER(TRIM(...))`, então não precisa mudar código.
5. **Paginação ausente:** `dashboard.getTransacoes` (`SELECT *` sem limite), `planned-transaction.listar` e `listaDespesa`. Use o mesmo keyset da Q4.
6. **IDOR em `transacoes`** (atualizar, excluir, uptopago): já corrigido pelo BackEnd ✅. Restam sem filtro de dono: `objetivos.buscar(id)`, `loan.atualizarStatus(id)` e `categoria` e `subcategoria` (estes resolvidos pela 005, mais o código).

## P6. Categorias por usuário (migration 005, aguardando aprovação)

- **Colunas:**
  - `categoria.userid` e `subcategoria.userid`, INTEGER NULL, com FK `NOT VALID` para `usuarios`;
  - `NULL` significa categoria global;
  - nenhuma linha é alterada; todas as atuais continuam globais.
- **Índices:**
  - categoria: `(userid, tipo, nome) WHERE userid IS NOT NULL` e `(tipo, nome) WHERE userid IS NULL`;
  - subcategoria: `(userid, idcategoria) WHERE userid IS NOT NULL`.
- **UNIQUE** (só se não houver duplicados; senão, NOTICE):
  - `uq_categoria_dono_nome_tipo (COALESCE(userid,0), LOWER(TRIM(nome)), tipo)`;
  - `uq_subcategoria_dono_nome (idcategoria, COALESCE(userid,0), LOWER(TRIM(nome)))`.
  - Uso `TRIM` além de `LOWER` porque achei `'Mercado'` e `'mercado '` como caso realista.
  - O usuário **pode** ter uma "Mercado" própria igual à global. Se o Maestro preferir bloquear isso, precisa de trigger.
- **Testado:**
  - a 005 roda duas vezes sem erro;
  - com duplicados ela só emite NOTICE;
  - dup do mesmo dono é rejeitado com 23505 (dá para mapear para 409);
  - a listagem faz BitmapOr nos dois índices parciais.
- **Queries para a API:**
  ```sql
  -- listar
  SELECT * FROM categoria WHERE (userid = $1 OR userid IS NULL) [AND tipo = $2] ORDER BY nome;
  -- buscar (leitura)
  SELECT * FROM categoria WHERE id = $1 AND (userid = $2 OR userid IS NULL);
  -- criar
  INSERT INTO categoria (nome, icone, cor, tipo, userid) VALUES (..., $userid) RETURNING *;
  -- atualizar / excluir (só as do usuário; 0 linhas -> 404 ou 403)
  UPDATE categoria SET ... WHERE id = $5 AND userid = $6 RETURNING *;
  DELETE FROM categoria WHERE id = $1 AND userid = $2 RETURNING *;
  -- subcategoria: listar por idcategoria
  SELECT * FROM subcategoria WHERE idcategoria = $1 AND (userid = $2 OR userid IS NULL) ORDER BY nome;
  ```
  Na criação de subcategoria, confira na API que a categoria-pai é global ou do próprio usuário. Se o pai é do usuário, grave a subcategoria com `userid = usuário`.
- **Atenção:** `DELETE FROM categoria` dispara `SET NULL` em `transacoes`, `planned_transactions` e `card_transactions`, e `CASCADE` em `subcategoria`. Isso já acontece hoje, só que agora fica restrito ao dono.
- **Contrato HTTP:** a resposta ganha `userid` (`null` para global). PUT/DELETE numa categoria global passam a devolver 403 ou 404.

## P7. Objetivos e "planejado x realizado por categoria no mês" (migration 009)

### Objetivos
- **`valor_acumulado NUMERIC(12,2) NOT NULL DEFAULT 0`:** confirmado que não reescreve a tabela no PG11+. O default constante fica em `pg_attribute.attmissingval`. No teste com 50 mil linhas, o `relfilenode` era o mesmo antes e depois, e as linhas antigas leem `0.00`.
- **CHECKs (`NOT VALID`):**
  - `ck_objetivos_valor_objetivo` (`> 0`);
  - `ck_objetivos_valor_mensal` (`>= 0`);
  - `ck_objetivos_valor_acumulado` (`>= 0`).
  - Hoje `ObjetivosBusiness.criar` só exige nome e `valor_objetivo` não nulo. Valide na API e devolva 400; senão o banco responde 23514, com o nome da constraint indicando o campo.
- **Índices:** nenhum novo.
  - `GET /objetivos/:id` usa a PK. Inclua `AND usuario_id = $2` em `ObjetivosRepository.buscar`, que hoje não filtra o dono (IDOR).
  - A listagem usa `idx_objetivos_usuario`, com o sort em memória: 1,1 ms com 250 objetivos por usuário.

### Planejado x realizado
Uma query só, que dispensa índice novo. Com UNION ALL + GROUP BY não é preciso FULL JOIN. Uma FULL JOIN com `IS NOT DISTINCT FROM`, que seria necessária para casar categoria NULL, **não é suportada** pelo Postgres (erro 0A000).

- **Parâmetros:** `$1` userid, `$2` início do mês, `$3` início do mês seguinte (exclusivo), `$4` mês, `$5` ano.

```sql
WITH linhas AS (
  -- planejado
  SELECT categoriaid AS idcategoria, valor AS planejado, 0::numeric AS realizado
  FROM planejamento
  WHERE userid = $1 AND data >= $2 AND data < $3
  UNION ALL
  -- realizado na conta (competência = mesma expressão de idx_transacoes_userid_competencia)
  SELECT idcategoria, 0, valor
  FROM transacoes
  WHERE userid = $1 AND tipo = 'saida'
    AND (CASE WHEN cartaoid IS NOT NULL THEN pagamento ELSE data END) >= $2
    AND (CASE WHEN cartaoid IS NOT NULL THEN pagamento ELSE data END) <  $3
  UNION ALL
  -- realizado no cartão (parcelas das faturas de referência do mês)
  SELECT ct.categoria_id, 0, ii.valor_parcela
  FROM credit_cards cc
  JOIN card_invoices ci ON ci.cartao_id = cc.id AND ci.mes_referencia = $4 AND ci.ano_referencia = $5
  JOIN invoice_items ii ON ii.fatura_id = ci.id
  JOIN card_transactions ct ON ct.id = ii.transacao_id
  WHERE cc.usuario_id = $1
)
SELECT l.idcategoria,
       c.nome AS categoria_nome,
       SUM(l.planejado) AS planejado,
       SUM(l.realizado) AS realizado,
       SUM(l.planejado) - SUM(l.realizado) AS saldo
FROM linhas l
LEFT JOIN categoria c ON c.id = l.idcategoria
GROUP BY l.idcategoria, c.nome
ORDER BY realizado DESC, l.idcategoria NULLS LAST;
```

- **Plano** (PGlite, 200 mil transações, 50 mil linhas de planejamento, 400 cartões): ~2,8 ms. Tudo por índice:
  - `idx_planejamento_userid_data`;
  - `idx_transacoes_userid_competencia`;
  - `idx_credit_cards_usuario` → `idx_card_invoices_cartao` → `idx_invoice_items_fatura` → PK de `card_transactions`.
  - `idx_card_tx_categoria` (002) existe, mas não entra aqui, porque o join é pela PK. Ele serve ao `ON DELETE SET NULL` de categoria.
- **Decisões de negócio para o BackEnd:**
  1. **`planejamento.tipo`:** se houver planejamento de receita, filtre `tipo` no planejado. Para comparar com `tipo = 'saida'`, considere só despesa.
  2. **`status`:** o realizado acima conta saídas `pago` e `pendente`. Se "realizado" significar apenas o pago, acrescente `AND status = 'pago'` (o índice continua servindo).
  3. **Dupla contagem:** hoje não existe. Compras novas no cartão só vão para `card_transactions`, e `pagarFatura` não grava em `transacoes`. Se um dia o pagamento da fatura passar a gerar uma `transacao`, exclua-a do realizado (por `source_type`).
- **Contrato HTTP:** é um endpoint novo, então não há mudança em endpoints existentes.

