-- =============================================================================
-- Smoke test del esquema (RLS, triggers, CHECK, EXCLUDE, flujo cotización → reserva).
-- SOLO en una base de datos de prueba recién creada con 00…90. Se ejecuta como superusuario;
-- cada bloque cambia a app_role / platform_role con SET LOCAL ROLE.
-- Resultado esperado: 12 líneas "NOTICE: OK …" y ningún ERROR.
-- =============================================================================
\set ON_ERROR_STOP 1
set search_path = public;

insert into plans (id, code, name, rank, price_month, price_year) values
  ('00000000-0000-7000-8000-000000000001', 'starter', 'Starter', 1, 490, 4900);
insert into tenants (id, code, legal_name, commercial_name, ruc, fiscal_address, business_type, subdomain, logo_initials, plan_id, admin_email)
values ('11111111-1111-7111-8111-111111111111', 'TNT-0001', 'Andes Holidays SAC', 'Andes Holidays', '20123456789', 'Av. Sol 100', 'Operador turístico', 'andes', 'AH', '00000000-0000-7000-8000-000000000001', 'a@a.pe'),
       ('22222222-2222-7222-8222-222222222222', 'TNT-0002', 'Inca Trails SAC', 'Inca Trails', '20987654321', 'Jr. Cusco 1', 'Agencia mayorista', 'inca', 'IT', '00000000-0000-7000-8000-000000000001', 'b@b.pe');

-- ---------------------------------------------------------------- datos por tenant, como app_role
create or replace function t_seed(p_tenant uuid, p_tag text) returns void language plpgsql as $$
declare s uuid; u uuid; c uuid;
begin
  perform app_set_tenant(p_tenant);
  insert into iam_sedes (code, name, address, is_main) values ('SED-01', 'Sede ' || p_tag, 'Dir', true) returning id into s;
  insert into iam_users (name, email, sede_id, status) values ('User ' || p_tag, p_tag || '@x.pe', s, 'activo') returning id into u;
  insert into crm_clients (code, kind, name, doc_type, doc_number, email, segment_code, owner_id)
    values ('CLI-0001', 'persona', 'Cliente ' || p_tag, 'DNI', '4567890' || length(p_tag), p_tag || '@c.pe', 'retail', u) returning id into c;
  insert into crm_leads (code, full_name, email, channel_code, source_code, interest_code, status)
    values ('LEAD-0001', 'Lead ' || p_tag, p_tag || '@l.pe', 'web', 'web', 'tour', 'nuevo');
end $$;
grant execute on function t_seed(uuid, text) to app_role;

begin; set local role app_role; select t_seed('11111111-1111-7111-8111-111111111111', 'a'); commit;
begin; set local role app_role; select t_seed('22222222-2222-7222-8222-222222222222', 'bb'); commit;

-- ---------------------------------------------------------------- aislamiento
do $$
declare n int;
begin
  set local role app_role;
  -- sin contexto → cero filas
  perform set_config('app.tenant_id', '', true);
  select count(*) into n from crm_leads;
  assert n = 0, 'sin contexto debería ver 0 leads, vio ' || n;
  -- tenant A → solo lo suyo
  perform app_set_tenant('11111111-1111-7111-8111-111111111111');
  select count(*) into n from crm_leads;       assert n = 1, 'A debería ver 1 lead';
  select count(*) into n from iam_users;       assert n = 1, 'A debería ver 1 usuario';
  select count(*) into n from tenants;         assert n = 1, 'A debería ver solo su fila de tenants';
  -- escribir en B con contexto A → WITH CHECK
  begin
    insert into crm_leads (tenant_id, code, full_name, email, channel_code, source_code, interest_code)
      values ('22222222-2222-7222-8222-222222222222', 'LEAD-9', 'x', 'x@x', 'web', 'web', 'tour');
    raise exception 'debió fallar WITH CHECK';
  exception when insufficient_privilege then null;  -- 42501 new row violates row-level security policy
  end;
  raise notice 'OK aislamiento RLS';
end $$;

