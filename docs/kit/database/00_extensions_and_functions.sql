-- =============================================================================
-- KipuControl · Esquema PostgreSQL 17 · 00_extensions_and_functions.sql
-- Extensiones y funciones compartidas por todas las fases. Ejecutar PRIMERO.
-- Probado en PostgreSQL 16 (sintaxis compatible con 17).
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------- extensiones
create extension if not exists pgcrypto;     -- gen_random_bytes (UUID v7), digest
create extension if not exists btree_gist;   -- EXCLUDE con igualdad + rangos (temporadas, rooming, cupos, rangos)
create extension if not exists pg_trgm;      -- búsqueda por similitud (productos, proveedores, títulos)
create extension if not exists citext;       -- emails case-insensitive (inbox, marketing)

-- ---------------------------------------------------------------- UUID v7 (PK ordenables)
-- Laravel 12 (HasUuids) ya genera UUID v7 en la aplicación; este default cubre inserts
-- desde SQL, seeders y jobs. PostgreSQL 18 trae uuidv7() nativo: reemplazable sin cambios.
create or replace function app_uuid_v7() returns uuid
language plpgsql volatile parallel safe as $$
declare
  ts bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  b  bytea  := gen_random_bytes(16);
begin
  b := set_byte(b, 0, ((ts >> 40) & 255)::int);
  b := set_byte(b, 1, ((ts >> 32) & 255)::int);
  b := set_byte(b, 2, ((ts >> 24) & 255)::int);
  b := set_byte(b, 3, ((ts >> 16) & 255)::int);
  b := set_byte(b, 4, ((ts >> 8) & 255)::int);
  b := set_byte(b, 5, (ts & 255)::int);
  b := set_byte(b, 6, (get_byte(b, 6) & 15) | 112);   -- versión 7
  b := set_byte(b, 8, (get_byte(b, 8) & 63) | 128);   -- variante RFC 9562
  return encode(b, 'hex')::uuid;
end $$;
comment on function app_uuid_v7() is 'UUID v7 (RFC 9562) ordenable por tiempo. Default de todas las PK uuid.';

-- ---------------------------------------------------------------- contexto de tenant
-- El middleware SetPostgresTenant ejecuta, dentro de cada transacción:
--   select set_config('app.tenant_id', '<uuid>', true);   -- equivale a SET LOCAL
-- Sin contexto la función devuelve NULL y las políticas RLS devuelven cero filas (falla cerrado).
-- NULLIF cubre el caso en que la variable quedó en '' tras un SET LOCAL previo en la misma sesión.
create or replace function app_current_tenant_id() returns uuid
language sql stable parallel safe as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;
comment on function app_current_tenant_id() is 'Tenant del contexto (app.tenant_id). NULL si no hay contexto → RLS no devuelve filas.';

create or replace function app_set_tenant(p_tenant uuid) returns void
language sql volatile as $$
  select set_config('app.tenant_id', p_tenant::text, true)
$$;
comment on function app_set_tenant(uuid) is 'Fija app.tenant_id solo para la transacción actual (SET LOCAL). Úsese dentro de BEGIN…COMMIT.';

-- ---------------------------------------------------------------- triggers genéricos
create or replace function app_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Concurrencia optimista: si la aplicación no incrementó lock_version, lo hace la BD.
-- El UPDATE debe llevar "WHERE id = ? AND lock_version = ?" (0 filas → 409 en la API).
create or replace function app_bump_lock_version() returns trigger
language plpgsql as $$
begin
  if new.lock_version = old.lock_version then
    new.lock_version := old.lock_version + 1;
  end if;
  return new;
end $$;

-- Tablas append-only (bitácoras, libro de crédito B2B, histórico de TC, consentimientos).
create or replace function app_forbid_update_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'La tabla % es append-only: % no permitido', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end $$;

-- Correlativos: next_number nunca decrece (sys_sequences, fin_document_series, platform_sequences).
create or replace function app_sequence_no_decrease() returns trigger
language plpgsql as $$
begin
  if new.next_number < old.next_number then
    raise exception 'next_number no puede decrecer (% → %) en %', old.next_number, new.next_number, tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- particiones mensuales
