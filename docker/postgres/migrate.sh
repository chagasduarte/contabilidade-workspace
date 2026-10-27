#!/bin/sh
# ==============================================================================
# Aplica o schema no container postgres já em execução (idempotente).
# 1. migrations/*.sql em ordem: alinham tabelas existentes (ADD COLUMN IF NOT EXISTS)
# 2. init.sql: cria tabelas e índices que ainda não existem
# 3. migrations/*.sql de novo: em banco novo as tabelas só existem após o passo 2,
#    e migrations que dependem delas (índices/constraints) pulam no passo 1.
#    Todas são idempotentes, então a segunda passada é segura.
# docker/postgres/manual/*.sql NÃO são aplicados aqui (exigem aprovação).
# O init.sql do docker-entrypoint só roda com o volume vazio, por isso este passo.
# Uso: sh docker/postgres/migrate.sh   (a partir da raiz do repositório)
# ==============================================================================
set -e

cd "$(dirname "$0")/../.."

run_sql() {
  echo "==> Aplicando $1"
  docker compose exec -T postgres sh -c \
    'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$1"
}

for f in docker/postgres/migrations/*.sql; do
  run_sql "$f"
done

run_sql docker/postgres/init.sql

for f in docker/postgres/migrations/*.sql; do
  run_sql "$f"
done

echo "==> Schema atualizado"