-- plantillas compartidas: tenant ve las globales (NULL) + propias
insert into notif_templates (tenant_id, event_code, channel, subject, body) values (null, 'cotizacion.enviada', 'email', 'Asunto', 'Cuerpo');
do $$ declare n int; begin
  set local role app_role;
  perform app_set_tenant('11111111-1111-7111-8111-111111111111');
  select count(*) into n from notif_templates; assert n = 1, 'shared: debe ver la plantilla global';
  begin
    update notif_templates set subject = $h$hack$h$ where tenant_id is null;
    get diagnostics n = row_count; assert n = 0, 'no debe poder modificar globales';
  end;
  raise notice 'OK RLS shared';
end $$;

-- plataforma ve todo; app_role sin privilegios sobre suscripciones
do $$ declare n int; begin
  set local role platform_role;
  select count(*) into n from crm_leads; assert n = 2, 'platform_role debe ver 2 leads';
  raise notice 'OK platform_role';
end $$;
do $$ begin
  set local role app_role;
  perform 1 from subscriptions;
  raise exception 'app_role no debería leer subscriptions';
exception when insufficient_privilege then raise notice 'OK subscriptions restringida';
end $$;

-- resolución por host antes del contexto
do $$ declare t uuid; begin
  set local role app_role;
  select tenant_id into t from app_resolve_tenant_by_host('inca.kipucontrol.app', 'kipucontrol.app');
  assert t = '22222222-2222-7222-8222-222222222222', 'resolución por host';
  raise notice 'OK resolución por host';
end $$;

-- ---------------------------------------------------------------- triggers y restricciones
do $$ declare v int; l uuid; begin
  set local role app_role;
  perform app_set_tenant('11111111-1111-7111-8111-111111111111');
  select id into l from crm_leads limit 1;
  update crm_leads set notes = 'x' where id = l;
  select lock_version into v from crm_leads where id = l;
  assert v = 1, 'lock_version debe incrementarse';
  raise notice 'OK lock_version';
end $$;

do $$ declare u uuid := app_uuid_v7(); begin
  assert substr(u::text, 15, 1) = '7', 'uuid v7';
  raise notice 'OK uuid v7 %', u;
end $$;

do $$ begin
  set local role app_role;
  perform app_set_tenant('11111111-1111-7111-8111-111111111111');
  insert into audit_events (code, actor_type, entity, entity_id, action, correlation_id) values (1, 'system', 'Test', 'X', 'crear', 'c-1');
  begin
    update audit_events set action = 'x';
    raise exception 'audit_events debería ser append-only';
  exception when insufficient_privilege then raise notice 'OK audit_events append-only';
  end;
end $$;

do $$ begin
  set local role app_role;
  perform app_set_tenant('11111111-1111-7111-8111-111111111111');
  insert into sys_sequences (doc_type, label, prefix, next_number) values ('quote', 'Cotización', 'COT-2026-', 192);
  begin
    update sys_sequences set next_number = 10 where doc_type = 'quote';
    raise exception 'sys_sequences no debería decrecer';
  exception when check_violation then raise notice 'OK secuencia no decrece';
  end;
end $$;

do $$ begin
  set local role app_role;
  perform app_set_tenant('11111111-1111-7111-8111-111111111111');
  insert into catalog_seasons (ref, name, type, date_from, date_to, priority, factor) values ('TMP-01', 'Alta', 'Alta', '2026-07-01', '2026-08-31', 0, 1.2);
  begin
    insert into catalog_seasons (ref, name, type, date_from, date_to, priority, factor) values ('TMP-02', 'Choque', 'Alta', '2026-08-15', '2026-09-15', 0, 1.1);
    raise exception 'temporadas solapadas con igual prioridad deberían fallar';
  exception when exclusion_violation then raise notice 'OK exclusión de temporadas';
  end;
end $$;

do $$ begin
  set local role app_role;
  perform app_set_tenant('11111111-1111-7111-8111-111111111111');
  begin
    update crm_leads set status = 'inventado';
    raise exception 'CHECK de estado debería fallar';
  exception when check_violation then raise notice 'OK CHECK de estados';
  end;
end $$;