-- Crea la partición DEFAULT y N particiones mensuales desde p_start. Idempotente.
-- Si el padre ya tiene RLS, cada partición nueva queda con RLS habilitada y sin políticas
-- (acceso directo a la partición = cero filas; el acceso normal es por la tabla padre).
-- Programar un job mensual (JOB de mantenimiento) que llame a esta función con el mes siguiente.
create or replace function app_create_monthly_partitions(p_parent text, p_start date, p_months int)
returns void language plpgsql as $$
declare
  d date;
  part text;
  has_rls boolean;
begin
  select c.relrowsecurity into has_rls from pg_class c where c.oid = p_parent::regclass;
  part := p_parent || '_default';
  if to_regclass(part) is null then
    execute format('create table %I partition of %I default', part, p_parent);
    if has_rls then execute format('alter table %I enable row level security, force row level security', part); end if;
  end if;
  for i in 0 .. p_months - 1 loop
    d := (date_trunc('month', p_start) + make_interval(months => i))::date;
    part := format('%s_y%sm%s', p_parent, to_char(d, 'YYYY'), to_char(d, 'MM'));
    if to_regclass(part) is null then
      execute format('create table %I partition of %I for values from (%L) to (%L)',
                     part, p_parent, d, (d + interval '1 month')::date);
      if has_rls then execute format('alter table %I enable row level security, force row level security', part); end if;
    end if;
  end loop;
end $$;
comment on function app_create_monthly_partitions(text, date, int) is 'Crea partición DEFAULT + particiones mensuales (audit_events, usage_counters, channel_web_events, integration_webhook_deliveries).';

-- ---------------------------------------------------------------- activación de RLS por tabla
-- Modo 'strict' : tenant_id = contexto (tablas de negocio).
-- Modo 'shared' : lectura de filas propias + filas globales (tenant_id NULL: plantillas/feriados/roles
--                 de sistema) vía la política tenant_shared_read (solo SELECT); escritura solo de filas propias.
-- Siempre agrega la política platform_access para el rol platform_role (conexión de plataforma).
-- Idempotente; si la tabla aún no existe (fase no desplegada) solo avisa.
-- En migraciones Laravel: DB::statement("select app_enable_tenant_rls('crm_leads', 'strict')").
create or replace function app_enable_tenant_rls(p_table text, p_mode text default 'strict')
returns void language plpgsql as $$
declare
  part record;
begin
  if to_regclass(p_table) is null then
    raise notice 'app_enable_tenant_rls: % no existe todavía (se omite)', p_table;
    return;
  end if;
  execute format('alter table %I enable row level security', p_table);
  execute format('alter table %I force row level security', p_table);
  execute format('drop policy if exists tenant_isolation on %I', p_table);
  if p_mode = 'strict' then
    execute format($p$create policy tenant_isolation on %I
                      using (tenant_id = app_current_tenant_id())
                      with check (tenant_id = app_current_tenant_id())$p$, p_table);
  elsif p_mode = 'shared' then
    -- escritura (INSERT/UPDATE/DELETE) solo sobre filas propias; lectura también de filas globales
    execute format($p$create policy tenant_isolation on %I
                      using (tenant_id = app_current_tenant_id())
                      with check (tenant_id = app_current_tenant_id())$p$, p_table);
    execute format('drop policy if exists tenant_shared_read on %I', p_table);
    execute format($p$create policy tenant_shared_read on %I for select
                      using (tenant_id is null)$p$, p_table);
  else
    raise exception 'modo RLS desconocido: %', p_mode;
  end if;
  execute format('drop policy if exists platform_access on %I', p_table);
  if exists (select 1 from pg_roles where rolname = 'platform_role') then
    execute format('create policy platform_access on %I to platform_role using (true) with check (true)', p_table);
  end if;
  -- particiones: RLS sin políticas (bloquea el acceso directo)
  for part in select inhrelid::regclass::text as t from pg_inherits where inhparent = p_table::regclass loop
    execute format('alter table %s enable row level security, force row level security', part.t);
  end loop;
end $$;
comment on function app_enable_tenant_rls(text, text) is 'ENABLE + FORCE RLS y política tenant_isolation (strict|shared) + platform_access. Idempotente.';
