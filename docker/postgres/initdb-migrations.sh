#!/bin/sh
# ==============================================================================
# Executado pelo docker-entrypoint do postgres SOMENTE na criação do volume,
# depois de init.sql (ordem alfabética em /docker-entrypoint-initdb.d).
# Aplica docker/postgres/migrations/*.sql para que banco novo nasça com os
# mesmos índices/constraints de um banco migrado via migrate.sh.
# ==============================================================================
set -e
for f in /docker-entrypoint-migrations/*.sql; do
  [ -e "$f" ] || continue
  echo "==> Aplicando $f"
  psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$f"
done
