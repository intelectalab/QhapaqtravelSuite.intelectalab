#!/bin/bash
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$APP_DB_PASSWORD" -v platform_password="$PLATFORM_DB_PASSWORD" <<'SQL'
select 'create role app_role nologin nobypassrls' where not exists (select 1 from pg_roles where rolname = 'app_role') \gexec
select 'create role platform_role nologin nobypassrls' where not exists (select 1 from pg_roles where rolname = 'platform_role') \gexec
select format('create role kipucontrol_app login password %L nobypassrls in role app_role', :'app_password') where not exists (select 1 from pg_roles where rolname = 'kipucontrol_app') \gexec
select format('create role kipucontrol_platform login password %L nobypassrls in role platform_role', :'platform_password') where not exists (select 1 from pg_roles where rolname = 'kipucontrol_platform') \gexec
grant connect on database kipucontrol to kipucontrol_app, kipucontrol_platform;
SQL
