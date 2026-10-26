# E2E da API (ambiente local)

Bateria ponta a ponta que exercita a API **rodando** contra um **Postgres local**, via HTTP. Cobre:

- autenticação (401);
- isolamento entre usuários (IDOR → 404) e categorias globais (403);
- posse de categoria e subcategoria;
- extrato paginado com `totais`;
- parceladas sem vazamento entre usuários;
- settle (409 na segunda efetivação);
- loans e forecast;
- planejamento/resumo, conferido contra SQL direto no banco;
- `/user/me` (409);
- validações do `/ai/chat`, sem chamar o provedor;
- **concorrência real**: compras paralelas no cartão (`FOR UPDATE`) e aportes simultâneos em objetivos.

**Não faz parte do `test`** (unitários com mocks) e não roda no deploy. É um target separado, sem cache.

## Como rodar

1. Suba o banco local e aplique as migrations. Exemplo: o container `contabilidade-postgres` na porta **5433**; veja `docker/postgres/RUNBOOK.md`.
2. Suba a API apontando para esse banco: `npx nx serve api`. Por padrão ela fica em `http://localhost:3000`.
3. Rode:

```sh
npx nx run api:e2e-local
```

### Configuração (variáveis de ambiente)

| Variável | Padrão | O que é |
|---|---|---|
| `E2E_API_URL` | `http://localhost:3000` | URL da API em teste |
| `E2E_DATABASE_URL` | montada de `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASS`/`DB_NAME` do `.env` da raiz | Banco que **a API usa**, para conferências e limpeza |

Exemplo explícito:

```sh
E2E_DATABASE_URL=postgres://usuario:senha@localhost:5433/contabilidade npx nx run api:e2e-local
```

## Proteções (o script recusa rodar com exit 2, antes de criar qualquer dado)

- **Host do banco** não local (só `localhost`, `127.0.0.1`, `::1`).
- **Porta do banco 5432.** Nesta máquina, a 5432 é um **túnel para um Postgres REAL** (`cloudflared`). Use sempre o container local.
- **Host da API** não local.
- **API em outro banco:** se a API não estiver usando o banco informado, o script para logo após criar o primeiro usuário-sonda e informa o id. Nesse caso a sonda fica no banco da API e precisa ser removida à mão: o script não tem acesso a esse banco.

## Dados

- **Usuários:** cria usuários próprios com o prefixo `be_e2e_<sufixo>` via `POST /auth/register`.
- **Categoria global:** cria uma `BE-Global-<sufixo>` direto no banco, para o teste de 403.
- **Limpeza ao final**, mesmo em caso de falha: apaga **só** o que criou, numa transação. Os registros filhos saem antes de `usuarios`, porque as FKs são NO ACTION.
- **Dados de outras pessoas:** não toca em nada que não criou (por exemplo, `demo` e `seed_*`).
- **Backfills:** um backfill global rodando ao mesmo tempo (ex.: scripts em `docker/postgres/manual/`) pode alterar linhas do E2E que casem com os padrões legados. Evite rodar os dois juntos.

Saída: `TUDO OK (N checagens)` com exit 0; com falha, lista os `✗` e sai com 1.