-- ---------------------------------------------------------------- flujo catálogo → cotización → reserva (tenant A)
do $$
declare pt uuid; cat uuid; d uuid; p uuid; cl uuid; u uuid; s uuid; q uuid; v uuid; r uuid; rate uuid;
begin
  set local role app_role;
  perform app_set_tenant('11111111-1111-7111-8111-111111111111');
  select id into u from iam_users limit 1;  select id into s from iam_sedes limit 1;  select id into cl from crm_clients limit 1;
  insert into catalog_product_types (name) values ('TOUR') returning id into pt;
  insert into catalog_product_categories (ref, name) values ('CAT-1', 'Cultural') returning id into cat;
  insert into catalog_destinations (ref, name, type, level, path) values ('D01', 'Perú', 'País', 0, 'D01') returning id into d;
  begin
    insert into catalog_destinations (ref, name, type, level, parent_id, path) values ('D02', 'Mal', 'Ciudad', 0, d, 'D01.D02');
    raise exception 'nivel hijo <= padre debería fallar';
  exception when check_violation then null;
  end;
  insert into catalog_products (ref, code, sku, name, internal_name, product_type_id, category_id, primary_destination_id, duration_value, duration_unit, modality)
    values ('PRD-001', 'CUS-CITY', 'AH-CUS-CITY', 'City tour Cusco', 'City tour Cusco', pt, cat, d, 4, 'horas', 'Compartido') returning id into p;
  insert into catalog_rates (ref, product_id, rate_type, segment, channel, currency, cost, price, valid_from, valid_to)
    values ('TAR-001', p, 'Venta', 'Adulto', 'Directo', 'USD', 20, 45, '2026-01-01', '2026-12-31') returning id into rate;
  insert into quote_quotes (code, client_id, owner_id, title, travel_from, travel_to, valid_until, currency, fx_rate, pax_adt)
    values ('COT-2026-00192', cl, u, 'Cusco 4D', '2026-10-10', '2026-10-13', '2026-10-01', 'USD', 3.74, 2) returning id into q;
  insert into quote_versions (quote_id, version_no, author_id, snapshot_label, catalog_snapshot, policies_snapshot, fx_rate, currency)
    values (q, 1, u, 'PRD-001 v1.0', '{}', '{}', 3.74, 'USD') returning id into v;
  update quote_quotes set current_version_id = v where id = q;
  insert into quote_items (quote_version_id, line_no, product_id, product_version, rate_id, segment, service_date, qty, pax, unit_cost, unit_price)
    values (v, 1, p, '1.0', rate, 'Adulto', '2026-10-11', 1, 2, 20, 45);
  assert (select sale_total from quote_items where quote_version_id = v) = 90, 'columna generada sale_total';
  update quote_versions set status = 'enviada', frozen_at = now() where id = v;
  begin
    update quote_items set unit_price = 1 where quote_version_id = v;
    raise exception 'ítems de versión congelada deberían ser inmodificables';
  exception when check_violation then null;
  end;
  insert into booking_reservations (code, quote_id, quote_version_id, client_id, owner_id, sede_id, title, status, travel_from, travel_to, currency, fx_rate, total_amount, snapshot_label)
    values ('RES-2026-000350', q, v, cl, u, s, 'Cusco 4D', 'confirmada', '2026-10-10', '2026-10-13', 'USD', 3.74, 106.20, 'PRD-001 v1.0') returning id into r;
  begin
    insert into booking_reservations (code, quote_id, client_id, owner_id, sede_id, title, travel_from, travel_to, currency, fx_rate, snapshot_label)
      values ('RES-2026-000351', q, cl, u, s, 'dup', '2026-10-10', '2026-10-13', 'USD', 3.74, 'x');
    raise exception 'una cotización no puede convertirse dos veces';
  exception when unique_violation then null;
  end;
  insert into fin_receivables (code, reservation_id, client_id, kind, concept, amount, currency, fx_rate, due_date)
    values ('CXC-00710', r, cl, 'anticipo', 'Anticipo 40%', 42.48, 'USD', 3.74, '2026-10-01');
  raise notice 'OK flujo catálogo → cotización → reserva → CxC (con guardas de congelado, idempotencia y nivel de destino)';
end $$;
