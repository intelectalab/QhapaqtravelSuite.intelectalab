# KipuControl — atajos de desarrollo (colocar en la raíz del espacio de trabajo)
DC := docker compose
PHP := $(DC) exec -T api
FILTER ?=
PHASE ?= 3

.PHONY: help up down restart logs sh setup migrate seed fresh test test-f lint fix openapi openapi-check db-validate web-lint web-test e2e ci

help:            ## Lista los comandos
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-15s %s\n", $$1, $$2}'

up:              ## Levanta todo el stack
	$(DC) up -d --build
down:            ## Detiene el stack
	$(DC) down
restart: down up ## Reinicia
logs:            ## Logs de la API y las colas
	$(DC) logs -f api queue reverb
sh:              ## Shell en el contenedor PHP
	$(DC) exec api bash

setup:           ## Primera vez: dependencias, clave, migraciones y datos demo
	cp -n docs/kit/infra/env/backend.env.example backend/.env || true
	cp -n docs/kit/infra/env/web.env.example web/.env.local || true
	$(PHP) composer install
	$(PHP) php artisan key:generate
	$(MAKE) fresh

migrate:         ## Migraciones (con el usuario dueño del esquema)
	$(PHP) php artisan migrate --database=pgsql_owner --force
seed:            ## Datos demo desde docs/kit/seeds
	$(PHP) php artisan db:seed --class=DemoSeeder
fresh:           ## Base desde cero + datos demo
	$(PHP) php artisan migrate:fresh --database=pgsql_owner --seed --seeder=DemoSeeder

test:            ## Pest contra PostgreSQL y Redis reales
	$(PHP) ./vendor/bin/pest --parallel
test-f:          ## Pest filtrado: make test-f FILTER=Quote
	$(PHP) ./vendor/bin/pest --filter="$(FILTER)"
lint:            ## Pint (verificación) + Larastan
	$(PHP) ./vendor/bin/pint --test
	$(PHP) ./vendor/bin/phpstan analyse --memory-limit=1G
fix:             ## Pint con corrección
	$(PHP) ./vendor/bin/pint

openapi:         ## Exporta el OpenAPI del código (Scramble)
	$(PHP) php artisan scramble:export --path=storage/openapi.generated.json
openapi-check: openapi ## Compara el código contra el contrato (PHASE=0..3)
	python3 docs/kit/api/compare_contract.py backend/storage/openapi.generated.json --phase $(PHASE)
db-validate:     ## Valida los .sql del kit en un cluster temporal
	bash docs/kit/database/tests/validate.sh

web-lint:        ## ESLint + tsc
	cd web && npm run lint
web-test:        ## Vitest
	cd web && npm run test
e2e:             ## Playwright (docs/kit/tests/e2e)
	cd docs/kit/tests/e2e && npx playwright test

ci: lint test openapi-check web-lint web-test ## Lo mismo que corre el CI
