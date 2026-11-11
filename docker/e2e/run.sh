#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

compose() { docker compose --profile e2e "$@"; }

compose up -d postgres redis mailpit storage api-e2e web-e2e

if [ "${E2E_SKIP_RESET:-0}" != "1" ]; then
  echo "Preparando la base de pruebas qhapaq_e2e (tu base de desarrollo no se toca)…"
  compose exec -T postgres sh -c "psql -U qhapaq_owner -d postgres -tAc \"select 1 from pg_database where datname = 'qhapaq_e2e'\" | grep -q 1 || psql -U qhapaq_owner -d postgres -c 'create database qhapaq_e2e'" </dev/null
  compose exec -T api-e2e php artisan migrate:fresh --database=pgsql_owner --force --seed --seeder='Database\Seeders\E2ESeeder' </dev/null
fi

echo "Esperando a que la web de pruebas responda en http://localhost:3100…"
for _ in $(seq 1 90); do
  if curl -fs -o /dev/null http://localhost:3100/login; then break; fi
  sleep 2
done

compose run --rm e2e npx playwright test "$@"
