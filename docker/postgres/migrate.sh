#!/bin/sh
# ==============================================================================
# Aplica o schema no container postgres já em execução (idempotente).
# 1. migrations/*.sql em ordem: alinham tabelas existentes (ADD COLUMN IF NOT EXISTS)
# 2. init.sql: cria tabelas e índices que ainda não existem
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

echo "==> Schema atualizado"
