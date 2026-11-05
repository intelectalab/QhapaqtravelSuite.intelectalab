-- =============================================================================
-- Qhapaq Travel Suite · Esquema PostgreSQL 17 · 30_fase2.sql
-- Fase 2 · Canales y campo
-- Generado desde §3 de las especificaciones 00–18 + CONVENCIONES.md (fuente de verdad del kit).
-- Tablas nuevas: 86. Requiere: 00_extensions_and_functions.sql y archivos previos.
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------- tablas
create table ops_mobile_devices (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  user_id uuid not null,
  app varchar(20) not null check (app in ('operador', 'pasajero')),
  platform varchar(10) not null check (platform in ('ios', 'android')),
  app_version varchar(20) not null,
  expo_push_token varchar(200),
  last_seen_at timestamptz,
  last_sync_at timestamptz,
  sync_cursor varchar(64),
  revoked_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_ops_mobile_devices primary key (id)
);

create table ops_sync_actions (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  user_id uuid not null,
  device_id uuid not null,
  resource_type varchar(10) not null check (resource_type in ('guide', 'driver')),
  resource_id uuid not null,
  action_type varchar(20) not null check (action_type in ('confirm', 'start', 'checkin', 'checkin_undo', 'checkin_all', 'evidence', 'incident', 'finish')),
  assignment_id uuid not null,
  coalesce_key varchar(120) not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  captured_offline boolean not null default false,
  received_at timestamptz not null default now(),
  attempts smallint not null default 1,
  result varchar(20) not null check (result in ('applied', 'duplicate', 'conflict_resolved', 'rejected')),
  conflict_rule varchar(40),
  conflict_message text,
  response jsonb not null,
  constraint pk_ops_sync_actions primary key (id)
);

create table channel_trip_messages (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  sender_type varchar(10) not null check (sender_type in ('passenger', 'agency', 'system')),
  sender_user_id uuid,
  body text not null,
  quick_reply boolean not null default false,
  read_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_channel_trip_messages primary key (id)
);

create table catalog_service_cost_history (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  service_id uuid not null,
  cost numeric(14,2) not null check (cost >= 0),
  currency char(3) not null check (currency in ('PEN','USD')),
  effective_from date not null,
  effective_to date,
  source varchar(30) not null default 'manual',
  rate_request_id uuid,
  approval_request_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_catalog_service_cost_history primary key (id)
);

create table supplier_request_responses (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  supplier_request_id uuid not null,
  reservation_service_id uuid not null,
  provider_id uuid not null,
  type varchar(20) not null check (type in ('confirmacion', 'rechazo', 'alternativa')),
  responded_by_user_id uuid not null,
  responded_at timestamptz not null default now(),
  confirmed_by_name varchar(120),
  confirmation_code varchar(40),
  rejection_reason varchar(60) check (rejection_reason is null or rejection_reason in ('Sin disponibilidad (sold out)', 'Fecha bloqueada por mantenimiento', 'Tarifa no vigente para la fecha', 'Cupo de grupo excedido', 'Otro')),
  alt_kind varchar(40) check (alt_kind is null or alt_kind in ('Otra fecha', 'Otro tipo de habitación', 'Otro horario', 'Upgrade sin costo', 'Otro')),
  alt_date date,
  alt_service_id uuid,
  alt_net_cost numeric(14,2),
  currency char(3),
  hold_until date,
  note text,
  review_status varchar(20) check (review_status is null or review_status in ('pendiente', 'aceptada', 'rechazada', 'expirada')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_supplier_request_responses primary key (id),
  constraint ck_supplier_request_responses_1 check (type <> 'confirmacion' or (confirmation_code is not null and length(confirmation_code) >= 4)),
  constraint ck_supplier_request_responses_2 check (type <> 'rechazo' or (rejection_reason is not null and note is not null)),
  constraint ck_supplier_request_responses_3 check (type <> 'alternativa' or (alt_kind is not null and note is not null))
);

create table supplier_invoices (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  payable_id uuid not null,
  provider_id uuid not null,
  number varchar(20) not null check (number ~ '^[A-Z0-9]{4}-[0-9]{1,8}$'),
  issue_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null check (currency in ('PEN','USD')),
  amount_difference numeric(14,2) not null default 0,
  document_id uuid not null,
  original_file_name varchar(200) not null,
  status varchar(20) not null default 'registrada' check (status in ('registrada', 'validada', 'observada', 'rechazada')),
  uploaded_by uuid not null,
  uploaded_at timestamptz not null default now(),
  validated_by uuid,
  validated_at timestamptz,
  validation_note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_supplier_invoices primary key (id)
);

create table supplier_rate_requests (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  provider_id uuid not null,
  service_id uuid not null,
  current_cost numeric(14,2) not null,
  proposed_cost numeric(14,2) not null check (proposed_cost > 0),
  currency char(3) not null check (currency in ('PEN','USD')),
  effective_from date not null,
  reason_type varchar(40) not null check (reason_type in ('Ajuste por inflación / costos', 'Cambio de temporada', 'Mejora del servicio', 'Tarifa promocional', 'Otro')),
  reason_detail text,
  status varchar(20) not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada', 'retirada')),
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  resulting_rate_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_supplier_rate_requests primary key (id)
);

create table fin_document_series (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  doc_type char(2) not null check (doc_type in ('01', '03', '07', '08')),
  series char(4) not null,
  next_number integer not null default 1 check (next_number > 0),
  sede_id uuid,
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_document_series primary key (id)
);

create table fin_invoices (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  number varchar(20) not null,
  doc_type char(2) not null check (doc_type in ('01', '03', '07', '08')),
  series char(4) not null,
  correlative integer not null,
  issue_date date not null default current_date,
  period char(7) not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  client_id uuid not null,
  customer_doc_type varchar(10) not null check (customer_doc_type in ('RUC', 'DNI', 'PASAPORTE', 'CE', 'SIN_DOC')),
  customer_doc_number varchar(20) not null,
  customer_name varchar(200) not null,
  customer_address varchar(255),
  customer_domiciled boolean not null default true,
  reservation_id uuid not null,
  receivable_id uuid,
  operation_type varchar(20) not null default 'gravada' check (operation_type in ('gravada', 'exportacion')),
  sunat_operation_code varchar(4),
  currency char(3) not null check (currency in ('PEN','USD')),
  fx_rate numeric(12,6),
  taxable_amount numeric(14,2) not null,
  igv_amount numeric(14,2) not null,
  exempt_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null check (total_amount > 0),
  amount_in_words varchar(255) not null,
  description varchar(500) not null,
  ref_invoice_id uuid,
  credit_note_reason_code char(2),
  credit_note_reason varchar(255),
  status varchar(20) not null default 'pendiente_envio' check (status in ('pendiente_envio', 'emitido', 'aceptado', 'observado', 'rechazado', 'anulado')),
  fiscal_provider varchar(30),
  ose_ticket varchar(80),
  ose_response_code varchar(10),
  ose_response_message text,
  ose_responded_at timestamptz,
  xml_document_id uuid,
  cdr_document_id uuid,
  pdf_document_id uuid,
  hash_code varchar(64),
  delivered_at timestamptz,
  issued_by uuid not null,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_invoices primary key (id),
  constraint ck_fin_invoices_1 check (doc_type not in ('07','08') or ref_invoice_id is not null),
  constraint ck_fin_invoices_2 check (currency <> 'USD' or fx_rate is not null)
);

create table fin_invoice_lines (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  invoice_id uuid not null,
  line_no smallint not null default 1,
  description varchar(500) not null,
  quantity numeric(12,3) not null default 1,
  unit_code varchar(3) not null default 'ZZ',
  unit_value numeric(14,2) not null,
  igv_affectation varchar(2) not null default '10' check (igv_affectation in ('10', '40')),
  line_amount numeric(14,2) not null,
  igv_amount numeric(14,2) not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_invoice_lines primary key (id)
);

create table fin_fiscal_events (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  invoice_id uuid not null,
  action varchar(20) not null check (action in ('send', 'status', 'resend', 'void')),
  attempt smallint not null default 1,
  request_hash varchar(64),
  response_code varchar(10),
  response_message text,
  payload_document_id uuid,
  status varchar(20) not null check (status in ('ok', 'error_temporal', 'error_definitivo')),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_fin_fiscal_events primary key (id)
);

create table fin_bank_statements (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  bank varchar(20) not null,
  bank_account_id uuid,
  filename varchar(200) not null,
  document_id uuid,
  format varchar(10) not null check (format in ('csv', 'txt', 'xlsx')),
  lines_count integer not null default 0,
  imported_by uuid not null,
  imported_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_bank_statements primary key (id)
);

create table fin_reconciliation_closures (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  period char(7) not null,
  closed_at timestamptz not null default now(),
  closed_by uuid not null,
  lines_count integer not null,
  credits numeric(14,2) not null,
  debits numeric(14,2) not null,
  net numeric(14,2) not null,
  matched_count integer not null,
  others_count integer not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_reconciliation_closures primary key (id)
);

create table fin_bank_lines (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  statement_id uuid,
  bank varchar(20) not null,
  value_date date not null,
  description varchar(255) not null,
  amount numeric(14,2) not null check (amount <> 0),
  currency char(3) not null default 'PEN',
  matched_payment_id uuid,
  matched_payable_id uuid,
  status varchar(20) not null default 'pendiente' check (status in ('pendiente', 'sugerido', 'excepcion', 'conciliado')),
  resolution varchar(20) check (resolution is null or resolution in ('match', 'asignado', 'otro_ingreso', 'gasto_bancario')),
  resolution_note text,
  resolved_by uuid,
  closure_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_bank_lines primary key (id),
  constraint ck_fin_bank_lines_1 check (num_nonnulls(matched_payment_id, matched_payable_id) <= 1)
);

create table fin_period_closes (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  period char(7) not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  status varchar(10) not null default 'abierto' check (status in ('abierto', 'cerrado')),
  closed_at timestamptz,
  closed_by uuid,
  snapshot jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_period_closes primary key (id)
);

create table fin_period_close_checks (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  period_close_id uuid not null,
  check_code varchar(20) not null check (check_code in ('fx', 'aging', 'igv')),
  checked_by uuid not null,
  checked_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_period_close_checks primary key (id)
);

create table channel_b2b_price_lists (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  name varchar(80) not null,
  year smallint,
  status varchar(30) not null default 'activa' check (status in ('activa', 'inactiva')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_b2b_price_lists primary key (id)
);

create table channel_b2b_agencies (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  legal_name varchar(200) not null,
  ruc char(11) not null check (ruc ~ '^[0-9]{11}$'),
  contact_name varchar(150) not null,
  booking_email varchar(190),
  crm_client_id uuid,
  price_list_id uuid not null,
  commission_pct numeric(5,2) not null check (commission_pct between 0 and 30),
  credit_currency char(3) not null check (credit_currency in ('PEN','USD')),
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  credit_used numeric(14,2) not null default 0 check (credit_used >= 0),
  valid_from date not null,
  valid_to date not null,
  status varchar(30) not null default 'activa' check (status in ('activa', 'bloqueada', 'inactiva')),
  block_reason varchar(30) check (block_reason is null or block_reason in ('manual', 'credito_excedido')),
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_channel_b2b_agencies primary key (id),
  constraint ck_channel_b2b_agencies_1 check (valid_to >= valid_from)
);

create table catalog_product_b2b_rates (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  agency_id uuid not null,
  price_list_id uuid,
  price_list varchar(80),
  price numeric(14,2) not null check (price >= 0),
  currency char(3) not null check (currency in ('PEN','USD')),
  commission_pct numeric(5,2) not null default 10 check (commission_pct >= 0),
  is_credit boolean not null default false,
  valid_to date,
  conditions varchar(300),
  restrictions varchar(300),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_catalog_product_b2b_rates primary key (id)
);

create table channel_b2b_settlement_requests (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  agency_id uuid not null,
  amount_pen numeric(14,2) not null,
  fx_rate numeric(12,6) not null,
  commission_ids uuid[] not null default '{}',
  status varchar(30) not null default 'solicitada' check (status in ('solicitada', 'aprobada', 'rechazada', 'pagada')),
  requested_by uuid not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_b2b_settlement_requests primary key (id)
);

create table channel_b2b_credit_movements (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  agency_id uuid not null,
  movement_type varchar(30) not null check (movement_type in ('cargo_reserva', 'pago_aplicado', 'reversion_pago', 'anulacion_reserva', 'ajuste')),
  reservation_id uuid,
  payment_id uuid,
  amount numeric(14,2) not null,
  currency char(3) not null,
  source_amount numeric(14,2),
  source_currency char(3),
  fx_rate numeric(12,6),
  balance_after numeric(14,2) not null,
  note varchar(250),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_channel_b2b_credit_movements primary key (id)
);

create table channel_b2b_credit_exceptions (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  agency_id uuid not null,
  approval_request_id uuid,
  amount numeric(14,2) not null,
  valid_until date,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_channel_b2b_credit_exceptions primary key (id)
);

create table cms_contents (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  title varchar(200) not null,
  type varchar(30) not null check (type in ('Página', 'Artículo', 'Banner', 'Página legal', 'Landing')),
  channel varchar(40) not null check (channel in ('Web', 'Web / E-commerce', 'Web / Portal', 'Portal cliente', 'Portal pasajero', 'App pasajero')),
  slug varchar(60) not null,
  body text not null,
  seo_title varchar(60),
  seo_description varchar(160),
  status varchar(30) not null default 'borrador' check (status in ('borrador', 'en_revision', 'aprobado', 'publicado', 'despublicado')),
  author_id uuid not null,
  published_at timestamptz,
  unpublished_at timestamptz,
  placement varchar(40),
  valid_from date,
  valid_to date,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_cms_contents primary key (id),
  constraint ck_cms_contents_1 check (status <> 'publicado' or seo_title is not null)
);

create table cms_content_events (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  content_id uuid not null,
  occurred_at timestamptz not null default now(),
  user_id uuid not null,
  from_status varchar(30),
  to_status varchar(30),
  message varchar(300) not null,
  reason varchar(300),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_cms_content_events primary key (id)
);

create table channel_ecom_orders (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  ordered_at timestamptz not null default now(),
  crm_client_id uuid not null,
  customer_name varchar(150) not null,
  customer_email varchar(190) not null,
  customer_phone varchar(40),
  customer_country varchar(60),
  product_id uuid,
  departure_id uuid,
  service_date date,
  pax_adults smallint check (pax_adults >= 1),
  pax_children smallint default 0,
  pax_total smallint generated always as (coalesce(pax_adults, 0) + coalesce(pax_children, 0)) stored,
  config_snapshot jsonb not null default '[]',
  price_snapshot jsonb not null default '{}',
  promo_code varchar(40),
  promotion_id uuid,
  discount_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null,
  currency char(3) not null check (currency in ('PEN','USD')),
  fx_rate numeric(12,6) not null default 1,
  cost_total numeric(14,2) not null default 0,
  reservation_id uuid,
  reservation_ids uuid[] not null default '{}',
  receivable_id uuid,
  status varchar(30) not null default 'pago_pendiente' check (status in ('pago_pendiente', 'pago_por_validar', 'pago_rechazado', 'confirmado', 'cancelado', 'expirado')),
  hold_expires_at timestamptz,
  cancel_reason varchar(300),
  buyer_snapshot jsonb not null default '{}',
  utm jsonb,
  cart_id uuid,
  sales_channel varchar(20) not null default 'sitio_web' check (sales_channel in ('sitio_web', 'tienda_backoffice')),
  locale varchar(5) not null default 'es',
  pay_mode varchar(10) not null default 'total' check (pay_mode in ('total', 'anticipo')),
  deposit_pct numeric(5,2) not null default 100,
  amount_due_now numeric(14,2) not null default 0,
  balance_due_date date,
  billing jsonb not null default '{}',
  consents jsonb not null default '{}',
  access_token_hash char(64),
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_ecom_orders primary key (id),
  constraint ck_channel_ecom_orders_1 check (pay_mode <> 'anticipo' or balance_due_date is not null)
);

create table channel_ecom_order_lines (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  order_id uuid not null,
  line_no smallint not null,
  product_id uuid not null,
  product_version varchar(10) not null,
  service_date date not null,
  departure_id uuid,
  pax_adults smallint not null default 1,
  pax_children smallint not null default 0,
  pax_infants smallint not null default 0,
  rate_id uuid not null,
  season_id uuid,
  season_factor numeric(6,4) not null default 1,
  unit_adult numeric(14,2) not null,
  unit_child numeric(14,2) not null default 0,
  units smallint,
  config_snapshot jsonb not null default '[]',
  extras_snapshot jsonb not null default '[]',
  subtotal numeric(14,2) not null,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null,
  currency char(3) not null check (currency in ('PEN','USD')),
  promotion_id uuid,
  cost_total numeric(14,2) not null default 0,
  hold_id uuid,
  reservation_service_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_ecom_order_lines primary key (id)
);

create table channel_ecom_passengers (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  order_id uuid not null,
  position smallint not null,
  first_name varchar(80) not null,
  last_name varchar(80) not null,
  full_name varchar(161) generated always as (first_name || ' ' || last_name) stored,
  doc_type varchar(20) not null,
  doc_number varchar(30) not null,
  pax_type char(3) not null check (pax_type in ('ADT', 'CHD', 'INF')),
  birth_date date not null,
  nationality varchar(60) not null,
  diet varchar(120),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_ecom_passengers primary key (id)
);

create table channel_ecom_payment_attempts (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  order_id uuid not null,
  attempted_at timestamptz not null default now(),
  method varchar(20) not null default 'tarjeta' check (method in ('tarjeta', 'transferencia', 'yape', 'plin')),
  card_masked varchar(20),
  operation_ref varchar(60),
  result varchar(20) not null check (result in ('aprobado', 'rechazado', 'por_validar')),
  gateway_code varchar(20),
  message varchar(200),
  gateway_txn_id varchar(80),
  amount numeric(14,2),
  currency char(3),
  idempotency_key varchar(80),
  payment_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_channel_ecom_payment_attempts primary key (id)
);

create table channel_portal_access_links (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  passenger_id uuid,
  email varchar(190) not null,
  token_hash char(64) not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_channel_portal_access_links primary key (id)
);

create table ops_incident_pax_acks (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  incident_id uuid not null,
  user_id uuid not null,
  acknowledged_at timestamptz not null default now(),
  constraint pk_ops_incident_pax_acks primary key (id)
);

create table channel_pax_feedback (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(12) not null,
  reservation_id uuid not null,
  passenger_name varchar(150) not null,
  type varchar(20) not null check (type in ('comentario', 'sugerencia', 'felicitacion', 'reclamo', 'incidencia')),
  rating smallint check (rating between 1 and 5),
  reservation_service_id uuid,
  text varchar(1000) not null,
  status varchar(20) not null default 'nuevo' check (status in ('nuevo', 'leido', 'respondido', 'derivado')),
  reply text,
  replied_at timestamptz,
  replied_by uuid,
  conversation_id uuid,
  incident_id uuid,
  channel varchar(30),
  contact_email varchar(190),
  contact_phone varchar(40),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_pax_feedback primary key (id)
);

create table collab_approval_rules (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  request_type varchar(30) not null check (request_type in ('quote', 'cancel', 'reversal', 'payable', 'commission', 'provider_rate', 'credit_b2b', 'refund', 'other')),
  level smallint not null check (level in (1,2)),
  permission varchar(80) not null,
  min_amount_pen numeric(14,2) not null default 0,
  sla_hours smallint not null check (sla_hours between 1 and 720),
  forbid_self_approval boolean not null default true,
  is_active boolean not null default true,
  is_origin_locked boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_collab_approval_rules primary key (id)
);

create table collab_approval_requests (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  request_type varchar(30) not null check (request_type in ('quote', 'cancel', 'reversal', 'payable', 'commission', 'provider_rate', 'credit_b2b', 'refund', 'other')),
  is_generic boolean not null default false,
  subject_type varchar(40) check (subject_type is null or subject_type in ('quote_versions', 'booking_reservations', 'fin_payments', 'fin_payables', 'fin_commissions', 'supplier_rate_requests', 'channel_b2b_agencies')),
  subject_id uuid,
  subject_code varchar(40),
  subject_version integer,
  dedupe_key varchar(120) not null,
  title varchar(200) not null,
  justification text,
  requester_id uuid,
  requester_kind varchar(20) not null default 'user' check (requester_kind in ('user', 'supplier', 'system')),
  requester_supplier_id uuid,
  amount numeric(14,2) not null,
  currency char(3) not null check (currency in ('PEN','USD')),
  fx_rate numeric(12,6) not null,
  amount_base numeric(14,2) generated always as (round(amount * fx_rate, 2)) stored,
  status varchar(30) not null default 'pendiente' check (status in ('pendiente', 'info', 'aprobada', 'rechazada', 'anulada')),
  current_level smallint not null default 1 check (current_level between 1 and 2),
  total_levels smallint not null default 1,
  delegated_to uuid,
  due_at timestamptz,
  paused_at timestamptz,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  closed_in_origin boolean not null default false,
  origin_snapshot jsonb,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_collab_approval_requests primary key (id),
  constraint ck_collab_approval_requests_1 check (status <> 'rechazada' or decision_note is not null)
);

create table collab_approval_steps (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  request_id uuid not null,
  level smallint not null,
  rule_id uuid not null,
  decision varchar(20) not null check (decision in ('aprobada', 'rechazada')),
  decided_by uuid not null,
  note text,
  decided_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_collab_approval_steps primary key (id)
);

create table collab_approval_info_requests (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  request_id uuid not null,
  asked_by uuid not null,
  question text not null,
  asked_at timestamptz not null default now(),
  answer text,
  answered_by uuid,
  answered_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_collab_approval_info_requests primary key (id)
);

create table collab_approval_events (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  request_id uuid not null,
  event varchar(40) not null check (event in ('creada', 'aprobada_nivel', 'aprobada', 'rechazada', 'info_solicitada', 'info_respondida', 'delegada', 'retirada', 'reenviada', 'cerrada_en_origen', 'sla_advertencia', 'sla_vencido')),
  actor_id uuid,
  note text,
  payload jsonb,
  occurred_at timestamptz not null default now(),
  constraint pk_collab_approval_events primary key (id)
);

create table collab_channel_accounts (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  channel varchar(20) not null check (channel in ('whatsapp', 'email', 'webchat', 'form', 'portal')),
  name varchar(120) not null,
  credentials_encrypted text,
  webhook_secret_encrypted text,
  phone_number_id varchar(60),
  mailbox varchar(190),
  first_response_sla_minutes smallint not null default 240,
  status varchar(20) not null default 'sandbox' check (status in ('activo', 'sandbox', 'inactivo')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_collab_channel_accounts primary key (id)
);

create table collab_reply_templates (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  name varchar(120) not null,
  body text not null,
  channels text[] not null default '{}',
  is_whatsapp_approved boolean not null default false,
  whatsapp_template_name varchar(120),
  whatsapp_language char(5),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_collab_reply_templates primary key (id)
);

create table collab_conversations (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  channel varchar(20) not null check (channel in ('whatsapp', 'email', 'webchat', 'form', 'portal')),
  channel_account_id uuid,
  external_thread_id varchar(190),
  contact_name varchar(160) not null,
  contact_email citext,
  contact_phone varchar(30),
  subject varchar(200) not null,
  status varchar(20) not null default 'abierta' check (status in ('abierta', 'pendiente', 'resuelta')),
  priority varchar(10) not null default 'media' check (priority in ('baja', 'media', 'alta', 'critica')),
  tags text[] not null default '{}',
  assignee_id uuid,
  client_id uuid,
  lead_id uuid,
  reservation_id uuid,
  quote_id uuid,
  support_ticket_id uuid,
  feedback_id uuid,
  first_response_due_at timestamptz not null,
  first_response_at timestamptz,
  last_inbound_at timestamptz,
  last_message_at timestamptz not null default now(),
  unread_count integer not null default 0,
  resolved_at timestamptz,
  resolved_by uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_collab_conversations primary key (id)
);

create table collab_messages (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  conversation_id uuid not null,
  channel varchar(20) not null check (channel in ('whatsapp', 'email', 'webchat', 'form', 'portal')),
  direction varchar(10) not null check (direction in ('in', 'out', 'internal', 'system')),
  author_user_id uuid,
  body text not null,
  template_id uuid,
  external_message_id varchar(190),
  delivery_status varchar(20) check (delivery_status is null or delivery_status in ('encolado', 'enviado', 'entregado', 'leido', 'fallido')),
  failure_reason text,
  sent_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_collab_messages primary key (id)
);

create table collab_message_attachments (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  message_id uuid not null,
  file_name varchar(200) not null,
  mime varchar(100) not null,
  size_bytes integer not null check (size_bytes <= 16777216),
  storage_path varchar(300) not null,
  sha256 char(64) not null,
  scan_status varchar(15) not null default 'pendiente' check (scan_status in ('pendiente', 'limpio', 'infectado')),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_collab_message_attachments primary key (id)
);

create table collab_inbound_events (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  channel varchar(20) not null check (channel in ('whatsapp', 'email', 'webchat', 'form', 'portal')),
  external_event_id varchar(190) not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status varchar(20) not null default 'recibido' check (status in ('recibido', 'procesado', 'duplicado', 'error')),
  error text,
  constraint pk_collab_inbound_events primary key (id)
);

create table catalog_allotments (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  provider_id uuid not null,
  service_id uuid not null,
  kind varchar(20) not null check (kind in ('hotel', 'tren', 'entrada')),
  name varchar(150) not null,
  contract_ref varchar(80),
  valid_from date not null,
  valid_to date not null,
  base_qty integer not null check (base_qty > 0),
  release_days smallint not null check (release_days between 0 and 120),
  net_rate numeric(14,2) not null check (net_rate >= 0),
  currency char(3) not null check (currency in ('PEN','USD')),
  penalty_pct numeric(5,2) not null default 0 check (penalty_pct between 0 and 100),
  status varchar(20) not null default 'activo' check (status in ('activo', 'en_release', 'liberado', 'vencido')),
  owner_id uuid not null,
  notes text,
  released_at timestamptz,
  release_reason text,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_catalog_allotments primary key (id),
  constraint ck_catalog_allotments_1 check (valid_to >= valid_from)
);

create table catalog_allotment_days (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  allotment_id uuid not null,
  service_date date not null,
  blocked_qty integer not null check (blocked_qty >= 0),
  released_qty integer not null default 0,
  used_qty integer not null default 0 check (used_qty >= 0),
  pending_qty integer not null default 0,
  release_deadline date not null,
  retained_reason varchar(200),
  retained_by uuid,
  retained_at timestamptz,
  closed_at timestamptz,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_allotment_days primary key (id),
  constraint ck_catalog_allotment_days_1 check (released_qty between 0 and blocked_qty)
);

create table catalog_allotment_consumptions (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  allotment_day_id uuid not null,
  booking_service_id uuid not null,
  reservation_id uuid not null,
  qty integer not null check (qty > 0),
  state varchar(15) not null check (state in ('consumido', 'en_tramite', 'revertido')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_allotment_consumptions primary key (id)
);

create table catalog_allotment_requests (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  allotment_id uuid not null,
  date_from date not null,
  date_to date not null,
  extra_qty integer not null check (extra_qty > 0),
  note text not null,
  status varchar(15) not null default 'solicitada' check (status in ('solicitada', 'aceptada', 'rechazada')),
  response text,
  responded_at timestamptz,
  responded_by uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_allotment_requests primary key (id),
  constraint ck_catalog_allotment_requests_1 check (date_to >= date_from)
);

create table catalog_allotment_charges (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  allotment_day_id uuid not null,
  qty integer not null,
  amount numeric(14,2) not null,
  currency char(3) not null check (currency in ('PEN','USD')),
  fx_rate numeric(12,6),
  reason varchar(200) not null,
  payable_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_allotment_charges primary key (id)
);

create table catalog_allotment_events (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  allotment_id uuid not null,
  occurred_at timestamptz not null default now(),
  user_id uuid,
  message varchar(300) not null,
  constraint pk_catalog_allotment_events primary key (id)
);

create table ops_travel_doc_items (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  passenger_id uuid not null,
  doc_type varchar(20) not null check (doc_type in ('id_doc', 'visa', 'insurance', 'yellow_fever', 'minor_auth', 'migration', 'emergency', 'special')),
  status varchar(15) not null default 'pendiente' check (status in ('pendiente', 'recibido', 'completo', 'observado')),
  doc_number varchar(40),
  expiry_date date,
  file_id uuid,
  file_name varchar(200),
  uploaded_by_type varchar(10) check (uploaded_by_type is null or uploaded_by_type in ('user', 'client', 'agency')),
  observation text,
  validated_by uuid,
  validated_at timestamptz,
  note varchar(300),
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_ops_travel_doc_items primary key (id)
);

create table ops_travel_doc_contacts (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  passenger_id uuid not null,
  name varchar(150) not null,
  phone varchar(30) not null,
  relation varchar(20) not null check (relation in ('Familiar', 'Pareja', 'Amigo(a)', 'Empresa', 'Otro')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_ops_travel_doc_contacts primary key (id)
);

create table ops_travel_doc_special (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  passenger_id uuid not null,
  requires_attention boolean not null default false,
  operational_note varchar(300),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_ops_travel_doc_special primary key (id)
);

create table ops_travel_doc_reminders (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  sent_at timestamptz not null default now(),
  sent_on date not null default current_date,
  channels varchar(40) not null,
  recipient varchar(190) not null,
  trigger varchar(20) not null check (trigger in ('auto', 'manual')),
  days_before smallint,
  items_count smallint not null default 0,
  sent_by uuid,
  notification_ids uuid[] not null default '{}',
  constraint pk_ops_travel_doc_reminders primary key (id)
);

create table fin_treasury_accounts (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  kind varchar(20) not null check (kind in ('bank', 'petty_cash', 'gateway')),
  bank varchar(40),
  name varchar(120) not null,
  account_number varchar(40),
  cci varchar(25),
  currency char(3) not null check (currency in ('PEN','USD')),
  sede_id uuid not null,
  fund_amount numeric(14,2),
  custodian_id uuid,
  settle_to_account_id uuid,
  opening_balance numeric(14,2) not null default 0,
  opening_rate numeric(12,6),
  opening_date date not null,
  status varchar(20) not null default 'active' check (status in ('active', 'inactive')),
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_fin_treasury_accounts primary key (id),
  constraint ck_fin_treasury_accounts_1 check (kind <> 'petty_cash' or (fund_amount is not null and custodian_id is not null)),
  constraint ck_fin_treasury_accounts_2 check (kind <> 'gateway' or settle_to_account_id is not null)
);

create table fin_treasury_transfers (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount_from numeric(14,2) not null,
  amount_to numeric(14,2) not null,
  deal_rate numeric(12,6),
  kind varchar(20) not null check (kind in ('transfer', 'replenishment', 'gateway_settlement', 'cash_deposit')),
  transfer_date date not null,
  reference varchar(80) not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_treasury_transfers primary key (id),
  constraint ck_fin_treasury_transfers_1 check (from_account_id <> to_account_id)
);

create table fin_cash_replenishments (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  account_id uuid not null,
  amount numeric(14,2) not null,
  status varchar(15) not null default 'requested' check (status in ('requested', 'approved', 'paid', 'rejected')),
  requested_by uuid,
  requested_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  paid_by uuid,
  paid_at timestamptz,
  paid_from_account_id uuid,
  transfer_id uuid,
  reject_reason text,
  note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_cash_replenishments primary key (id),
  constraint ck_fin_cash_replenishments_1 check (approved_by is null or approved_by <> requested_by)
);

create table fin_cash_replenishment_events (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  replenishment_id uuid not null,
  from_status varchar(15),
  to_status varchar(15) not null,
  note text,
  user_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_fin_cash_replenishment_events primary key (id)
);

create table fin_treasury_movements (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  account_id uuid not null,
  movement_date date not null,
  direction char(3) not null check (direction in ('in', 'out')),
  type varchar(30) not null check (type in ('collection', 'collection_reversal', 'supplier_payment', 'transfer', 'petty_expense', 'replenishment', 'gateway_settlement', 'gateway_fee', 'count_adjustment', 'other_income', 'other_expense')),
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null,
  fx_rate numeric(12,6),
  orig_amount numeric(14,2),
  orig_currency char(3),
  orig_fx_rate numeric(12,6),
  source_type varchar(30) not null check (source_type in ('payment', 'payment_reversal', 'payout', 'payable', 'transfer', 'expense', 'replenishment', 'gateway', 'cash_count', 'manual')),
  source_id uuid,
  source_key varchar(60),
  transfer_id uuid,
  replenishment_id uuid,
  reservation_id uuid,
  category varchar(60),
  description varchar(255) not null,
  reference varchar(80),
  counterparty varchar(160),
  sede_id uuid,
  deposited_transfer_id uuid,
  status varchar(20) not null default 'posted' check (status in ('posted', 'voided')),
  void_reason text,
  voided_by uuid,
  voided_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_treasury_movements primary key (id),
  constraint ck_fin_treasury_movements_1 check (status <> 'voided' or (void_reason is not null and voided_by is not null and voided_at is not null))
);

create table fin_expense_receipts (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  movement_id uuid not null,
  receipt_type varchar(30) not null check (receipt_type in ('invoice', 'sales_receipt', 'ticket', 'fee_receipt', 'mobility_sheet', 'sworn_statement')),
  series_number varchar(30),
  issuer_ruc char(11) check (issuer_ruc ~ '^[0-9]{11}$'),
  supplier_name varchar(160) not null,
  file_path varchar(255),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_expense_receipts primary key (id),
  constraint ck_fin_expense_receipts_1 check (receipt_type in ('mobility_sheet','sworn_statement') or series_number is not null),
  constraint ck_fin_expense_receipts_2 check (receipt_type not in ('invoice','fee_receipt') or issuer_ruc is not null)
);

create table fin_cash_sessions (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  account_id uuid not null,
  session_date date not null,
  opened_at timestamptz not null default now(),
  opened_by uuid not null,
  opening_amount numeric(14,2) not null,
  closed_at timestamptz,
  closed_by uuid,
  closing_count_id uuid,
  status varchar(10) not null default 'open' check (status in ('open', 'closed')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_cash_sessions primary key (id),
  constraint ck_fin_cash_sessions_1 check (status <> 'closed' or closing_count_id is not null)
);

create table fin_cash_counts (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  account_id uuid not null,
  session_id uuid,
  kind varchar(10) not null check (kind in ('surprise', 'closing')),
  counted_at timestamptz not null default now(),
  denominations jsonb not null,
  counted_amount numeric(14,2) not null,
  expected_amount numeric(14,2) not null,
  difference numeric(14,2) not null,
  result varchar(10) not null check (result in ('balanced', 'over', 'short')),
  note text,
  signed_by uuid not null,
  signed_at timestamptz not null default now(),
  witness_id uuid,
  status varchar(25) not null default 'signed' check (status in ('signed', 'pending_approval', 'approved', 'validated')),
  approved_by uuid,
  approved_at timestamptz,
  approve_note text,
  validated_by uuid,
  validated_at timestamptz,
  adjustment_movement_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_cash_counts primary key (id),
  constraint ck_fin_cash_counts_1 check (difference = counted_amount - expected_amount),
  constraint ck_fin_cash_counts_2 check (difference = 0 or note is not null),
  constraint ck_fin_cash_counts_3 check (approved_by is null or approved_by <> signed_by)
);

create table fin_fx_revaluations (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  account_id uuid not null,
  period char(7) not null,
  revaluation_date date not null,
  balance_usd numeric(14,2) not null,
  book_rate numeric(12,6) not null,
  close_rate numeric(12,6) not null,
  diff_pen numeric(14,2) not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_fx_revaluations primary key (id)
);

create table fin_treasury_settings (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  petty_tolerance numeric(14,2) not null default 10.00,
  max_petty_expense numeric(14,2) not null default 500.00,
  sworn_statement_max numeric(14,2) not null default 150.00,
  replenish_threshold_pct smallint not null default 40,
  gateway_fee_pct numeric(5,2) not null default 4.00,
  cash_deposit_hours smallint not null default 24,
  recurring_outflows jsonb not null default '[]',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_treasury_settings primary key (id)
);

create table sys_booking_rules (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(40) not null check (code ~ '^R-[A-Z0-9-]{2,38}$'),
  rule_group varchar(40) not null,
  name varchar(160) not null,
  description text not null,
  enabled boolean not null default false,
  params jsonb not null default '{}',
  params_schema jsonb not null default '{}',
  scope text[] not null default '{}',
  product_override boolean not null default false,
  is_custom boolean not null default false,
  depends_on varchar(40),
  min_plan varchar(20) not null default 'Starter' check (min_plan in ('Starter', 'Professional', 'Enterprise')),
  sort_order smallint not null default 0,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_sys_booking_rules primary key (id),
  constraint ck_sys_booking_rules_1 check (is_custom or rule_group in ('Disponibilidad','Pasajeros','Alojamiento','Adicionales','Precios','Monedas y pagos','Checkout','Comunicación'))
);

create table catalog_product_rule_overrides (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  rule_code varchar(40) not null,
  disabled boolean not null default false,
  params jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_rule_overrides primary key (id)
);

create table catalog_product_addons (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  code varchar(20) not null,
  name varchar(150) not null,
  category varchar(20) not null check (category in ('Museo', 'Entrada', 'Alimentación', 'Transporte', 'Extensión', 'Seguro', 'Experiencia', 'Servicio', 'Otro')),
  price numeric(14,2) not null check (price >= 0),
  currency char(3) not null,
  charge_per varchar(10) not null check (charge_per in ('pax', 'reserva')),
  applies_to varchar(3)[] not null default '{ADT}' check (cardinality(applies_to) >= 1 and applies_to <@ array['ADT','CHD','INF']::varchar[]),
  stock_note varchar(200),
  provider_id uuid,
  service_id uuid,
  is_optional boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_catalog_product_addons primary key (id)
);

create table catalog_accommodation_legs (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  code varchar(20) not null,
  sequence smallint not null,
  city varchar(80) not null,
  destination_id uuid,
  nights smallint not null check (nights between 1 and 30),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_accommodation_legs primary key (id)
);

create table catalog_accommodation_hotels (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  leg_id uuid not null,
  code varchar(20) not null,
  name varchar(150) not null,
  category varchar(30) not null,
  provider_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_accommodation_hotels primary key (id)
);

create table catalog_accommodation_room_types (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  hotel_id uuid not null,
  room_type varchar(20) not null,
  capacity smallint not null check (capacity between 1 and 8),
  price_per_night numeric(14,2) not null check (price_per_night > 0),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_accommodation_room_types primary key (id)
);

create table catalog_payment_policies (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  modes varchar(15)[] not null default '{total}' check (cardinality(modes) >= 1 and modes <@ array['total','adelanto']::varchar[]),
  deposit_pct numeric(5,2) check (deposit_pct between 1 and 99),
  balance_due_days smallint check (balance_due_days between 0 and 180),
  note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_payment_policies primary key (id)
);

create table catalog_pickup_points (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  sequence smallint not null default 0,
  label varchar(150) not null,
  kind varchar(20) not null default 'punto_encuentro' check (kind in ('aeropuerto', 'hotel', 'punto_encuentro', 'terminal', 'por_cuenta')),
  requires_address boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_pickup_points primary key (id)
);

create table booking_reservation_web_snapshots (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  product_id uuid not null,
  service_date date not null,
  pax_adt smallint not null default 0 check (pax_adt >= 0),
  pax_chd smallint not null default 0 check (pax_chd >= 0),
  pax_inf smallint not null default 0 check (pax_inf >= 0),
  currency_display char(3) not null,
  charge_currency char(3) not null,
  fx_rate numeric(12,6) not null,
  lines jsonb not null,
  adjustments jsonb not null default '[]',
  removed_lines jsonb,
  total numeric(14,2) not null,
  total_display numeric(14,2),
  rooms_total smallint,
  nights_total smallint,
  pickup_point varchar(200),
  pickup_address varchar(200),
  pickup_flight varchar(40),
  pickup_arrival timestamptz,
  comments varchar(1000),
  payment_mode varchar(20) not null check (payment_mode in ('total', 'adelanto', 'pagar_despues')),
  deposit_pct numeric(5,2),
  deposit numeric(14,2),
  balance numeric(14,2),
  balance_due date,
  companions_pending boolean,
  companions_due date,
  altitude_declaration jsonb,
  rules_applied text[] not null default '{}',
  source varchar(30),
  order_code varchar(30),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_booking_reservation_web_snapshots primary key (id)
);

create table booking_reservation_web_lodging (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  snapshot_id uuid not null,
  leg_id varchar(20),
  city varchar(80) not null,
  hotel_id uuid,
  hotel_name varchar(150) not null,
  room_type varchar(30) not null,
  rooms smallint not null check (rooms > 0),
  nights smallint not null check (nights > 0),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_booking_reservation_web_lodging primary key (id)
);

create table booking_reservation_web_addons (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  snapshot_id uuid not null,
  addon_id uuid,
  name varchar(150) not null,
  qty smallint not null default 1,
  amount numeric(14,2) not null,
  by_type jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_booking_reservation_web_addons primary key (id)
);

create table notif_pax_message_templates (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  name varchar(120) not null,
  event varchar(30) not null check (event in ('reserva_confirmada', 'saldo_vence', 'viaje', 'fin_viaje', 'cambio_horario', 'cumpleanos')),
  offset_hours integer not null default 0 check (offset_hours between -720 and 720),
  offset_from_rule boolean not null default false,
  channels text[] not null check (cardinality(channels) >= 1 and channels <@ array['email','whatsapp','portal','push']),
  subject varchar(200),
  body text not null,
  lang char(2) not null default 'ES' check (lang in ('ES', 'EN')),
  group_code varchar(20),
  conditions jsonb not null default '{}',
  whatsapp_template_name varchar(120),
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_notif_pax_message_templates primary key (id)
);

create table notif_pax_messages (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  reservation_id uuid,
  template_id uuid,
  feedback_id uuid,
  channel varchar(10) not null check (channel in ('email', 'whatsapp', 'portal', 'push')),
  recipient varchar(200) not null,
  subject text,
  body text,
  status varchar(15) not null default 'programado' check (status in ('programado', 'enviado', 'entregado', 'leido', 'fallido', 'cancelado')),
  direction varchar(10) not null default 'saliente' check (direction in ('saliente', 'entrante')),
  origin varchar(10) not null default 'auto' check (origin in ('auto', 'manual', 'prueba')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  attempts smallint not null default 0,
  provider_message_id varchar(120),
  error text,
  lang char(2) not null default 'ES',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_notif_pax_messages primary key (id)
);

create table fin_currencies (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code char(3) not null,
  name varchar(60) not null,
  symbol varchar(8) not null,
  active boolean not null default true,
  is_base boolean not null default false,
  is_charge boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_currencies primary key (id),
  constraint ck_fin_currencies_1 check (not is_charge or active)
);

create table fx_rate_providers (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  name varchar(120) not null,
  kind varchar(20) not null check (kind in ('Simulado', 'Oficial', 'API', 'Manual')),
  status varchar(20) not null default 'por_validar' check (status in ('activo', 'por_validar', 'inactivo', 'error')),
  schedule_cron varchar(40),
  secret_ref varchar(200),
  last_run_at timestamptz,
  last_error text,
  note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fx_rate_providers primary key (id)
);

create table channel_widget_config (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  tenant_slug varchar(60) not null,
  public_key varchar(40) not null,
  public_key_prev varchar(40),
  prev_expires_at timestamptz,
  defaults jsonb not null default '{}',
  reviews_widget jsonb not null default '{}',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_widget_config primary key (id)
);

create table channel_widget_domains (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  domain varchar(253) not null check (domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$'),
  cms varchar(40),
  status varchar(20) not null default 'pendiente' check (status in ('pendiente', 'verificado')),
  verify_token varchar(60) not null,
  verified_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_widget_domains primary key (id)
);

create table channel_web_carts (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  token_hash char(64) not null,
  crm_client_id uuid,
  promo_code varchar(40),
  currency char(3) not null check (currency in ('PEN','USD')),
  locale varchar(5) not null default 'es' check (locale in ('es', 'en')),
  status varchar(20) not null default 'activo' check (status in ('activo', 'convertido', 'abandonado', 'expirado')),
  order_id uuid,
  utm jsonb,
  last_activity_at timestamptz not null default now(),
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_web_carts primary key (id)
);

create table channel_web_cart_items (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  cart_id uuid not null,
  line_no smallint not null,
  product_id uuid not null,
  service_date date not null,
  departure_id uuid,
  pax_adults smallint not null default 1,
  pax_children smallint not null default 0,
  pax_infants smallint not null default 0,
  options jsonb not null default '{}',
  extras jsonb not null default '{}',
  addons jsonb,
  lodging jsonb,
  no_lodging boolean not null default false,
  removed_line_keys text[] not null default '{}',
  source varchar(10) not null default 'sitio' check (source in ('sitio', 'widget')),
  hold_id uuid,
  hold_expires_at timestamptz,
  added_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_web_cart_items primary key (id),
  constraint ck_channel_web_cart_items_1 check (pax_adults >= 1 and pax_children >= 0 and pax_infants >= 0 and pax_infants <= pax_adults)
);

create table channel_widget_handoffs (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  product_id uuid not null,
  service_date date not null,
  pax jsonb not null,
  addons jsonb,
  lodging jsonb,
  removed text[] not null default '{}',
  currency_display char(3) not null,
  fx_rate numeric(12,6) not null,
  payment_mode varchar(15),
  lang char(2) not null default 'es',
  origin_domain varchar(253),
  quote_snapshot jsonb,
  rules_applied text[] not null default '{}',
  status varchar(20) not null default 'pendiente' check (status in ('pendiente', 'en_carrito', 'convertido', 'expirado')),
  cart_id uuid,
  expires_at timestamptz not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_widget_handoffs primary key (id)
);

create table channel_wishlist_items (
  tenant_id uuid not null default app_current_tenant_id(),
  crm_client_id uuid not null,
  product_id uuid not null,
  created_at timestamptz not null default now(),
  constraint pk_channel_wishlist_items primary key (tenant_id, crm_client_id, product_id)
);

create table channel_web_events (
  tenant_id uuid not null default app_current_tenant_id(),
  id bigint generated always as identity,
  occurred_at timestamptz not null default now(),
  session_id varchar(40) not null,
  client_id uuid,
  event varchar(40) not null,
  params jsonb not null default '{}',
  locale varchar(5) not null,
  currency char(3) not null,
  utm jsonb,
  constraint pk_channel_web_events primary key (id, occurred_at)
) partition by range (occurred_at);

do $$ begin perform app_create_monthly_partitions('channel_web_events', date '2026-01-01', 24); end $$;

create table catalog_product_translations (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  locale varchar(5) not null,
  name varchar(160) not null,
  short text,
  long text,
  itinerary jsonb,
  inclusions jsonb,
  exclusions jsonb,
  requirements jsonb,
  faqs jsonb,
  seo_title varchar(120),
  seo_description varchar(320),
  slug varchar(160) not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_translations primary key (id)
);

create table catalog_destination_contents (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  destination_id uuid not null,
  locale varchar(5) not null,
  slug varchar(160) not null,
  tagline varchar(200),
  description text,
  climate text,
  altitude_text varchar(120),
  faqs jsonb,
  hero_media_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_destination_contents primary key (id)
);


-- ---------------------------------------------------------------- columnas agregadas a tablas de fases previas
alter table iam_users add column provider_role varchar(20) check (provider_role is null or provider_role in ('admin', 'reservas', 'recepcion', 'contabilidad'));
alter table iam_users add column created_via varchar(20) not null default 'backoffice' check (created_via in ('backoffice', 'sitio_web'));
alter table iam_users add column email_verified_at timestamptz;
alter table catalog_services add column scheduled_cost numeric(14,2);
alter table catalog_services add column scheduled_cost_from date;
alter table catalog_products add column accommodation_enabled boolean not null default false;
alter table catalog_products add column accommodation_optional boolean not null default true;
alter table catalog_products add column accommodation_currency char(3);
alter table catalog_products add column accommodation_note text;
alter table catalog_products add column pickup_required boolean not null default false;
alter table catalog_products add column pickup_ask_flight boolean not null default false;
alter table catalog_products add column difficulty varchar(30) check (difficulty is null or difficulty in ('facil', 'moderada', 'moderada_exigente', 'exigente'));
alter table catalog_products add column guide_languages char(2)[] not null default '{}';
alter table catalog_products add column pickup_text varchar(200);
alter table catalog_products add column rating_avg numeric(3,2);
alter table catalog_products add column rating_count integer not null default 0;
alter table catalog_product_media add column alt_i18n jsonb;
alter table catalog_product_media add column caption_i18n jsonb;
alter table catalog_product_media add column width integer;
alter table catalog_product_media add column height integer;
alter table catalog_product_media add column blurhash varchar(60);
alter table crm_clients add column consents jsonb;
alter table crm_leads add column web_request jsonb;
alter table crm_leads add column matched_client_id uuid;
alter table crm_leads add column sla_due_at timestamptz;
alter table crm_leads add column consent jsonb;
alter table quote_versions add column approval_request_id uuid;
alter table booking_reservations add column ecom_order_id uuid;
alter table booking_reservations add column b2b_terms jsonb;
alter table booking_reservations add column cancel_request_id uuid;
alter table booking_passengers add column pending boolean not null default false;
alter table booking_reservation_services add column pax_detail jsonb;
alter table booking_reservation_services add column kind varchar(20) check (kind is null or kind in ('adicional', 'alojamiento', 'recargo'));
alter table booking_reservation_services add column addon_id uuid;
alter table booking_reservation_services add column rooms smallint;
alter table booking_reservation_services add column nights smallint;
alter table ops_incidents add column public_title varchar(200);
alter table ops_incidents add column public_message text;
alter table fin_payments add column reversal_request_id uuid;
alter table fin_payables add column approval_round smallint not null default 1;
alter table fin_payables add column observation text;
alter table fin_commissions add column settlement_request_id uuid;
alter table fin_commissions add column approval_round smallint not null default 1;
alter table fin_commissions add column observation text;
alter table fin_fx_rates add column provider_id uuid;
alter table fin_fx_rates add column daily_change_pct numeric(7,3);
alter table fin_fx_rates add column alert_raised boolean not null default false;
alter table fin_fx_rates add column is_demo boolean not null default false;

-- ---------------------------------------------------------------- unicidad (índices únicos, incluidos parciales)
create unique index uq_ops_mobile_devices_expo_push_token_p on ops_mobile_devices (expo_push_token) where expo_push_token is not null;
create unique index uq_ops_sync_actions_tenant_id_id on ops_sync_actions (tenant_id, id);
create unique index uq_supplier_invoices_tenant_id_provider_id_number on supplier_invoices (tenant_id, provider_id, number);
create unique index uq_supplier_invoices_tenant_id_payable_id_p on supplier_invoices (tenant_id, payable_id) where status in ('registrada','validada') and deleted_at is null;
create unique index uq_supplier_rate_requests_tenant_id_code on supplier_rate_requests (tenant_id, code);
create unique index uq_supplier_rate_requests_tenant_id_service_id_p on supplier_rate_requests (tenant_id, service_id) where status = 'pendiente';
create unique index uq_fin_document_series_tenant_id_series on fin_document_series (tenant_id, series);
create unique index uq_fin_invoices_tenant_id_number on fin_invoices (tenant_id, number);
create unique index uq_fin_invoices_tenant_id_series_correlative on fin_invoices (tenant_id, series, correlative);
create unique index uq_fin_invoice_lines_invoice_id_line_no on fin_invoice_lines (invoice_id, line_no);
create unique index uq_fin_reconciliation_closures_tenant_id_code on fin_reconciliation_closures (tenant_id, code);
create unique index uq_fin_bank_lines_tenant_id_code on fin_bank_lines (tenant_id, code);
create unique index uq_fin_bank_lines_tenant_id_matched_payment_id_p on fin_bank_lines (tenant_id, matched_payment_id) where status <> 'excepcion' and matched_payment_id is not null;
create unique index uq_fin_bank_lines_tenant_id_matched_payable_id_p on fin_bank_lines (tenant_id, matched_payable_id) where status <> 'excepcion' and matched_payable_id is not null;
create unique index uq_fin_period_closes_tenant_id_period on fin_period_closes (tenant_id, period);
create unique index uq_fin_period_close_checks_period_close_id_check_code on fin_period_close_checks (period_close_id, check_code);
create unique index uq_channel_b2b_price_lists_tenant_id_name on channel_b2b_price_lists (tenant_id, name);
create unique index uq_channel_b2b_agencies_tenant_id_code on channel_b2b_agencies (tenant_id, code);
create unique index uq_channel_b2b_agencies_tenant_id_ruc_p on channel_b2b_agencies (tenant_id, ruc) where deleted_at is null;
create unique index uq_catalog_product_b2b_rates_tenant_id_product_id_agency_id_p on catalog_product_b2b_rates (tenant_id, product_id, agency_id) where deleted_at is null;
create unique index uq_channel_b2b_settlement_requests_tenant_id_code on channel_b2b_settlement_requests (tenant_id, code);
create unique index uq_cms_contents_tenant_id_code on cms_contents (tenant_id, code);
create unique index uq_cms_contents_tenant_id_slug_p on cms_contents (tenant_id, slug) where deleted_at is null;
create unique index uq_channel_ecom_orders_tenant_id_code on channel_ecom_orders (tenant_id, code);
create unique index uq_channel_ecom_order_lines_order_id_line_no on channel_ecom_order_lines (order_id, line_no);
create unique index uq_channel_ecom_passengers_order_id_doc_type_doc_number on channel_ecom_passengers (order_id, doc_type, doc_number);
create unique index uq_channel_ecom_passengers_order_id_position on channel_ecom_passengers (order_id, position);
create unique index uq_channel_ecom_payment_attempts_tenant_id_gateway_txn_id_p on channel_ecom_payment_attempts (tenant_id, gateway_txn_id) where gateway_txn_id is not null;
create unique index uq_channel_ecom_payment_attempts_tenant_id_idempotency_key_p on channel_ecom_payment_attempts (tenant_id, idempotency_key) where idempotency_key is not null;
create unique index uq_channel_portal_access_links_token_hash on channel_portal_access_links (token_hash);
create unique index uq_ops_incident_pax_acks_incident_id_user_id on ops_incident_pax_acks (incident_id, user_id);
create unique index uq_channel_pax_feedback_tenant_id_code on channel_pax_feedback (tenant_id, code);
create unique index uq_collab_approval_rules_tenant_id_code on collab_approval_rules (tenant_id, code);
create unique index uq_collab_approval_rules_tenant_id_request_type_level_mi_868e35 on collab_approval_rules (tenant_id, request_type, level, min_amount_pen) where deleted_at is null;
create unique index uq_collab_approval_requests_tenant_id_code on collab_approval_requests (tenant_id, code);
create unique index uq_collab_approval_requests_tenant_id_dedupe_key_p on collab_approval_requests (tenant_id, dedupe_key) where status in ('pendiente','info');
create unique index uq_collab_approval_steps_request_id_level on collab_approval_steps (request_id, level);
create unique index uq_collab_approval_steps_request_id_decided_by on collab_approval_steps (request_id, decided_by);
create unique index uq_collab_reply_templates_tenant_id_code on collab_reply_templates (tenant_id, code);
create unique index uq_collab_conversations_tenant_id_code on collab_conversations (tenant_id, code);
create unique index uq_collab_conversations_tenant_id_channel_external_thread_id_p on collab_conversations (tenant_id, channel, external_thread_id) where external_thread_id is not null;
create unique index uq_collab_conversations_support_ticket_id_p on collab_conversations (support_ticket_id) where support_ticket_id is not null;
create unique index uq_collab_messages_tenant_id_channel_external_message_id_p on collab_messages (tenant_id, channel, external_message_id) where external_message_id is not null;
create unique index uq_collab_inbound_events_channel_external_event_id on collab_inbound_events (channel, external_event_id);
create unique index uq_catalog_allotments_tenant_id_code on catalog_allotments (tenant_id, code);
create unique index uq_catalog_allotment_days_allotment_id_service_date on catalog_allotment_days (allotment_id, service_date);
create unique index uq_catalog_allotment_consumptions_allotment_day_id_booki_483905 on catalog_allotment_consumptions (allotment_day_id, booking_service_id);
create unique index uq_catalog_allotment_requests_tenant_id_code on catalog_allotment_requests (tenant_id, code);
create unique index uq_catalog_allotment_charges_allotment_day_id on catalog_allotment_charges (allotment_day_id);
create unique index uq_ops_travel_doc_items_passenger_id_doc_type on ops_travel_doc_items (passenger_id, doc_type);
create unique index uq_ops_travel_doc_contacts_passenger_id on ops_travel_doc_contacts (passenger_id);
create unique index uq_ops_travel_doc_special_passenger_id on ops_travel_doc_special (passenger_id);
create unique index uq_ops_travel_doc_reminders_reservation_id_sent_on_p on ops_travel_doc_reminders (reservation_id, sent_on) where trigger = 'auto';
create unique index uq_fin_treasury_accounts_tenant_id_code on fin_treasury_accounts (tenant_id, code);
create unique index uq_fin_treasury_accounts_tenant_id_bank_account_number_p on fin_treasury_accounts (tenant_id, bank, account_number) where account_number is not null;
create unique index uq_fin_treasury_transfers_tenant_id_code on fin_treasury_transfers (tenant_id, code);
create unique index uq_fin_cash_replenishments_tenant_id_code on fin_cash_replenishments (tenant_id, code);
create unique index uq_fin_cash_replenishments_tenant_id_account_id_p on fin_cash_replenishments (tenant_id, account_id) where status in ('requested','approved');
create unique index uq_fin_treasury_movements_tenant_id_code on fin_treasury_movements (tenant_id, code);
create unique index uq_fin_treasury_movements_tenant_id_source_key_p on fin_treasury_movements (tenant_id, source_key) where source_key is not null;
create unique index uq_fin_expense_receipts_movement_id on fin_expense_receipts (movement_id);
create unique index uq_fin_expense_receipts_tenant_id_issuer_ruc_series_number_p on fin_expense_receipts (tenant_id, issuer_ruc, series_number) where issuer_ruc is not null;
create unique index uq_fin_cash_sessions_tenant_id_code on fin_cash_sessions (tenant_id, code);
create unique index uq_fin_cash_sessions_tenant_id_account_id_session_date on fin_cash_sessions (tenant_id, account_id, session_date);
create unique index uq_fin_cash_sessions_tenant_id_account_id_p on fin_cash_sessions (tenant_id, account_id) where status = 'open';
create unique index uq_fin_cash_counts_tenant_id_code on fin_cash_counts (tenant_id, code);
create unique index uq_fin_fx_revaluations_tenant_id_code on fin_fx_revaluations (tenant_id, code);
create unique index uq_fin_fx_revaluations_tenant_id_account_id_period on fin_fx_revaluations (tenant_id, account_id, period);
create unique index uq_fin_treasury_settings_tenant_id on fin_treasury_settings (tenant_id);
create unique index uq_sys_booking_rules_tenant_id_code on sys_booking_rules (tenant_id, code);
create unique index uq_catalog_product_rule_overrides_tenant_id_product_id_r_b479e9 on catalog_product_rule_overrides (tenant_id, product_id, rule_code);
create unique index uq_catalog_product_addons_tenant_id_code on catalog_product_addons (tenant_id, code);
create unique index uq_catalog_product_addons_tenant_id_product_id_lower_name on catalog_product_addons (tenant_id, product_id, lower(name));
create unique index uq_catalog_accommodation_legs_tenant_id_product_id_code on catalog_accommodation_legs (tenant_id, product_id, code);
create unique index uq_catalog_accommodation_hotels_leg_id_lower_name on catalog_accommodation_hotels (leg_id, lower(name));
create unique index uq_catalog_accommodation_room_types_hotel_id_room_type on catalog_accommodation_room_types (hotel_id, room_type);
create unique index uq_catalog_payment_policies_product_id on catalog_payment_policies (product_id);
create unique index uq_catalog_pickup_points_product_id_lower_label on catalog_pickup_points (product_id, lower(label));
create unique index uq_booking_reservation_web_snapshots_tenant_id_reservation_id on booking_reservation_web_snapshots (tenant_id, reservation_id);
create unique index uq_notif_pax_message_templates_tenant_id_code on notif_pax_message_templates (tenant_id, code);
create unique index uq_notif_pax_messages_tenant_id_code on notif_pax_messages (tenant_id, code);
create unique index uq_notif_pax_messages_tenant_id_reservation_id_template__fe1a07 on notif_pax_messages (tenant_id, reservation_id, template_id, channel) where origin = 'auto' and status <> 'cancelado';
create unique index uq_fin_currencies_tenant_id_code on fin_currencies (tenant_id, code);
create unique index uq_fin_currencies_tenant_id_p on fin_currencies (tenant_id) where is_base;
create unique index uq_fx_rate_providers_tenant_id_code on fx_rate_providers (tenant_id, code);
create unique index uq_channel_widget_config_tenant_id on channel_widget_config (tenant_id);
create unique index uq_channel_widget_config_public_key on channel_widget_config (public_key);
create unique index uq_channel_widget_domains_tenant_id_domain on channel_widget_domains (tenant_id, domain);
create unique index uq_channel_web_carts_tenant_id_code on channel_web_carts (tenant_id, code);
create unique index uq_channel_web_carts_tenant_id_token_hash on channel_web_carts (tenant_id, token_hash);
create unique index uq_channel_web_carts_order_id_p on channel_web_carts (order_id) where order_id is not null;
create unique index uq_channel_web_cart_items_hold_id_p on channel_web_cart_items (hold_id) where hold_id is not null;
create unique index uq_channel_web_cart_items_cart_id_line_no on channel_web_cart_items (cart_id, line_no);
create unique index uq_channel_widget_handoffs_tenant_id_code on channel_widget_handoffs (tenant_id, code);
create unique index uq_catalog_product_translations_tenant_id_locale_slug on catalog_product_translations (tenant_id, locale, slug);
create unique index uq_catalog_product_translations_product_id_locale on catalog_product_translations (product_id, locale);
create unique index uq_catalog_destination_contents_tenant_id_locale_slug on catalog_destination_contents (tenant_id, locale, slug);
create unique index uq_catalog_destination_contents_destination_id_locale on catalog_destination_contents (destination_id, locale);

-- ---------------------------------------------------------------- claves foráneas
alter table iam_users add constraint fk_iam_users_agency_id foreign key (agency_id) references channel_b2b_agencies (id);
alter table crm_clients add constraint fk_crm_clients_b2b_agency_id foreign key (b2b_agency_id) references channel_b2b_agencies (id);
alter table crm_leads add constraint fk_crm_leads_matched_client_id foreign key (matched_client_id) references crm_clients (id);
alter table quote_versions add constraint fk_quote_versions_approval_request_id foreign key (approval_request_id) references collab_approval_requests (id);
alter table booking_reservations add constraint fk_booking_reservations_agency_id foreign key (agency_id) references channel_b2b_agencies (id);
alter table booking_reservations add constraint fk_booking_reservations_ecom_order_id foreign key (ecom_order_id) references channel_ecom_orders (id);
alter table booking_reservations add constraint fk_booking_reservations_cancel_request_id foreign key (cancel_request_id) references booking_cancel_requests (id);
alter table booking_reservation_services add constraint fk_booking_reservation_services_addon_id foreign key (addon_id) references catalog_product_addons (id);
alter table booking_cancellations add constraint fk_booking_cancellations_credit_note_id foreign key (credit_note_id) references fin_invoices (id);
alter table ops_assignment_checkins add constraint fk_ops_assignment_checkins_device_id foreign key (device_id) references ops_mobile_devices (id);
alter table fin_payments add constraint fk_fin_payments_reversal_request_id foreign key (reversal_request_id) references collab_approval_requests (id);
alter table fin_payable_payouts add constraint fk_fin_payable_payouts_bank_line_id foreign key (bank_line_id) references fin_bank_lines (id);
alter table fin_commissions add constraint fk_fin_commissions_beneficiary_agency_id foreign key (beneficiary_agency_id) references channel_b2b_agencies (id);
alter table fin_commissions add constraint fk_fin_commissions_settlement_request_id foreign key (settlement_request_id) references channel_b2b_settlement_requests (id);
alter table fin_fx_rates add constraint fk_fin_fx_rates_provider_id foreign key (provider_id) references fx_rate_providers (id);
alter table ops_mobile_devices add constraint fk_ops_mobile_devices_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_mobile_devices add constraint fk_ops_mobile_devices_user_id foreign key (user_id) references iam_users (id);
alter table ops_sync_actions add constraint fk_ops_sync_actions_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_sync_actions add constraint fk_ops_sync_actions_user_id foreign key (user_id) references iam_users (id);
alter table ops_sync_actions add constraint fk_ops_sync_actions_device_id foreign key (device_id) references ops_mobile_devices (id);
alter table ops_sync_actions add constraint fk_ops_sync_actions_assignment_id foreign key (assignment_id) references ops_assignments (id);
alter table channel_trip_messages add constraint fk_channel_trip_messages_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_trip_messages add constraint fk_channel_trip_messages_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table channel_trip_messages add constraint fk_channel_trip_messages_sender_user_id foreign key (sender_user_id) references iam_users (id);
alter table catalog_service_cost_history add constraint fk_catalog_service_cost_history_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_service_cost_history add constraint fk_catalog_service_cost_history_service_id foreign key (service_id) references catalog_services (id);
alter table catalog_service_cost_history add constraint fk_catalog_service_cost_history_rate_request_id foreign key (rate_request_id) references supplier_rate_requests (id);
alter table catalog_service_cost_history add constraint fk_catalog_service_cost_history_approval_request_id foreign key (approval_request_id) references collab_approval_requests (id);
alter table supplier_request_responses add constraint fk_supplier_request_responses_tenant_id foreign key (tenant_id) references tenants (id);
alter table supplier_request_responses add constraint fk_supplier_request_responses_supplier_request_id foreign key (supplier_request_id) references ops_supplier_requests (id);
alter table supplier_request_responses add constraint fk_supplier_request_responses_reservation_service_id foreign key (reservation_service_id) references booking_reservation_services (id);
alter table supplier_request_responses add constraint fk_supplier_request_responses_provider_id foreign key (provider_id) references catalog_providers (id);
alter table supplier_request_responses add constraint fk_supplier_request_responses_responded_by_user_id foreign key (responded_by_user_id) references iam_users (id);
alter table supplier_request_responses add constraint fk_supplier_request_responses_alt_service_id foreign key (alt_service_id) references catalog_services (id);
alter table supplier_request_responses add constraint fk_supplier_request_responses_reviewed_by foreign key (reviewed_by) references iam_users (id);
alter table supplier_invoices add constraint fk_supplier_invoices_tenant_id foreign key (tenant_id) references tenants (id);
alter table supplier_invoices add constraint fk_supplier_invoices_payable_id foreign key (payable_id) references fin_payables (id);
alter table supplier_invoices add constraint fk_supplier_invoices_provider_id foreign key (provider_id) references catalog_providers (id);
alter table supplier_invoices add constraint fk_supplier_invoices_document_id foreign key (document_id) references sys_documents (id);
alter table supplier_invoices add constraint fk_supplier_invoices_uploaded_by foreign key (uploaded_by) references iam_users (id);
alter table supplier_invoices add constraint fk_supplier_invoices_validated_by foreign key (validated_by) references iam_users (id);
alter table supplier_rate_requests add constraint fk_supplier_rate_requests_tenant_id foreign key (tenant_id) references tenants (id);
alter table supplier_rate_requests add constraint fk_supplier_rate_requests_provider_id foreign key (provider_id) references catalog_providers (id);
alter table supplier_rate_requests add constraint fk_supplier_rate_requests_service_id foreign key (service_id) references catalog_services (id);
alter table supplier_rate_requests add constraint fk_supplier_rate_requests_requested_by foreign key (requested_by) references iam_users (id);
alter table supplier_rate_requests add constraint fk_supplier_rate_requests_reviewed_by foreign key (reviewed_by) references iam_users (id);
alter table supplier_rate_requests add constraint fk_supplier_rate_requests_resulting_rate_id foreign key (resulting_rate_id) references catalog_service_cost_history (id);
alter table fin_document_series add constraint fk_fin_document_series_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_document_series add constraint fk_fin_document_series_sede_id foreign key (sede_id) references iam_sedes (id);
alter table fin_invoices add constraint fk_fin_invoices_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_invoices add constraint fk_fin_invoices_client_id foreign key (client_id) references crm_clients (id);
alter table fin_invoices add constraint fk_fin_invoices_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table fin_invoices add constraint fk_fin_invoices_receivable_id foreign key (receivable_id) references fin_receivables (id);
alter table fin_invoices add constraint fk_fin_invoices_ref_invoice_id foreign key (ref_invoice_id) references fin_invoices (id);
alter table fin_invoices add constraint fk_fin_invoices_xml_document_id foreign key (xml_document_id) references sys_documents (id);
alter table fin_invoices add constraint fk_fin_invoices_cdr_document_id foreign key (cdr_document_id) references sys_documents (id);
alter table fin_invoices add constraint fk_fin_invoices_pdf_document_id foreign key (pdf_document_id) references sys_documents (id);
alter table fin_invoices add constraint fk_fin_invoices_issued_by foreign key (issued_by) references iam_users (id);
alter table fin_invoice_lines add constraint fk_fin_invoice_lines_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_invoice_lines add constraint fk_fin_invoice_lines_invoice_id foreign key (invoice_id) references fin_invoices (id);
alter table fin_fiscal_events add constraint fk_fin_fiscal_events_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_fiscal_events add constraint fk_fin_fiscal_events_invoice_id foreign key (invoice_id) references fin_invoices (id);
alter table fin_fiscal_events add constraint fk_fin_fiscal_events_payload_document_id foreign key (payload_document_id) references sys_documents (id);
alter table fin_bank_statements add constraint fk_fin_bank_statements_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_bank_statements add constraint fk_fin_bank_statements_bank_account_id foreign key (bank_account_id) references fin_bank_accounts (id);
alter table fin_bank_statements add constraint fk_fin_bank_statements_document_id foreign key (document_id) references sys_documents (id);
alter table fin_bank_statements add constraint fk_fin_bank_statements_imported_by foreign key (imported_by) references iam_users (id);
alter table fin_reconciliation_closures add constraint fk_fin_reconciliation_closures_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_reconciliation_closures add constraint fk_fin_reconciliation_closures_closed_by foreign key (closed_by) references iam_users (id);
alter table fin_bank_lines add constraint fk_fin_bank_lines_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_bank_lines add constraint fk_fin_bank_lines_statement_id foreign key (statement_id) references fin_bank_statements (id);
alter table fin_bank_lines add constraint fk_fin_bank_lines_matched_payment_id foreign key (matched_payment_id) references fin_payments (id);
alter table fin_bank_lines add constraint fk_fin_bank_lines_matched_payable_id foreign key (matched_payable_id) references fin_payables (id);
alter table fin_bank_lines add constraint fk_fin_bank_lines_resolved_by foreign key (resolved_by) references iam_users (id);
alter table fin_bank_lines add constraint fk_fin_bank_lines_closure_id foreign key (closure_id) references fin_reconciliation_closures (id);
alter table fin_period_closes add constraint fk_fin_period_closes_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_period_closes add constraint fk_fin_period_closes_closed_by foreign key (closed_by) references iam_users (id);
alter table fin_period_close_checks add constraint fk_fin_period_close_checks_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_period_close_checks add constraint fk_fin_period_close_checks_period_close_id foreign key (period_close_id) references fin_period_closes (id) on delete cascade;
alter table fin_period_close_checks add constraint fk_fin_period_close_checks_checked_by foreign key (checked_by) references iam_users (id);
alter table channel_b2b_price_lists add constraint fk_channel_b2b_price_lists_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_b2b_agencies add constraint fk_channel_b2b_agencies_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_b2b_agencies add constraint fk_channel_b2b_agencies_crm_client_id foreign key (crm_client_id) references crm_clients (id);
alter table channel_b2b_agencies add constraint fk_channel_b2b_agencies_price_list_id foreign key (price_list_id) references channel_b2b_price_lists (id);
alter table catalog_product_b2b_rates add constraint fk_catalog_product_b2b_rates_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_b2b_rates add constraint fk_catalog_product_b2b_rates_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_b2b_rates add constraint fk_catalog_product_b2b_rates_agency_id foreign key (agency_id) references channel_b2b_agencies (id);
alter table catalog_product_b2b_rates add constraint fk_catalog_product_b2b_rates_price_list_id foreign key (price_list_id) references channel_b2b_price_lists (id);
alter table channel_b2b_settlement_requests add constraint fk_channel_b2b_settlement_requests_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_b2b_settlement_requests add constraint fk_channel_b2b_settlement_requests_agency_id foreign key (agency_id) references channel_b2b_agencies (id);
alter table channel_b2b_settlement_requests add constraint fk_channel_b2b_settlement_requests_requested_by foreign key (requested_by) references iam_users (id);
alter table channel_b2b_credit_movements add constraint fk_channel_b2b_credit_movements_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_b2b_credit_movements add constraint fk_channel_b2b_credit_movements_agency_id foreign key (agency_id) references channel_b2b_agencies (id);
alter table channel_b2b_credit_movements add constraint fk_channel_b2b_credit_movements_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table channel_b2b_credit_movements add constraint fk_channel_b2b_credit_movements_payment_id foreign key (payment_id) references fin_payments (id);
alter table channel_b2b_credit_exceptions add constraint fk_channel_b2b_credit_exceptions_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_b2b_credit_exceptions add constraint fk_channel_b2b_credit_exceptions_agency_id foreign key (agency_id) references channel_b2b_agencies (id);
alter table channel_b2b_credit_exceptions add constraint fk_channel_b2b_credit_exceptions_approval_request_id foreign key (approval_request_id) references collab_approval_requests (id);
alter table cms_contents add constraint fk_cms_contents_tenant_id foreign key (tenant_id) references tenants (id);
alter table cms_contents add constraint fk_cms_contents_author_id foreign key (author_id) references iam_users (id);
alter table cms_content_events add constraint fk_cms_content_events_tenant_id foreign key (tenant_id) references tenants (id);
alter table cms_content_events add constraint fk_cms_content_events_content_id foreign key (content_id) references cms_contents (id);
alter table cms_content_events add constraint fk_cms_content_events_user_id foreign key (user_id) references iam_users (id);
alter table channel_ecom_orders add constraint fk_channel_ecom_orders_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_ecom_orders add constraint fk_channel_ecom_orders_crm_client_id foreign key (crm_client_id) references crm_clients (id);
alter table channel_ecom_orders add constraint fk_channel_ecom_orders_product_id foreign key (product_id) references catalog_products (id);
alter table channel_ecom_orders add constraint fk_channel_ecom_orders_departure_id foreign key (departure_id) references catalog_product_departures (id);
alter table channel_ecom_orders add constraint fk_channel_ecom_orders_promotion_id foreign key (promotion_id) references catalog_product_promotions (id);
alter table channel_ecom_orders add constraint fk_channel_ecom_orders_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table channel_ecom_orders add constraint fk_channel_ecom_orders_receivable_id foreign key (receivable_id) references fin_receivables (id);
alter table channel_ecom_orders add constraint fk_channel_ecom_orders_cart_id foreign key (cart_id) references channel_web_carts (id);
alter table channel_ecom_order_lines add constraint fk_channel_ecom_order_lines_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_ecom_order_lines add constraint fk_channel_ecom_order_lines_order_id foreign key (order_id) references channel_ecom_orders (id);
alter table channel_ecom_order_lines add constraint fk_channel_ecom_order_lines_product_id foreign key (product_id) references catalog_products (id);
alter table channel_ecom_order_lines add constraint fk_channel_ecom_order_lines_departure_id foreign key (departure_id) references catalog_product_departures (id);
alter table channel_ecom_order_lines add constraint fk_channel_ecom_order_lines_rate_id foreign key (rate_id) references catalog_rates (id);
alter table channel_ecom_order_lines add constraint fk_channel_ecom_order_lines_season_id foreign key (season_id) references catalog_seasons (id);
alter table channel_ecom_order_lines add constraint fk_channel_ecom_order_lines_promotion_id foreign key (promotion_id) references catalog_product_promotions (id);
alter table channel_ecom_order_lines add constraint fk_channel_ecom_order_lines_hold_id foreign key (hold_id) references catalog_availability_holds (id);
alter table channel_ecom_order_lines add constraint fk_channel_ecom_order_lines_reservation_service_id foreign key (reservation_service_id) references booking_reservation_services (id);
alter table channel_ecom_passengers add constraint fk_channel_ecom_passengers_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_ecom_passengers add constraint fk_channel_ecom_passengers_order_id foreign key (order_id) references channel_ecom_orders (id);
alter table channel_ecom_payment_attempts add constraint fk_channel_ecom_payment_attempts_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_ecom_payment_attempts add constraint fk_channel_ecom_payment_attempts_order_id foreign key (order_id) references channel_ecom_orders (id);
alter table channel_ecom_payment_attempts add constraint fk_channel_ecom_payment_attempts_payment_id foreign key (payment_id) references fin_payments (id);
alter table channel_portal_access_links add constraint fk_channel_portal_access_links_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_portal_access_links add constraint fk_channel_portal_access_links_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table channel_portal_access_links add constraint fk_channel_portal_access_links_passenger_id foreign key (passenger_id) references booking_passengers (id);
alter table ops_incident_pax_acks add constraint fk_ops_incident_pax_acks_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_incident_pax_acks add constraint fk_ops_incident_pax_acks_incident_id foreign key (incident_id) references ops_incidents (id);
alter table ops_incident_pax_acks add constraint fk_ops_incident_pax_acks_user_id foreign key (user_id) references iam_users (id);
alter table channel_pax_feedback add constraint fk_channel_pax_feedback_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_pax_feedback add constraint fk_channel_pax_feedback_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table channel_pax_feedback add constraint fk_channel_pax_feedback_reservation_service_id foreign key (reservation_service_id) references booking_reservation_services (id);
alter table channel_pax_feedback add constraint fk_channel_pax_feedback_replied_by foreign key (replied_by) references iam_users (id);
alter table channel_pax_feedback add constraint fk_channel_pax_feedback_conversation_id foreign key (conversation_id) references collab_conversations (id);
alter table channel_pax_feedback add constraint fk_channel_pax_feedback_incident_id foreign key (incident_id) references ops_incidents (id);
alter table collab_approval_rules add constraint fk_collab_approval_rules_tenant_id foreign key (tenant_id) references tenants (id);
alter table collab_approval_requests add constraint fk_collab_approval_requests_tenant_id foreign key (tenant_id) references tenants (id);
alter table collab_approval_requests add constraint fk_collab_approval_requests_requester_id foreign key (requester_id) references iam_users (id);
alter table collab_approval_requests add constraint fk_collab_approval_requests_requester_supplier_id foreign key (requester_supplier_id) references catalog_providers (id);
alter table collab_approval_requests add constraint fk_collab_approval_requests_delegated_to foreign key (delegated_to) references iam_users (id);
alter table collab_approval_requests add constraint fk_collab_approval_requests_decided_by foreign key (decided_by) references iam_users (id);
alter table collab_approval_steps add constraint fk_collab_approval_steps_tenant_id foreign key (tenant_id) references tenants (id);
alter table collab_approval_steps add constraint fk_collab_approval_steps_request_id foreign key (request_id) references collab_approval_requests (id);
alter table collab_approval_steps add constraint fk_collab_approval_steps_rule_id foreign key (rule_id) references collab_approval_rules (id);
alter table collab_approval_steps add constraint fk_collab_approval_steps_decided_by foreign key (decided_by) references iam_users (id);
alter table collab_approval_info_requests add constraint fk_collab_approval_info_requests_tenant_id foreign key (tenant_id) references tenants (id);
alter table collab_approval_info_requests add constraint fk_collab_approval_info_requests_request_id foreign key (request_id) references collab_approval_requests (id);
alter table collab_approval_info_requests add constraint fk_collab_approval_info_requests_asked_by foreign key (asked_by) references iam_users (id);
alter table collab_approval_info_requests add constraint fk_collab_approval_info_requests_answered_by foreign key (answered_by) references iam_users (id);
alter table collab_approval_events add constraint fk_collab_approval_events_tenant_id foreign key (tenant_id) references tenants (id);
alter table collab_approval_events add constraint fk_collab_approval_events_request_id foreign key (request_id) references collab_approval_requests (id);
alter table collab_approval_events add constraint fk_collab_approval_events_actor_id foreign key (actor_id) references iam_users (id);
alter table collab_channel_accounts add constraint fk_collab_channel_accounts_tenant_id foreign key (tenant_id) references tenants (id);
alter table collab_reply_templates add constraint fk_collab_reply_templates_tenant_id foreign key (tenant_id) references tenants (id);
alter table collab_conversations add constraint fk_collab_conversations_tenant_id foreign key (tenant_id) references tenants (id);
alter table collab_conversations add constraint fk_collab_conversations_channel_account_id foreign key (channel_account_id) references collab_channel_accounts (id);
alter table collab_conversations add constraint fk_collab_conversations_assignee_id foreign key (assignee_id) references iam_users (id);
alter table collab_conversations add constraint fk_collab_conversations_client_id foreign key (client_id) references crm_clients (id);
alter table collab_conversations add constraint fk_collab_conversations_lead_id foreign key (lead_id) references crm_leads (id);
alter table collab_conversations add constraint fk_collab_conversations_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table collab_conversations add constraint fk_collab_conversations_quote_id foreign key (quote_id) references quote_quotes (id);
alter table collab_conversations add constraint fk_collab_conversations_support_ticket_id foreign key (support_ticket_id) references channel_support_tickets (id);
alter table collab_conversations add constraint fk_collab_conversations_feedback_id foreign key (feedback_id) references channel_pax_feedback (id);
alter table collab_conversations add constraint fk_collab_conversations_resolved_by foreign key (resolved_by) references iam_users (id);
alter table collab_messages add constraint fk_collab_messages_tenant_id foreign key (tenant_id) references tenants (id);
alter table collab_messages add constraint fk_collab_messages_conversation_id foreign key (conversation_id) references collab_conversations (id);
alter table collab_messages add constraint fk_collab_messages_author_user_id foreign key (author_user_id) references iam_users (id);
alter table collab_messages add constraint fk_collab_messages_template_id foreign key (template_id) references collab_reply_templates (id);
alter table collab_message_attachments add constraint fk_collab_message_attachments_tenant_id foreign key (tenant_id) references tenants (id);
alter table collab_message_attachments add constraint fk_collab_message_attachments_message_id foreign key (message_id) references collab_messages (id);
alter table collab_inbound_events add constraint fk_collab_inbound_events_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_allotments add constraint fk_catalog_allotments_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_allotments add constraint fk_catalog_allotments_provider_id foreign key (provider_id) references catalog_providers (id);
alter table catalog_allotments add constraint fk_catalog_allotments_service_id foreign key (service_id) references catalog_services (id);
alter table catalog_allotments add constraint fk_catalog_allotments_owner_id foreign key (owner_id) references iam_users (id);
alter table catalog_allotment_days add constraint fk_catalog_allotment_days_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_allotment_days add constraint fk_catalog_allotment_days_allotment_id foreign key (allotment_id) references catalog_allotments (id) on delete cascade;
alter table catalog_allotment_days add constraint fk_catalog_allotment_days_retained_by foreign key (retained_by) references iam_users (id);
alter table catalog_allotment_consumptions add constraint fk_catalog_allotment_consumptions_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_allotment_consumptions add constraint fk_catalog_allotment_consumptions_allotment_day_id foreign key (allotment_day_id) references catalog_allotment_days (id);
alter table catalog_allotment_consumptions add constraint fk_catalog_allotment_consumptions_booking_service_id foreign key (booking_service_id) references booking_reservation_services (id);
alter table catalog_allotment_consumptions add constraint fk_catalog_allotment_consumptions_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table catalog_allotment_requests add constraint fk_catalog_allotment_requests_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_allotment_requests add constraint fk_catalog_allotment_requests_allotment_id foreign key (allotment_id) references catalog_allotments (id);
alter table catalog_allotment_requests add constraint fk_catalog_allotment_requests_responded_by foreign key (responded_by) references iam_users (id);
alter table catalog_allotment_charges add constraint fk_catalog_allotment_charges_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_allotment_charges add constraint fk_catalog_allotment_charges_allotment_day_id foreign key (allotment_day_id) references catalog_allotment_days (id);
alter table catalog_allotment_charges add constraint fk_catalog_allotment_charges_payable_id foreign key (payable_id) references fin_payables (id);
alter table catalog_allotment_events add constraint fk_catalog_allotment_events_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_allotment_events add constraint fk_catalog_allotment_events_allotment_id foreign key (allotment_id) references catalog_allotments (id);
alter table catalog_allotment_events add constraint fk_catalog_allotment_events_user_id foreign key (user_id) references iam_users (id);
alter table ops_travel_doc_items add constraint fk_ops_travel_doc_items_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_travel_doc_items add constraint fk_ops_travel_doc_items_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table ops_travel_doc_items add constraint fk_ops_travel_doc_items_passenger_id foreign key (passenger_id) references booking_passengers (id) on delete cascade;
alter table ops_travel_doc_items add constraint fk_ops_travel_doc_items_file_id foreign key (file_id) references sys_documents (id);
alter table ops_travel_doc_items add constraint fk_ops_travel_doc_items_validated_by foreign key (validated_by) references iam_users (id);
alter table ops_travel_doc_contacts add constraint fk_ops_travel_doc_contacts_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_travel_doc_contacts add constraint fk_ops_travel_doc_contacts_passenger_id foreign key (passenger_id) references booking_passengers (id) on delete cascade;
alter table ops_travel_doc_special add constraint fk_ops_travel_doc_special_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_travel_doc_special add constraint fk_ops_travel_doc_special_passenger_id foreign key (passenger_id) references booking_passengers (id) on delete cascade;
alter table ops_travel_doc_reminders add constraint fk_ops_travel_doc_reminders_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_travel_doc_reminders add constraint fk_ops_travel_doc_reminders_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table ops_travel_doc_reminders add constraint fk_ops_travel_doc_reminders_sent_by foreign key (sent_by) references iam_users (id);
alter table fin_treasury_accounts add constraint fk_fin_treasury_accounts_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_treasury_accounts add constraint fk_fin_treasury_accounts_sede_id foreign key (sede_id) references iam_sedes (id);
alter table fin_treasury_accounts add constraint fk_fin_treasury_accounts_custodian_id foreign key (custodian_id) references iam_users (id);
alter table fin_treasury_accounts add constraint fk_fin_treasury_accounts_settle_to_account_id foreign key (settle_to_account_id) references fin_treasury_accounts (id);
alter table fin_treasury_transfers add constraint fk_fin_treasury_transfers_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_treasury_transfers add constraint fk_fin_treasury_transfers_from_account_id foreign key (from_account_id) references fin_treasury_accounts (id);
alter table fin_treasury_transfers add constraint fk_fin_treasury_transfers_to_account_id foreign key (to_account_id) references fin_treasury_accounts (id);
alter table fin_cash_replenishments add constraint fk_fin_cash_replenishments_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_cash_replenishments add constraint fk_fin_cash_replenishments_account_id foreign key (account_id) references fin_treasury_accounts (id);
alter table fin_cash_replenishments add constraint fk_fin_cash_replenishments_requested_by foreign key (requested_by) references iam_users (id);
alter table fin_cash_replenishments add constraint fk_fin_cash_replenishments_approved_by foreign key (approved_by) references iam_users (id);
alter table fin_cash_replenishments add constraint fk_fin_cash_replenishments_paid_by foreign key (paid_by) references iam_users (id);
alter table fin_cash_replenishments add constraint fk_fin_cash_replenishments_paid_from_account_id foreign key (paid_from_account_id) references fin_treasury_accounts (id);
alter table fin_cash_replenishments add constraint fk_fin_cash_replenishments_transfer_id foreign key (transfer_id) references fin_treasury_transfers (id);
alter table fin_cash_replenishment_events add constraint fk_fin_cash_replenishment_events_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_cash_replenishment_events add constraint fk_fin_cash_replenishment_events_replenishment_id foreign key (replenishment_id) references fin_cash_replenishments (id);
alter table fin_cash_replenishment_events add constraint fk_fin_cash_replenishment_events_user_id foreign key (user_id) references iam_users (id);
alter table fin_treasury_movements add constraint fk_fin_treasury_movements_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_treasury_movements add constraint fk_fin_treasury_movements_account_id foreign key (account_id) references fin_treasury_accounts (id);
alter table fin_treasury_movements add constraint fk_fin_treasury_movements_transfer_id foreign key (transfer_id) references fin_treasury_transfers (id);
alter table fin_treasury_movements add constraint fk_fin_treasury_movements_replenishment_id foreign key (replenishment_id) references fin_cash_replenishments (id);
alter table fin_treasury_movements add constraint fk_fin_treasury_movements_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table fin_treasury_movements add constraint fk_fin_treasury_movements_sede_id foreign key (sede_id) references iam_sedes (id);
alter table fin_treasury_movements add constraint fk_fin_treasury_movements_deposited_transfer_id foreign key (deposited_transfer_id) references fin_treasury_transfers (id);
alter table fin_treasury_movements add constraint fk_fin_treasury_movements_voided_by foreign key (voided_by) references iam_users (id);
alter table fin_expense_receipts add constraint fk_fin_expense_receipts_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_expense_receipts add constraint fk_fin_expense_receipts_movement_id foreign key (movement_id) references fin_treasury_movements (id);
alter table fin_cash_sessions add constraint fk_fin_cash_sessions_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_cash_sessions add constraint fk_fin_cash_sessions_account_id foreign key (account_id) references fin_treasury_accounts (id);
alter table fin_cash_sessions add constraint fk_fin_cash_sessions_opened_by foreign key (opened_by) references iam_users (id);
alter table fin_cash_sessions add constraint fk_fin_cash_sessions_closed_by foreign key (closed_by) references iam_users (id);
alter table fin_cash_sessions add constraint fk_fin_cash_sessions_closing_count_id foreign key (closing_count_id) references fin_cash_counts (id);
alter table fin_cash_counts add constraint fk_fin_cash_counts_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_cash_counts add constraint fk_fin_cash_counts_account_id foreign key (account_id) references fin_treasury_accounts (id);
alter table fin_cash_counts add constraint fk_fin_cash_counts_session_id foreign key (session_id) references fin_cash_sessions (id);
alter table fin_cash_counts add constraint fk_fin_cash_counts_signed_by foreign key (signed_by) references iam_users (id);
alter table fin_cash_counts add constraint fk_fin_cash_counts_witness_id foreign key (witness_id) references iam_users (id);
alter table fin_cash_counts add constraint fk_fin_cash_counts_approved_by foreign key (approved_by) references iam_users (id);
alter table fin_cash_counts add constraint fk_fin_cash_counts_validated_by foreign key (validated_by) references iam_users (id);
alter table fin_cash_counts add constraint fk_fin_cash_counts_adjustment_movement_id foreign key (adjustment_movement_id) references fin_treasury_movements (id);
alter table fin_fx_revaluations add constraint fk_fin_fx_revaluations_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_fx_revaluations add constraint fk_fin_fx_revaluations_account_id foreign key (account_id) references fin_treasury_accounts (id);
alter table fin_treasury_settings add constraint fk_fin_treasury_settings_tenant_id foreign key (tenant_id) references tenants (id);
alter table sys_booking_rules add constraint fk_sys_booking_rules_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_rule_overrides add constraint fk_catalog_product_rule_overrides_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_rule_overrides add constraint fk_catalog_product_rule_overrides_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_addons add constraint fk_catalog_product_addons_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_addons add constraint fk_catalog_product_addons_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_addons add constraint fk_catalog_product_addons_provider_id foreign key (provider_id) references catalog_providers (id);
alter table catalog_product_addons add constraint fk_catalog_product_addons_service_id foreign key (service_id) references catalog_services (id);
alter table catalog_accommodation_legs add constraint fk_catalog_accommodation_legs_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_accommodation_legs add constraint fk_catalog_accommodation_legs_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_accommodation_legs add constraint fk_catalog_accommodation_legs_destination_id foreign key (destination_id) references catalog_destinations (id);
alter table catalog_accommodation_hotels add constraint fk_catalog_accommodation_hotels_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_accommodation_hotels add constraint fk_catalog_accommodation_hotels_leg_id foreign key (leg_id) references catalog_accommodation_legs (id) on delete cascade;
alter table catalog_accommodation_hotels add constraint fk_catalog_accommodation_hotels_provider_id foreign key (provider_id) references catalog_providers (id);
alter table catalog_accommodation_room_types add constraint fk_catalog_accommodation_room_types_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_accommodation_room_types add constraint fk_catalog_accommodation_room_types_hotel_id foreign key (hotel_id) references catalog_accommodation_hotels (id) on delete cascade;
alter table catalog_payment_policies add constraint fk_catalog_payment_policies_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_payment_policies add constraint fk_catalog_payment_policies_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_pickup_points add constraint fk_catalog_pickup_points_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_pickup_points add constraint fk_catalog_pickup_points_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table booking_reservation_web_snapshots add constraint fk_booking_reservation_web_snapshots_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_reservation_web_snapshots add constraint fk_booking_reservation_web_snapshots_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table booking_reservation_web_snapshots add constraint fk_booking_reservation_web_snapshots_product_id foreign key (product_id) references catalog_products (id);
alter table booking_reservation_web_lodging add constraint fk_booking_reservation_web_lodging_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_reservation_web_lodging add constraint fk_booking_reservation_web_lodging_snapshot_id foreign key (snapshot_id) references booking_reservation_web_snapshots (id) on delete cascade;
alter table booking_reservation_web_lodging add constraint fk_booking_reservation_web_lodging_hotel_id foreign key (hotel_id) references catalog_accommodation_hotels (id);
alter table booking_reservation_web_addons add constraint fk_booking_reservation_web_addons_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_reservation_web_addons add constraint fk_booking_reservation_web_addons_snapshot_id foreign key (snapshot_id) references booking_reservation_web_snapshots (id) on delete cascade;
alter table booking_reservation_web_addons add constraint fk_booking_reservation_web_addons_addon_id foreign key (addon_id) references catalog_product_addons (id);
alter table notif_pax_message_templates add constraint fk_notif_pax_message_templates_tenant_id foreign key (tenant_id) references tenants (id);
alter table notif_pax_messages add constraint fk_notif_pax_messages_tenant_id foreign key (tenant_id) references tenants (id);
alter table notif_pax_messages add constraint fk_notif_pax_messages_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table notif_pax_messages add constraint fk_notif_pax_messages_template_id foreign key (template_id) references notif_pax_message_templates (id);
alter table notif_pax_messages add constraint fk_notif_pax_messages_feedback_id foreign key (feedback_id) references channel_pax_feedback (id);
alter table fin_currencies add constraint fk_fin_currencies_tenant_id foreign key (tenant_id) references tenants (id);
alter table fx_rate_providers add constraint fk_fx_rate_providers_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_widget_config add constraint fk_channel_widget_config_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_widget_domains add constraint fk_channel_widget_domains_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_web_carts add constraint fk_channel_web_carts_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_web_carts add constraint fk_channel_web_carts_crm_client_id foreign key (crm_client_id) references crm_clients (id);
alter table channel_web_carts add constraint fk_channel_web_carts_order_id foreign key (order_id) references channel_ecom_orders (id);
alter table channel_web_cart_items add constraint fk_channel_web_cart_items_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_web_cart_items add constraint fk_channel_web_cart_items_cart_id foreign key (cart_id) references channel_web_carts (id) on delete cascade;
alter table channel_web_cart_items add constraint fk_channel_web_cart_items_product_id foreign key (product_id) references catalog_products (id);
alter table channel_web_cart_items add constraint fk_channel_web_cart_items_departure_id foreign key (departure_id) references catalog_product_departures (id);
alter table channel_web_cart_items add constraint fk_channel_web_cart_items_hold_id foreign key (hold_id) references catalog_availability_holds (id);
alter table channel_widget_handoffs add constraint fk_channel_widget_handoffs_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_widget_handoffs add constraint fk_channel_widget_handoffs_product_id foreign key (product_id) references catalog_products (id);
alter table channel_widget_handoffs add constraint fk_channel_widget_handoffs_cart_id foreign key (cart_id) references channel_web_carts (id);
alter table channel_wishlist_items add constraint fk_channel_wishlist_items_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_wishlist_items add constraint fk_channel_wishlist_items_crm_client_id foreign key (crm_client_id) references crm_clients (id) on delete cascade;
alter table channel_wishlist_items add constraint fk_channel_wishlist_items_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table channel_web_events add constraint fk_channel_web_events_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_translations add constraint fk_catalog_product_translations_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_translations add constraint fk_catalog_product_translations_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_destination_contents add constraint fk_catalog_destination_contents_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_destination_contents add constraint fk_catalog_destination_contents_destination_id foreign key (destination_id) references catalog_destinations (id) on delete cascade;
alter table catalog_destination_contents add constraint fk_catalog_destination_contents_hero_media_id foreign key (hero_media_id) references catalog_product_media (id);

-- ---------------------------------------------------------------- índices (FK, listados, búsquedas)
create index ix_iam_users_tenant_id_provider_id on iam_users (tenant_id, provider_id);
create index ix_ops_mobile_devices_tenant_id_user_id on ops_mobile_devices (tenant_id, user_id);
create index ix_ops_sync_actions_tenant_id_assignment_id_occurred_at on ops_sync_actions (tenant_id, assignment_id, occurred_at);
create index ix_channel_trip_messages_tenant_id_reservation_id_created_at on channel_trip_messages (tenant_id, reservation_id, created_at);
create index ix_catalog_service_cost_history_tenant_id_service_id_eff_aefef2 on catalog_service_cost_history (tenant_id, service_id, effective_from desc);
create index ix_supplier_request_responses_tenant_id_provider_id_crea_8b689f on supplier_request_responses (tenant_id, provider_id, created_at desc);
create index ix_supplier_invoices_tenant_id_status on supplier_invoices (tenant_id, status);
create index ix_supplier_rate_requests_tenant_id_provider_id_status on supplier_rate_requests (tenant_id, provider_id, status);
create index ix_supplier_rate_requests_tenant_id_status on supplier_rate_requests (tenant_id, status);
create index ix_fin_invoices_tenant_id_status on fin_invoices (tenant_id, status);
create index ix_fin_invoices_tenant_id_reservation_id on fin_invoices (tenant_id, reservation_id);
create index ix_fin_invoices_tenant_id_client_id on fin_invoices (tenant_id, client_id);
create index ix_fin_invoices_tenant_id_doc_type on fin_invoices (tenant_id, doc_type);
create index ix_fin_invoices_tenant_id_issue_date_desc on fin_invoices (tenant_id, issue_date desc);
create index ix_fin_bank_lines_tenant_id_status on fin_bank_lines (tenant_id, status);
create index ix_channel_b2b_agencies_tenant_id_status on channel_b2b_agencies (tenant_id, status);
create index ix_channel_b2b_agencies_tenant_id_price_list_id on channel_b2b_agencies (tenant_id, price_list_id);
create index ix_channel_b2b_agencies_tenant_id_crm_client_id on channel_b2b_agencies (tenant_id, crm_client_id);
create index ix_channel_b2b_agencies_tenant_id_created_at_desc on channel_b2b_agencies (tenant_id, created_at desc);
create index ix_catalog_product_b2b_rates_tenant_id_agency_id on catalog_product_b2b_rates (tenant_id, agency_id);
create index ix_channel_b2b_settlement_requests_tenant_id_status on channel_b2b_settlement_requests (tenant_id, status);
create index ix_channel_b2b_credit_movements_tenant_id_agency_id_crea_13d548 on channel_b2b_credit_movements (tenant_id, agency_id, created_at desc);
create index ix_cms_contents_tenant_id_status on cms_contents (tenant_id, status);
create index ix_cms_contents_tenant_id_type on cms_contents (tenant_id, type);
create index ix_cms_contents_tenant_id_updated_at_desc on cms_contents (tenant_id, updated_at desc);
create index ix_channel_ecom_orders_tenant_id_status on channel_ecom_orders (tenant_id, status);
create index ix_channel_ecom_orders_tenant_id_ordered_at_desc on channel_ecom_orders (tenant_id, ordered_at desc);
create index ix_channel_ecom_orders_tenant_id_customer_email on channel_ecom_orders (tenant_id, customer_email);
create index ix_channel_ecom_orders_hold_expires_at_p on channel_ecom_orders (hold_expires_at) where status in ('pago_pendiente','pago_rechazado');
create index ix_channel_ecom_orders_tenant_id_reservation_id on channel_ecom_orders (tenant_id, reservation_id);
create index ix_channel_pax_feedback_tenant_id_reservation_id on channel_pax_feedback (tenant_id, reservation_id);
create index ix_channel_pax_feedback_tenant_id_status on channel_pax_feedback (tenant_id, status);
create index ix_collab_approval_rules_tenant_id_request_type_is_active on collab_approval_rules (tenant_id, request_type, is_active);
create index ix_collab_approval_requests_tenant_id_status_due_at on collab_approval_requests (tenant_id, status, due_at);
create index ix_collab_approval_requests_tenant_id_requester_id_creat_68c221 on collab_approval_requests (tenant_id, requester_id, created_at desc);
create index ix_collab_approval_requests_tenant_id_request_type_status on collab_approval_requests (tenant_id, request_type, status);
create index ix_collab_approval_requests_tenant_id_delegated_to_p on collab_approval_requests (tenant_id, delegated_to) where delegated_to is not null;
create index ix_collab_approval_requests_tenant_id_subject_type_subject_id on collab_approval_requests (tenant_id, subject_type, subject_id);
create index ix_collab_approval_requests_tenant_id_status on collab_approval_requests (tenant_id, status);
create index ix_collab_channel_accounts_channel_phone_number_id_p on collab_channel_accounts (channel, phone_number_id) where phone_number_id is not null;
create index ix_collab_channel_accounts_channel_mailbox_p on collab_channel_accounts (channel, mailbox) where mailbox is not null;
create index ix_collab_conversations_tenant_id_assignee_id_status on collab_conversations (tenant_id, assignee_id, status);
create index ix_collab_conversations_tenant_id_status_last_message_at_desc on collab_conversations (tenant_id, status, last_message_at desc);
create index ix_collab_conversations_tenant_id_contact_email on collab_conversations (tenant_id, contact_email);
create index ix_collab_conversations_tenant_id_contact_phone on collab_conversations (tenant_id, contact_phone);
create index ix_collab_conversations_tenant_id_last_inbound_at on collab_conversations (tenant_id, last_inbound_at);
create index ix_collab_conversations_tags on collab_conversations using gin (tags);
create index ix_collab_conversations_tenant_id_status on collab_conversations (tenant_id, status);
create index ix_collab_messages_conversation_id_sent_at on collab_messages (conversation_id, sent_at);
create index ix_collab_inbound_events_tenant_id_status on collab_inbound_events (tenant_id, status);
create index ix_catalog_allotments_tenant_id_status on catalog_allotments (tenant_id, status);
create index ix_catalog_allotments_tenant_id_owner_id on catalog_allotments (tenant_id, owner_id);
create index ix_catalog_allotments_tenant_id_provider_id on catalog_allotments (tenant_id, provider_id);
create index ix_catalog_allotments_tenant_id_service_id on catalog_allotments (tenant_id, service_id);
create index ix_catalog_allotment_days_tenant_id_service_date on catalog_allotment_days (tenant_id, service_date);
create index ix_catalog_allotment_requests_tenant_id_status on catalog_allotment_requests (tenant_id, status);
create index ix_catalog_allotment_events_allotment_id_occurred_at_desc on catalog_allotment_events (allotment_id, occurred_at desc);
create index ix_ops_travel_doc_items_tenant_id_reservation_id on ops_travel_doc_items (tenant_id, reservation_id);
create index ix_ops_travel_doc_items_tenant_id_status on ops_travel_doc_items (tenant_id, status);
create index ix_ops_travel_doc_reminders_reservation_id_sent_at_desc on ops_travel_doc_reminders (reservation_id, sent_at desc);
create index ix_fin_treasury_accounts_tenant_id_status on fin_treasury_accounts (tenant_id, status);
create index ix_fin_cash_replenishments_tenant_id_status on fin_cash_replenishments (tenant_id, status);
create index ix_fin_treasury_movements_tenant_id_account_id_movement_date on fin_treasury_movements (tenant_id, account_id, movement_date);
create index ix_fin_treasury_movements_tenant_id_movement_date_desc on fin_treasury_movements (tenant_id, movement_date desc);
create index ix_fin_treasury_movements_tenant_id_type on fin_treasury_movements (tenant_id, type);
create index ix_fin_treasury_movements_tenant_id_status on fin_treasury_movements (tenant_id, status);
create index ix_fin_treasury_movements_tenant_id_replenishment_id on fin_treasury_movements (tenant_id, replenishment_id);
create index ix_sys_booking_rules_scope on sys_booking_rules using gin (scope);
create index ix_booking_reservation_web_lodging_tenant_id_snapshot_id on booking_reservation_web_lodging (tenant_id, snapshot_id);
create index ix_notif_pax_messages_tenant_id_status_scheduled_at on notif_pax_messages (tenant_id, status, scheduled_at);
create index ix_notif_pax_messages_tenant_id_reservation_id on notif_pax_messages (tenant_id, reservation_id);
create index ix_channel_web_carts_last_activity_at_p on channel_web_carts (last_activity_at) where status = 'activo';
create index ix_channel_web_carts_tenant_id_status on channel_web_carts (tenant_id, status);
create index ix_channel_widget_handoffs_tenant_id_status_expires_at on channel_widget_handoffs (tenant_id, status, expires_at);
create index ix_channel_web_events_tenant_id_occurred_at_desc on channel_web_events (tenant_id, occurred_at desc);
create index ix_channel_web_events_tenant_id_event_occurred_at_desc on channel_web_events (tenant_id, event, occurred_at desc);
create index ix_supplier_rate_requests_tenant_id_created_at_desc on supplier_rate_requests (tenant_id, created_at desc);
create index ix_fin_fiscal_events_tenant_id_status on fin_fiscal_events (tenant_id, status);
create index ix_fin_reconciliation_closures_tenant_id_created_at_desc on fin_reconciliation_closures (tenant_id, created_at desc);
create index ix_fin_bank_lines_tenant_id_created_at_desc on fin_bank_lines (tenant_id, created_at desc);
create index ix_fin_period_closes_tenant_id_status on fin_period_closes (tenant_id, status);
create index ix_channel_b2b_price_lists_tenant_id_status on channel_b2b_price_lists (tenant_id, status);
create index ix_channel_b2b_settlement_requests_tenant_id_created_at_desc on channel_b2b_settlement_requests (tenant_id, created_at desc);
create index ix_cms_contents_tenant_id_created_at_desc on cms_contents (tenant_id, created_at desc);
create index ix_channel_ecom_orders_tenant_id_created_at_desc on channel_ecom_orders (tenant_id, created_at desc);
create index ix_channel_pax_feedback_tenant_id_created_at_desc on channel_pax_feedback (tenant_id, created_at desc);
create index ix_collab_approval_rules_tenant_id_created_at_desc on collab_approval_rules (tenant_id, created_at desc);
create index ix_collab_approval_requests_tenant_id_created_at_desc on collab_approval_requests (tenant_id, created_at desc);
create index ix_collab_channel_accounts_tenant_id_status on collab_channel_accounts (tenant_id, status);
create index ix_collab_reply_templates_tenant_id_created_at_desc on collab_reply_templates (tenant_id, created_at desc);
create index ix_collab_conversations_tenant_id_created_at_desc on collab_conversations (tenant_id, created_at desc);
create index ix_catalog_allotments_tenant_id_created_at_desc on catalog_allotments (tenant_id, created_at desc);
create index ix_catalog_allotment_requests_tenant_id_created_at_desc on catalog_allotment_requests (tenant_id, created_at desc);
create index ix_fin_treasury_accounts_tenant_id_created_at_desc on fin_treasury_accounts (tenant_id, created_at desc);
create index ix_fin_treasury_transfers_tenant_id_created_at_desc on fin_treasury_transfers (tenant_id, created_at desc);
create index ix_fin_cash_replenishments_tenant_id_created_at_desc on fin_cash_replenishments (tenant_id, created_at desc);
create index ix_fin_treasury_movements_tenant_id_created_at_desc on fin_treasury_movements (tenant_id, created_at desc);
create index ix_fin_cash_sessions_tenant_id_status on fin_cash_sessions (tenant_id, status);
create index ix_fin_cash_sessions_tenant_id_created_at_desc on fin_cash_sessions (tenant_id, created_at desc);
create index ix_fin_cash_counts_tenant_id_status on fin_cash_counts (tenant_id, status);
create index ix_fin_cash_counts_tenant_id_created_at_desc on fin_cash_counts (tenant_id, created_at desc);
create index ix_fin_fx_revaluations_tenant_id_created_at_desc on fin_fx_revaluations (tenant_id, created_at desc);
create index ix_sys_booking_rules_tenant_id_created_at_desc on sys_booking_rules (tenant_id, created_at desc);
create index ix_catalog_product_addons_tenant_id_created_at_desc on catalog_product_addons (tenant_id, created_at desc);
create index ix_catalog_accommodation_legs_tenant_id_created_at_desc on catalog_accommodation_legs (tenant_id, created_at desc);
create index ix_catalog_accommodation_hotels_tenant_id_created_at_desc on catalog_accommodation_hotels (tenant_id, created_at desc);
create index ix_notif_pax_message_templates_tenant_id_created_at_desc on notif_pax_message_templates (tenant_id, created_at desc);
create index ix_notif_pax_messages_tenant_id_status on notif_pax_messages (tenant_id, status);
create index ix_notif_pax_messages_tenant_id_created_at_desc on notif_pax_messages (tenant_id, created_at desc);
create index ix_fin_currencies_tenant_id_created_at_desc on fin_currencies (tenant_id, created_at desc);
create index ix_fx_rate_providers_tenant_id_status on fx_rate_providers (tenant_id, status);
create index ix_fx_rate_providers_tenant_id_created_at_desc on fx_rate_providers (tenant_id, created_at desc);
create index ix_channel_widget_domains_tenant_id_status on channel_widget_domains (tenant_id, status);
create index ix_channel_web_carts_tenant_id_created_at_desc on channel_web_carts (tenant_id, created_at desc);
create index ix_channel_widget_handoffs_tenant_id_status on channel_widget_handoffs (tenant_id, status);
create index ix_channel_widget_handoffs_tenant_id_created_at_desc on channel_widget_handoffs (tenant_id, created_at desc);
create index ix_iam_users_agency_id on iam_users (agency_id);
create index ix_crm_clients_b2b_agency_id on crm_clients (b2b_agency_id);
create index ix_crm_leads_matched_client_id on crm_leads (matched_client_id);
create index ix_quote_versions_approval_request_id on quote_versions (approval_request_id);
create index ix_booking_reservations_agency_id on booking_reservations (agency_id);
create index ix_booking_reservations_ecom_order_id on booking_reservations (ecom_order_id);
create index ix_booking_reservations_cancel_request_id on booking_reservations (cancel_request_id);
create index ix_booking_reservation_services_addon_id on booking_reservation_services (addon_id);
create index ix_booking_cancellations_credit_note_id on booking_cancellations (credit_note_id);
create index ix_ops_assignment_checkins_device_id on ops_assignment_checkins (device_id);
create index ix_fin_payments_reversal_request_id on fin_payments (reversal_request_id);
create index ix_fin_payable_payouts_bank_line_id on fin_payable_payouts (bank_line_id);
create index ix_fin_commissions_beneficiary_agency_id on fin_commissions (beneficiary_agency_id);
create index ix_fin_commissions_settlement_request_id on fin_commissions (settlement_request_id);
create index ix_fin_fx_rates_provider_id on fin_fx_rates (provider_id);
create index ix_ops_mobile_devices_user_id on ops_mobile_devices (user_id);
create index ix_ops_sync_actions_user_id on ops_sync_actions (user_id);
create index ix_ops_sync_actions_device_id on ops_sync_actions (device_id);
create index ix_ops_sync_actions_assignment_id on ops_sync_actions (assignment_id);
create index ix_channel_trip_messages_reservation_id on channel_trip_messages (reservation_id);
create index ix_channel_trip_messages_sender_user_id on channel_trip_messages (sender_user_id);
create index ix_catalog_service_cost_history_service_id on catalog_service_cost_history (service_id);
create index ix_catalog_service_cost_history_rate_request_id on catalog_service_cost_history (rate_request_id);
create index ix_catalog_service_cost_history_approval_request_id on catalog_service_cost_history (approval_request_id);
create index ix_supplier_request_responses_supplier_request_id on supplier_request_responses (supplier_request_id);
create index ix_supplier_request_responses_reservation_service_id on supplier_request_responses (reservation_service_id);
create index ix_supplier_request_responses_provider_id on supplier_request_responses (provider_id);
create index ix_supplier_request_responses_responded_by_user_id on supplier_request_responses (responded_by_user_id);
create index ix_supplier_request_responses_alt_service_id on supplier_request_responses (alt_service_id);
create index ix_supplier_request_responses_reviewed_by on supplier_request_responses (reviewed_by);
create index ix_supplier_invoices_payable_id on supplier_invoices (payable_id);
create index ix_supplier_invoices_provider_id on supplier_invoices (provider_id);
create index ix_supplier_invoices_document_id on supplier_invoices (document_id);
create index ix_supplier_invoices_uploaded_by on supplier_invoices (uploaded_by);
create index ix_supplier_invoices_validated_by on supplier_invoices (validated_by);
create index ix_supplier_rate_requests_provider_id on supplier_rate_requests (provider_id);
create index ix_supplier_rate_requests_service_id on supplier_rate_requests (service_id);
create index ix_supplier_rate_requests_requested_by on supplier_rate_requests (requested_by);
create index ix_supplier_rate_requests_reviewed_by on supplier_rate_requests (reviewed_by);
create index ix_supplier_rate_requests_resulting_rate_id on supplier_rate_requests (resulting_rate_id);
create index ix_fin_document_series_sede_id on fin_document_series (sede_id);
create index ix_fin_invoices_client_id on fin_invoices (client_id);
create index ix_fin_invoices_reservation_id on fin_invoices (reservation_id);
create index ix_fin_invoices_receivable_id on fin_invoices (receivable_id);
create index ix_fin_invoices_ref_invoice_id on fin_invoices (ref_invoice_id);
create index ix_fin_invoices_xml_document_id on fin_invoices (xml_document_id);
create index ix_fin_invoices_cdr_document_id on fin_invoices (cdr_document_id);
create index ix_fin_invoices_pdf_document_id on fin_invoices (pdf_document_id);
create index ix_fin_invoices_issued_by on fin_invoices (issued_by);
create index ix_fin_fiscal_events_invoice_id on fin_fiscal_events (invoice_id);
create index ix_fin_fiscal_events_payload_document_id on fin_fiscal_events (payload_document_id);
create index ix_fin_bank_statements_bank_account_id on fin_bank_statements (bank_account_id);
create index ix_fin_bank_statements_document_id on fin_bank_statements (document_id);
create index ix_fin_bank_statements_imported_by on fin_bank_statements (imported_by);
create index ix_fin_reconciliation_closures_closed_by on fin_reconciliation_closures (closed_by);
create index ix_fin_bank_lines_statement_id on fin_bank_lines (statement_id);
create index ix_fin_bank_lines_matched_payment_id on fin_bank_lines (matched_payment_id);
create index ix_fin_bank_lines_matched_payable_id on fin_bank_lines (matched_payable_id);
create index ix_fin_bank_lines_resolved_by on fin_bank_lines (resolved_by);
create index ix_fin_bank_lines_closure_id on fin_bank_lines (closure_id);
create index ix_fin_period_closes_closed_by on fin_period_closes (closed_by);
create index ix_fin_period_close_checks_checked_by on fin_period_close_checks (checked_by);
create index ix_channel_b2b_agencies_crm_client_id on channel_b2b_agencies (crm_client_id);
create index ix_channel_b2b_agencies_price_list_id on channel_b2b_agencies (price_list_id);
create index ix_catalog_product_b2b_rates_product_id on catalog_product_b2b_rates (product_id);
create index ix_catalog_product_b2b_rates_agency_id on catalog_product_b2b_rates (agency_id);
create index ix_catalog_product_b2b_rates_price_list_id on catalog_product_b2b_rates (price_list_id);
create index ix_channel_b2b_settlement_requests_agency_id on channel_b2b_settlement_requests (agency_id);
create index ix_channel_b2b_settlement_requests_requested_by on channel_b2b_settlement_requests (requested_by);
create index ix_channel_b2b_credit_movements_agency_id on channel_b2b_credit_movements (agency_id);
create index ix_channel_b2b_credit_movements_reservation_id on channel_b2b_credit_movements (reservation_id);
create index ix_channel_b2b_credit_movements_payment_id on channel_b2b_credit_movements (payment_id);
create index ix_channel_b2b_credit_exceptions_agency_id on channel_b2b_credit_exceptions (agency_id);
create index ix_channel_b2b_credit_exceptions_approval_request_id on channel_b2b_credit_exceptions (approval_request_id);
create index ix_cms_contents_author_id on cms_contents (author_id);
create index ix_cms_content_events_content_id on cms_content_events (content_id);
create index ix_cms_content_events_user_id on cms_content_events (user_id);
create index ix_channel_ecom_orders_crm_client_id on channel_ecom_orders (crm_client_id);
create index ix_channel_ecom_orders_product_id on channel_ecom_orders (product_id);
create index ix_channel_ecom_orders_departure_id on channel_ecom_orders (departure_id);
create index ix_channel_ecom_orders_promotion_id on channel_ecom_orders (promotion_id);
create index ix_channel_ecom_orders_reservation_id on channel_ecom_orders (reservation_id);
create index ix_channel_ecom_orders_receivable_id on channel_ecom_orders (receivable_id);
create index ix_channel_ecom_orders_cart_id on channel_ecom_orders (cart_id);
create index ix_channel_ecom_order_lines_product_id on channel_ecom_order_lines (product_id);
create index ix_channel_ecom_order_lines_departure_id on channel_ecom_order_lines (departure_id);
create index ix_channel_ecom_order_lines_rate_id on channel_ecom_order_lines (rate_id);
create index ix_channel_ecom_order_lines_season_id on channel_ecom_order_lines (season_id);
create index ix_channel_ecom_order_lines_promotion_id on channel_ecom_order_lines (promotion_id);
create index ix_channel_ecom_order_lines_hold_id on channel_ecom_order_lines (hold_id);
create index ix_channel_ecom_order_lines_reservation_service_id on channel_ecom_order_lines (reservation_service_id);
create index ix_channel_ecom_payment_attempts_order_id on channel_ecom_payment_attempts (order_id);
create index ix_channel_ecom_payment_attempts_payment_id on channel_ecom_payment_attempts (payment_id);
create index ix_channel_portal_access_links_reservation_id on channel_portal_access_links (reservation_id);
create index ix_channel_portal_access_links_passenger_id on channel_portal_access_links (passenger_id);
create index ix_ops_incident_pax_acks_user_id on ops_incident_pax_acks (user_id);
create index ix_channel_pax_feedback_reservation_id on channel_pax_feedback (reservation_id);
create index ix_channel_pax_feedback_reservation_service_id on channel_pax_feedback (reservation_service_id);
create index ix_channel_pax_feedback_replied_by on channel_pax_feedback (replied_by);
create index ix_channel_pax_feedback_conversation_id on channel_pax_feedback (conversation_id);
create index ix_channel_pax_feedback_incident_id on channel_pax_feedback (incident_id);
create index ix_collab_approval_requests_requester_id on collab_approval_requests (requester_id);
create index ix_collab_approval_requests_requester_supplier_id on collab_approval_requests (requester_supplier_id);
create index ix_collab_approval_requests_delegated_to on collab_approval_requests (delegated_to);
create index ix_collab_approval_requests_decided_by on collab_approval_requests (decided_by);
create index ix_collab_approval_steps_rule_id on collab_approval_steps (rule_id);
create index ix_collab_approval_steps_decided_by on collab_approval_steps (decided_by);
create index ix_collab_approval_info_requests_request_id on collab_approval_info_requests (request_id);
create index ix_collab_approval_info_requests_asked_by on collab_approval_info_requests (asked_by);
create index ix_collab_approval_info_requests_answered_by on collab_approval_info_requests (answered_by);
create index ix_collab_approval_events_request_id on collab_approval_events (request_id);
create index ix_collab_approval_events_actor_id on collab_approval_events (actor_id);
create index ix_collab_conversations_channel_account_id on collab_conversations (channel_account_id);
create index ix_collab_conversations_assignee_id on collab_conversations (assignee_id);
create index ix_collab_conversations_client_id on collab_conversations (client_id);
create index ix_collab_conversations_lead_id on collab_conversations (lead_id);
create index ix_collab_conversations_reservation_id on collab_conversations (reservation_id);
create index ix_collab_conversations_quote_id on collab_conversations (quote_id);
create index ix_collab_conversations_support_ticket_id on collab_conversations (support_ticket_id);
create index ix_collab_conversations_feedback_id on collab_conversations (feedback_id);
create index ix_collab_conversations_resolved_by on collab_conversations (resolved_by);
create index ix_collab_messages_author_user_id on collab_messages (author_user_id);
create index ix_collab_messages_template_id on collab_messages (template_id);
create index ix_collab_message_attachments_message_id on collab_message_attachments (message_id);
create index ix_catalog_allotments_provider_id on catalog_allotments (provider_id);
create index ix_catalog_allotments_service_id on catalog_allotments (service_id);
create index ix_catalog_allotments_owner_id on catalog_allotments (owner_id);
create index ix_catalog_allotment_days_retained_by on catalog_allotment_days (retained_by);
create index ix_catalog_allotment_consumptions_booking_service_id on catalog_allotment_consumptions (booking_service_id);
create index ix_catalog_allotment_consumptions_reservation_id on catalog_allotment_consumptions (reservation_id);
create index ix_catalog_allotment_requests_allotment_id on catalog_allotment_requests (allotment_id);
create index ix_catalog_allotment_requests_responded_by on catalog_allotment_requests (responded_by);
create index ix_catalog_allotment_charges_payable_id on catalog_allotment_charges (payable_id);
create index ix_catalog_allotment_events_user_id on catalog_allotment_events (user_id);
create index ix_ops_travel_doc_items_reservation_id on ops_travel_doc_items (reservation_id);
create index ix_ops_travel_doc_items_file_id on ops_travel_doc_items (file_id);
create index ix_ops_travel_doc_items_validated_by on ops_travel_doc_items (validated_by);
create index ix_ops_travel_doc_reminders_sent_by on ops_travel_doc_reminders (sent_by);
create index ix_fin_treasury_accounts_sede_id on fin_treasury_accounts (sede_id);
create index ix_fin_treasury_accounts_custodian_id on fin_treasury_accounts (custodian_id);
create index ix_fin_treasury_accounts_settle_to_account_id on fin_treasury_accounts (settle_to_account_id);
create index ix_fin_treasury_transfers_from_account_id on fin_treasury_transfers (from_account_id);
create index ix_fin_treasury_transfers_to_account_id on fin_treasury_transfers (to_account_id);
create index ix_fin_cash_replenishments_account_id on fin_cash_replenishments (account_id);
create index ix_fin_cash_replenishments_requested_by on fin_cash_replenishments (requested_by);
create index ix_fin_cash_replenishments_approved_by on fin_cash_replenishments (approved_by);
create index ix_fin_cash_replenishments_paid_by on fin_cash_replenishments (paid_by);
create index ix_fin_cash_replenishments_paid_from_account_id on fin_cash_replenishments (paid_from_account_id);
create index ix_fin_cash_replenishments_transfer_id on fin_cash_replenishments (transfer_id);
create index ix_fin_cash_replenishment_events_replenishment_id on fin_cash_replenishment_events (replenishment_id);
create index ix_fin_cash_replenishment_events_user_id on fin_cash_replenishment_events (user_id);
create index ix_fin_treasury_movements_account_id on fin_treasury_movements (account_id);
create index ix_fin_treasury_movements_transfer_id on fin_treasury_movements (transfer_id);
create index ix_fin_treasury_movements_replenishment_id on fin_treasury_movements (replenishment_id);
create index ix_fin_treasury_movements_reservation_id on fin_treasury_movements (reservation_id);
create index ix_fin_treasury_movements_sede_id on fin_treasury_movements (sede_id);
create index ix_fin_treasury_movements_deposited_transfer_id on fin_treasury_movements (deposited_transfer_id);
create index ix_fin_treasury_movements_voided_by on fin_treasury_movements (voided_by);
create index ix_fin_cash_sessions_account_id on fin_cash_sessions (account_id);
create index ix_fin_cash_sessions_opened_by on fin_cash_sessions (opened_by);
create index ix_fin_cash_sessions_closed_by on fin_cash_sessions (closed_by);
create index ix_fin_cash_sessions_closing_count_id on fin_cash_sessions (closing_count_id);
create index ix_fin_cash_counts_account_id on fin_cash_counts (account_id);
create index ix_fin_cash_counts_session_id on fin_cash_counts (session_id);
create index ix_fin_cash_counts_signed_by on fin_cash_counts (signed_by);
create index ix_fin_cash_counts_witness_id on fin_cash_counts (witness_id);
create index ix_fin_cash_counts_approved_by on fin_cash_counts (approved_by);
create index ix_fin_cash_counts_validated_by on fin_cash_counts (validated_by);
create index ix_fin_cash_counts_adjustment_movement_id on fin_cash_counts (adjustment_movement_id);
create index ix_fin_fx_revaluations_account_id on fin_fx_revaluations (account_id);
create index ix_catalog_product_rule_overrides_product_id on catalog_product_rule_overrides (product_id);
create index ix_catalog_product_addons_product_id on catalog_product_addons (product_id);
create index ix_catalog_product_addons_provider_id on catalog_product_addons (provider_id);
create index ix_catalog_product_addons_service_id on catalog_product_addons (service_id);
create index ix_catalog_accommodation_legs_product_id on catalog_accommodation_legs (product_id);
create index ix_catalog_accommodation_legs_destination_id on catalog_accommodation_legs (destination_id);
create index ix_catalog_accommodation_hotels_provider_id on catalog_accommodation_hotels (provider_id);
create index ix_booking_reservation_web_snapshots_reservation_id on booking_reservation_web_snapshots (reservation_id);
create index ix_booking_reservation_web_snapshots_product_id on booking_reservation_web_snapshots (product_id);
create index ix_booking_reservation_web_lodging_snapshot_id on booking_reservation_web_lodging (snapshot_id);
create index ix_booking_reservation_web_lodging_hotel_id on booking_reservation_web_lodging (hotel_id);
create index ix_booking_reservation_web_addons_snapshot_id on booking_reservation_web_addons (snapshot_id);
create index ix_booking_reservation_web_addons_addon_id on booking_reservation_web_addons (addon_id);
create index ix_notif_pax_messages_reservation_id on notif_pax_messages (reservation_id);
create index ix_notif_pax_messages_template_id on notif_pax_messages (template_id);
create index ix_notif_pax_messages_feedback_id on notif_pax_messages (feedback_id);
create index ix_channel_web_carts_crm_client_id on channel_web_carts (crm_client_id);
create index ix_channel_web_carts_order_id on channel_web_carts (order_id);
create index ix_channel_web_cart_items_product_id on channel_web_cart_items (product_id);
create index ix_channel_web_cart_items_departure_id on channel_web_cart_items (departure_id);
create index ix_channel_web_cart_items_hold_id on channel_web_cart_items (hold_id);
create index ix_channel_widget_handoffs_product_id on channel_widget_handoffs (product_id);
create index ix_channel_widget_handoffs_cart_id on channel_widget_handoffs (cart_id);
create index ix_channel_wishlist_items_crm_client_id on channel_wishlist_items (crm_client_id);
create index ix_channel_wishlist_items_product_id on channel_wishlist_items (product_id);
create index ix_catalog_destination_contents_hero_media_id on catalog_destination_contents (hero_media_id);
create index ix_fin_invoice_lines_tenant_id on fin_invoice_lines (tenant_id);
create index ix_fin_bank_statements_tenant_id on fin_bank_statements (tenant_id);
create index ix_fin_period_close_checks_tenant_id on fin_period_close_checks (tenant_id);
create index ix_channel_b2b_credit_exceptions_tenant_id on channel_b2b_credit_exceptions (tenant_id);
create index ix_cms_content_events_tenant_id on cms_content_events (tenant_id);
create index ix_channel_ecom_order_lines_tenant_id on channel_ecom_order_lines (tenant_id);
create index ix_channel_ecom_passengers_tenant_id on channel_ecom_passengers (tenant_id);
create index ix_channel_ecom_payment_attempts_tenant_id on channel_ecom_payment_attempts (tenant_id);
create index ix_channel_portal_access_links_tenant_id on channel_portal_access_links (tenant_id);
create index ix_ops_incident_pax_acks_tenant_id on ops_incident_pax_acks (tenant_id);
create index ix_collab_approval_steps_tenant_id on collab_approval_steps (tenant_id);
create index ix_collab_approval_info_requests_tenant_id on collab_approval_info_requests (tenant_id);
create index ix_collab_approval_events_tenant_id on collab_approval_events (tenant_id);
create index ix_collab_messages_tenant_id on collab_messages (tenant_id);
create index ix_collab_message_attachments_tenant_id on collab_message_attachments (tenant_id);
create index ix_catalog_allotment_consumptions_tenant_id on catalog_allotment_consumptions (tenant_id);
create index ix_catalog_allotment_charges_tenant_id on catalog_allotment_charges (tenant_id);
create index ix_catalog_allotment_events_tenant_id on catalog_allotment_events (tenant_id);
create index ix_ops_travel_doc_contacts_tenant_id on ops_travel_doc_contacts (tenant_id);
create index ix_ops_travel_doc_special_tenant_id on ops_travel_doc_special (tenant_id);
create index ix_ops_travel_doc_reminders_tenant_id on ops_travel_doc_reminders (tenant_id);
create index ix_fin_cash_replenishment_events_tenant_id on fin_cash_replenishment_events (tenant_id);
create index ix_fin_expense_receipts_tenant_id on fin_expense_receipts (tenant_id);
create index ix_catalog_accommodation_room_types_tenant_id on catalog_accommodation_room_types (tenant_id);
create index ix_catalog_payment_policies_tenant_id on catalog_payment_policies (tenant_id);
create index ix_catalog_pickup_points_tenant_id on catalog_pickup_points (tenant_id);
create index ix_booking_reservation_web_addons_tenant_id on booking_reservation_web_addons (tenant_id);
create index ix_channel_web_cart_items_tenant_id on channel_web_cart_items (tenant_id);

-- ---------------------------------------------------------------- restricciones de exclusión y triggers específicos
create trigger trg_fin_document_series_no_decrease before update on fin_document_series for each row execute function app_sequence_no_decrease();
create trigger trg_channel_b2b_credit_movements_append_only before update or delete on channel_b2b_credit_movements for each row execute function app_forbid_update_delete();
create trigger trg_collab_approval_events_append_only before update or delete on collab_approval_events for each row execute function app_forbid_update_delete();
alter table catalog_allotments add constraint ex_catalog_allotments_overlap exclude using gist (tenant_id with =, service_id with =, daterange(valid_from, valid_to, '[]') with &&) where (status in ('activo','en_release') and deleted_at is null);
alter table catalog_product_rule_overrides add constraint fk_catalog_product_rule_overrides_rule foreign key (tenant_id, rule_code) references sys_booking_rules (tenant_id, code) on delete cascade;
create or replace function app_rule_override_guard() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from sys_booking_rules r
                 where r.tenant_id = new.tenant_id and r.code = new.rule_code and r.product_override) then
    raise exception 'La regla % no admite excepción por producto (CAT-RL-01)', new.rule_code using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger trg_catalog_product_rule_overrides_guard before insert or update on catalog_product_rule_overrides for each row execute function app_rule_override_guard();
alter table catalog_accommodation_legs add constraint uq_catalog_accommodation_legs_seq unique (product_id, sequence) deferrable initially immediate;

-- ---------------------------------------------------------------- triggers de updated_at / lock_version
create trigger trg_ops_mobile_devices_updated_at before update on ops_mobile_devices for each row execute function app_set_updated_at();
create trigger trg_supplier_request_responses_updated_at before update on supplier_request_responses for each row execute function app_set_updated_at();
create trigger trg_supplier_invoices_updated_at before update on supplier_invoices for each row execute function app_set_updated_at();
create trigger trg_supplier_rate_requests_updated_at before update on supplier_rate_requests for each row execute function app_set_updated_at();
create trigger trg_fin_document_series_updated_at before update on fin_document_series for each row execute function app_set_updated_at();
create trigger trg_fin_invoices_updated_at before update on fin_invoices for each row execute function app_set_updated_at();
create trigger trg_fin_invoices_lock_version before update on fin_invoices for each row execute function app_bump_lock_version();
create trigger trg_fin_invoice_lines_updated_at before update on fin_invoice_lines for each row execute function app_set_updated_at();
create trigger trg_fin_bank_statements_updated_at before update on fin_bank_statements for each row execute function app_set_updated_at();
create trigger trg_fin_reconciliation_closures_updated_at before update on fin_reconciliation_closures for each row execute function app_set_updated_at();
create trigger trg_fin_bank_lines_updated_at before update on fin_bank_lines for each row execute function app_set_updated_at();
create trigger trg_fin_period_closes_updated_at before update on fin_period_closes for each row execute function app_set_updated_at();
create trigger trg_fin_period_close_checks_updated_at before update on fin_period_close_checks for each row execute function app_set_updated_at();
create trigger trg_channel_b2b_price_lists_updated_at before update on channel_b2b_price_lists for each row execute function app_set_updated_at();
create trigger trg_channel_b2b_agencies_updated_at before update on channel_b2b_agencies for each row execute function app_set_updated_at();
create trigger trg_channel_b2b_agencies_lock_version before update on channel_b2b_agencies for each row execute function app_bump_lock_version();
create trigger trg_catalog_product_b2b_rates_updated_at before update on catalog_product_b2b_rates for each row execute function app_set_updated_at();
create trigger trg_channel_b2b_settlement_requests_updated_at before update on channel_b2b_settlement_requests for each row execute function app_set_updated_at();
create trigger trg_cms_contents_updated_at before update on cms_contents for each row execute function app_set_updated_at();
create trigger trg_cms_contents_lock_version before update on cms_contents for each row execute function app_bump_lock_version();
create trigger trg_channel_ecom_orders_updated_at before update on channel_ecom_orders for each row execute function app_set_updated_at();
create trigger trg_channel_ecom_orders_lock_version before update on channel_ecom_orders for each row execute function app_bump_lock_version();
create trigger trg_channel_ecom_order_lines_updated_at before update on channel_ecom_order_lines for each row execute function app_set_updated_at();
create trigger trg_channel_ecom_passengers_updated_at before update on channel_ecom_passengers for each row execute function app_set_updated_at();
create trigger trg_channel_pax_feedback_updated_at before update on channel_pax_feedback for each row execute function app_set_updated_at();
create trigger trg_collab_approval_rules_updated_at before update on collab_approval_rules for each row execute function app_set_updated_at();
create trigger trg_collab_approval_requests_updated_at before update on collab_approval_requests for each row execute function app_set_updated_at();
create trigger trg_collab_approval_requests_lock_version before update on collab_approval_requests for each row execute function app_bump_lock_version();
create trigger trg_collab_approval_info_requests_updated_at before update on collab_approval_info_requests for each row execute function app_set_updated_at();
create trigger trg_collab_channel_accounts_updated_at before update on collab_channel_accounts for each row execute function app_set_updated_at();
create trigger trg_collab_reply_templates_updated_at before update on collab_reply_templates for each row execute function app_set_updated_at();
create trigger trg_collab_conversations_updated_at before update on collab_conversations for each row execute function app_set_updated_at();
create trigger trg_collab_conversations_lock_version before update on collab_conversations for each row execute function app_bump_lock_version();
create trigger trg_catalog_allotments_updated_at before update on catalog_allotments for each row execute function app_set_updated_at();
create trigger trg_catalog_allotments_lock_version before update on catalog_allotments for each row execute function app_bump_lock_version();
create trigger trg_catalog_allotment_days_updated_at before update on catalog_allotment_days for each row execute function app_set_updated_at();
create trigger trg_catalog_allotment_days_lock_version before update on catalog_allotment_days for each row execute function app_bump_lock_version();
create trigger trg_catalog_allotment_consumptions_updated_at before update on catalog_allotment_consumptions for each row execute function app_set_updated_at();
create trigger trg_catalog_allotment_requests_updated_at before update on catalog_allotment_requests for each row execute function app_set_updated_at();
create trigger trg_catalog_allotment_charges_updated_at before update on catalog_allotment_charges for each row execute function app_set_updated_at();
create trigger trg_ops_travel_doc_items_updated_at before update on ops_travel_doc_items for each row execute function app_set_updated_at();
create trigger trg_ops_travel_doc_items_lock_version before update on ops_travel_doc_items for each row execute function app_bump_lock_version();
create trigger trg_ops_travel_doc_contacts_updated_at before update on ops_travel_doc_contacts for each row execute function app_set_updated_at();
create trigger trg_ops_travel_doc_special_updated_at before update on ops_travel_doc_special for each row execute function app_set_updated_at();
create trigger trg_fin_treasury_accounts_updated_at before update on fin_treasury_accounts for each row execute function app_set_updated_at();
create trigger trg_fin_treasury_accounts_lock_version before update on fin_treasury_accounts for each row execute function app_bump_lock_version();
create trigger trg_fin_treasury_transfers_updated_at before update on fin_treasury_transfers for each row execute function app_set_updated_at();
create trigger trg_fin_cash_replenishments_updated_at before update on fin_cash_replenishments for each row execute function app_set_updated_at();
create trigger trg_fin_treasury_movements_updated_at before update on fin_treasury_movements for each row execute function app_set_updated_at();
create trigger trg_fin_expense_receipts_updated_at before update on fin_expense_receipts for each row execute function app_set_updated_at();
create trigger trg_fin_cash_sessions_updated_at before update on fin_cash_sessions for each row execute function app_set_updated_at();
create trigger trg_fin_cash_counts_updated_at before update on fin_cash_counts for each row execute function app_set_updated_at();
create trigger trg_fin_fx_revaluations_updated_at before update on fin_fx_revaluations for each row execute function app_set_updated_at();
create trigger trg_fin_treasury_settings_updated_at before update on fin_treasury_settings for each row execute function app_set_updated_at();
create trigger trg_sys_booking_rules_updated_at before update on sys_booking_rules for each row execute function app_set_updated_at();
create trigger trg_sys_booking_rules_lock_version before update on sys_booking_rules for each row execute function app_bump_lock_version();
create trigger trg_catalog_product_rule_overrides_updated_at before update on catalog_product_rule_overrides for each row execute function app_set_updated_at();
create trigger trg_catalog_product_addons_updated_at before update on catalog_product_addons for each row execute function app_set_updated_at();
create trigger trg_catalog_accommodation_legs_updated_at before update on catalog_accommodation_legs for each row execute function app_set_updated_at();
create trigger trg_catalog_accommodation_hotels_updated_at before update on catalog_accommodation_hotels for each row execute function app_set_updated_at();
create trigger trg_catalog_accommodation_room_types_updated_at before update on catalog_accommodation_room_types for each row execute function app_set_updated_at();
create trigger trg_catalog_payment_policies_updated_at before update on catalog_payment_policies for each row execute function app_set_updated_at();
create trigger trg_catalog_pickup_points_updated_at before update on catalog_pickup_points for each row execute function app_set_updated_at();
create trigger trg_booking_reservation_web_snapshots_updated_at before update on booking_reservation_web_snapshots for each row execute function app_set_updated_at();
create trigger trg_booking_reservation_web_lodging_updated_at before update on booking_reservation_web_lodging for each row execute function app_set_updated_at();
create trigger trg_booking_reservation_web_addons_updated_at before update on booking_reservation_web_addons for each row execute function app_set_updated_at();
create trigger trg_notif_pax_message_templates_updated_at before update on notif_pax_message_templates for each row execute function app_set_updated_at();
create trigger trg_notif_pax_messages_updated_at before update on notif_pax_messages for each row execute function app_set_updated_at();
create trigger trg_fin_currencies_updated_at before update on fin_currencies for each row execute function app_set_updated_at();
create trigger trg_fx_rate_providers_updated_at before update on fx_rate_providers for each row execute function app_set_updated_at();
create trigger trg_channel_widget_config_updated_at before update on channel_widget_config for each row execute function app_set_updated_at();
create trigger trg_channel_widget_domains_updated_at before update on channel_widget_domains for each row execute function app_set_updated_at();
create trigger trg_channel_web_carts_updated_at before update on channel_web_carts for each row execute function app_set_updated_at();
create trigger trg_channel_web_carts_lock_version before update on channel_web_carts for each row execute function app_bump_lock_version();
create trigger trg_channel_web_cart_items_updated_at before update on channel_web_cart_items for each row execute function app_set_updated_at();
create trigger trg_channel_widget_handoffs_updated_at before update on channel_widget_handoffs for each row execute function app_set_updated_at();
create trigger trg_catalog_product_translations_updated_at before update on catalog_product_translations for each row execute function app_set_updated_at();
create trigger trg_catalog_destination_contents_updated_at before update on catalog_destination_contents for each row execute function app_set_updated_at();

-- ---------------------------------------------------------------- comentarios (spec de origen)
comment on column iam_users.provider_role is 'Columnas agregadas en Fase 2 por spec 06 §3.1 + 15 §3.10';
comment on column iam_users.created_via is 'Columnas agregadas en Fase 2 por spec 06 §3.1 + 15 §3.10';
comment on column iam_users.email_verified_at is 'Columnas agregadas en Fase 2 por spec 06 §3.1 + 15 §3.10';
comment on column catalog_services.scheduled_cost is 'Columnas agregadas en Fase 2 por spec 10 §3.11';
comment on column catalog_services.scheduled_cost_from is 'Columnas agregadas en Fase 2 por spec 10 §3.11';
comment on column catalog_products.accommodation_enabled is 'Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11';
comment on column catalog_products.accommodation_optional is 'Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11';
comment on column catalog_products.accommodation_currency is 'Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11';
comment on column catalog_products.accommodation_note is 'Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11';
comment on column catalog_products.pickup_required is 'Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11';
comment on column catalog_products.pickup_ask_flight is 'Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11';
comment on column catalog_products.difficulty is 'Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11';
comment on column catalog_products.guide_languages is 'Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11';
comment on column catalog_products.pickup_text is 'Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11';
comment on column catalog_products.rating_avg is 'Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11';
comment on column catalog_products.rating_count is 'Columnas agregadas en Fase 2 por spec 16 §3.6, §3.8 + 15 §3.11';
comment on column catalog_product_media.alt_i18n is 'Columnas agregadas en Fase 2 por spec 15 §3.11';
comment on column catalog_product_media.caption_i18n is 'Columnas agregadas en Fase 2 por spec 15 §3.11';
comment on column catalog_product_media.width is 'Columnas agregadas en Fase 2 por spec 15 §3.11';
comment on column catalog_product_media.height is 'Columnas agregadas en Fase 2 por spec 15 §3.11';
comment on column catalog_product_media.blurhash is 'Columnas agregadas en Fase 2 por spec 15 §3.11';
comment on column crm_clients.consents is 'Columnas agregadas en Fase 2 por spec 15 §3.10';
comment on column crm_leads.web_request is 'Columnas agregadas en Fase 2 por spec 15 §3.9';
comment on column crm_leads.matched_client_id is 'Columnas agregadas en Fase 2 por spec 15 §3.9';
comment on column crm_leads.sla_due_at is 'Columnas agregadas en Fase 2 por spec 15 §3.9';
comment on column crm_leads.consent is 'Columnas agregadas en Fase 2 por spec 15 §3.9';
comment on column quote_versions.approval_request_id is 'Columnas agregadas en Fase 2 por spec 10 §3.11';
comment on column booking_reservations.ecom_order_id is 'Columnas agregadas en Fase 2 por spec 08 §3.15 + 10 §3.11';
comment on column booking_reservations.b2b_terms is 'Columnas agregadas en Fase 2 por spec 08 §3.15 + 10 §3.11';
comment on column booking_reservations.cancel_request_id is 'Columnas agregadas en Fase 2 por spec 08 §3.15 + 10 §3.11';
comment on column booking_passengers.pending is 'Columnas agregadas en Fase 2 por spec 15 §3.14';
comment on column booking_reservation_services.pax_detail is 'Columnas agregadas en Fase 2 por spec 15 §3.14';
comment on column booking_reservation_services.kind is 'Columnas agregadas en Fase 2 por spec 15 §3.14';
comment on column booking_reservation_services.addon_id is 'Columnas agregadas en Fase 2 por spec 15 §3.14';
comment on column booking_reservation_services.rooms is 'Columnas agregadas en Fase 2 por spec 15 §3.14';
comment on column booking_reservation_services.nights is 'Columnas agregadas en Fase 2 por spec 15 §3.14';
comment on column ops_incidents.public_title is 'Columnas agregadas en Fase 2 por spec 08 §3.15';
comment on column ops_incidents.public_message is 'Columnas agregadas en Fase 2 por spec 08 §3.15';
comment on column fin_payments.reversal_request_id is 'Columnas agregadas en Fase 2 por spec 10 §3.11';
comment on column fin_payables.approval_round is 'Columnas agregadas en Fase 2 por spec 10 §3.11';
comment on column fin_payables.observation is 'Columnas agregadas en Fase 2 por spec 10 §3.11';
comment on column fin_commissions.settlement_request_id is 'Columnas agregadas en Fase 2 por spec 08 §3.15';
comment on column fin_commissions.approval_round is 'Columnas agregadas en Fase 2 por spec 10 §3.11';
comment on column fin_commissions.observation is 'Columnas agregadas en Fase 2 por spec 10 §3.11';
comment on column fin_fx_rates.provider_id is 'Columnas agregadas en Fase 2 por spec 17 §3.6 (v2.2)';
comment on column fin_fx_rates.daily_change_pct is 'Columnas agregadas en Fase 2 por spec 17 §3.6 (v2.2)';
comment on column fin_fx_rates.alert_raised is 'Columnas agregadas en Fase 2 por spec 17 §3.6 (v2.2)';
comment on column fin_fx_rates.is_demo is 'Columnas agregadas en Fase 2 por spec 17 §3.6 (v2.2)';
comment on table ops_mobile_devices is '[Spec 05 §3.13] [Fase 2] Dispositivos de las apps operador/pasajero (id generado en el dispositivo).';
comment on table ops_sync_actions is '[Spec 05 §3.13] [Fase 2] Acciones recibidas del outbox móvil (base de idempotencia; id = client_action_id).';
comment on table channel_trip_messages is '[Spec 05 §3.14] [Fase 2] Chat pasajero ↔ agencia de la app pasajero.';
comment on table catalog_service_cost_history is '[Spec 10 §3.11 + 06 §3.4] [Fase 2] Historial de costos/vigencias de servicios de proveedor (tarifas aprobadas).';
comment on table supplier_request_responses is '[Spec 06 §3.2] [Fase 2] Respuesta del proveedor (confirmación, rechazo, alternativa).';
comment on table supplier_invoices is '[Spec 06 §3.3] [Fase 2] Factura del proveedor asociada a una CxP.';
comment on table supplier_rate_requests is '[Spec 06 §3.4] [Fase 2] Solicitudes de actualización de tarifa del proveedor.';
comment on table fin_document_series is '[Spec 07 §3.13] [Fase 2] Series de comprobantes (F001, B001, FC01, BC01).';
comment on table fin_invoices is '[Spec 07 §3.14] [Fase 2] Comprobantes electrónicos (factura, boleta, NC, ND). Nunca se borran.';
comment on table fin_invoice_lines is '[Spec 07 §3.15] [Fase 2] Líneas del comprobante.';
comment on table fin_fiscal_events is '[Spec 07 §3.16] [Fase 2] Bitácora de integración fiscal OSE/PSE.';
comment on table fin_bank_statements is '[Spec 07 §3.17] [Fase 2] Extractos bancarios importados.';
comment on table fin_reconciliation_closures is '[Spec 07 §3.17] [Fase 2] Cierres de conciliación bancaria.';
comment on table fin_bank_lines is '[Spec 07 §3.17] [Fase 2] Líneas de extracto bancario y su conciliación.';
comment on table fin_period_closes is '[Spec 07 §3.18] [Fase 2] Cierre de periodo contable.';
comment on table fin_period_close_checks is '[Spec 07 §3.18] [Fase 2] Controles manuales del cierre de periodo.';
comment on table channel_b2b_price_lists is '[Spec 08 §3.2] [Fase 2] Listas de precios B2B.';
comment on table channel_b2b_agencies is '[Spec 08 §3.1] [Fase 2] Agencias asociadas B2B (crédito, comisión).';
comment on table catalog_product_b2b_rates is '[Spec 02 §3.7 + 08 §3.3] [Fase 2] Tarifa neta por agencia y producto.';
comment on table channel_b2b_settlement_requests is '[Spec 08 §3.5] [Fase 2] Solicitudes de liquidación de comisiones B2B.';
comment on table channel_b2b_credit_movements is '[Spec 08 §3.4] [Fase 2] Libro de la línea de crédito B2B (inmutable; fuente de credit_used, H-02).';
comment on table channel_b2b_credit_exceptions is '[Spec 10 §3.11] [Fase 2] Ampliaciones de crédito B2B aprobadas. (columnas mínimas de 10)';
comment on table cms_contents is '[Spec 08 §3.10] [Fase 2] Contenidos CMS (páginas, artículos, banners, legales).';
comment on table cms_content_events is '[Spec 08 §3.11] [Fase 2] Bitácora editorial del contenido.';
comment on table channel_ecom_orders is '[Spec 08 §3.6 + 15 §3.3, §3.14] [Fase 2] Pedidos web (tienda y sitio público).';
comment on table channel_ecom_order_lines is '[Spec 15 §3.4] [Fase 2] Líneas del pedido web (snapshot de precio).';
comment on table channel_ecom_passengers is '[Spec 08 §3.7 + 15 §3.5] [Fase 2] Pasajeros del pedido web.';
comment on table channel_ecom_payment_attempts is '[Spec 08 §3.8 + 15 §3.6] [Fase 2] Intentos de pago del pedido web (pasarela, transferencia, Yape/Plin).';
comment on table channel_portal_access_links is '[Spec 08 §3.13] [Fase 2] Acceso del pasajero por enlace/código.';
comment on table ops_incident_pax_acks is '[Spec 08 §3.14] [Fase 2] Confirmación de lectura de alertas por el pasajero.';
comment on table channel_pax_feedback is '[Spec 04 §3 v2.1 + 08 §3.16] [Fase 2] Comentarios del pasajero (portal/app); tabla única, dueño Canales.';
comment on table collab_approval_rules is '[Spec 10 §3.1] [Fase 2] Matriz de enrutamiento de aprobaciones.';
comment on table collab_approval_requests is '[Spec 10 §3.2] [Fase 2] Solicitud de aprobación unificada.';
comment on table collab_approval_steps is '[Spec 10 §3.3] [Fase 2] Decisiones por nivel.';
comment on table collab_approval_info_requests is '[Spec 10 §3.4] [Fase 2] Pedidos de información sobre una solicitud.';
comment on table collab_approval_events is '[Spec 10 §3.5] [Fase 2] Trazabilidad de la solicitud (append-only).';
comment on table collab_channel_accounts is '[Spec 10 §3.10] [Fase 2] Cuentas de canal del inbox (WhatsApp, email, webchat).';
comment on table collab_reply_templates is '[Spec 10 §3.9] [Fase 2] Plantillas de respuesta del inbox.';
comment on table collab_conversations is '[Spec 10 §3.6] [Fase 2] Conversaciones omnicanal.';
comment on table collab_messages is '[Spec 10 §3.7] [Fase 2] Mensajes de la conversación.';
comment on table collab_message_attachments is '[Spec 10 §3.8] [Fase 2] Adjuntos de mensajes.';
comment on table collab_inbound_events is '[Spec 10 §3.10] [Fase 2] Eventos entrantes de webhooks (idempotencia, retención 30 días).';
comment on table catalog_allotments is '[Spec 11 §3.1] [Fase 2] Contratos de cupo (allotment) con proveedores.';
comment on table catalog_allotment_days is '[Spec 11 §3.2] [Fase 2] Cupo por contrato y fecha.';
comment on table catalog_allotment_consumptions is '[Spec 11 §3.3] [Fase 2] Consumo de cupo por servicio de reserva (idempotente).';
comment on table catalog_allotment_requests is '[Spec 11 §3.4] [Fase 2] Solicitudes de ampliación de cupo.';
comment on table catalog_allotment_charges is '[Spec 11 §3.5] [Fase 2] Penalidades por cupo no usado.';
comment on table catalog_allotment_events is '[Spec 11 §3.6] [Fase 2] Bitácora del contrato de cupo.';
comment on table ops_travel_doc_items is '[Spec 11 §3.7] [Fase 2] Checklist documental por pasajero.';
comment on table ops_travel_doc_contacts is '[Spec 11 §3.8] [Fase 2] Contacto de emergencia por pasajero.';
comment on table ops_travel_doc_special is '[Spec 11 §3.8] [Fase 2] Atención especial (sin datos clínicos; acceso restringido).';
comment on table ops_travel_doc_reminders is '[Spec 11 §3.9] [Fase 2] Recordatorios documentales enviados.';
comment on table fin_treasury_accounts is '[Spec 12 §3.1] [Fase 2] Cuentas de tesorería (banco, caja chica, pasarela).';
comment on table fin_treasury_transfers is '[Spec 12 §3.4] [Fase 2] Transferencias entre cuentas / liquidaciones de pasarela.';
comment on table fin_cash_replenishments is '[Spec 12 §3.7] [Fase 2] Reposiciones de caja chica.';
comment on table fin_cash_replenishment_events is '[Spec 12 §3.7] [Fase 2] Historial de estados de la reposición. (columnas supuestas)';
comment on table fin_treasury_movements is '[Spec 12 §3.2] [Fase 2] Movimientos de tesorería (saldo derivado).';
comment on table fin_expense_receipts is '[Spec 12 §3.3] [Fase 2] Comprobante del gasto de caja chica.';
comment on table fin_cash_sessions is '[Spec 12 §3.5] [Fase 2] Sesiones diarias de caja chica.';
comment on table fin_cash_counts is '[Spec 12 §3.6] [Fase 2] Actas de arqueo de caja.';
comment on table fin_fx_revaluations is '[Spec 12 §3.8] [Fase 2] Diferencia de cambio mensual por cuenta USD.';
comment on table fin_treasury_settings is '[Spec 12 §3.9] [Fase 2] Parámetros de tesorería (1 fila por tenant).';
comment on table sys_booking_rules is '[Spec 17 §3.1 + 16 §3.1] [Fase 2] Centro de reglas del tenant (copia del catálogo de plataforma).';
comment on table catalog_product_rule_overrides is '[Spec 17 §3.2 + 16 §3.2] [Fase 2] Excepción de regla por producto.';
comment on table catalog_product_addons is '[Spec 16 §3.5] [Fase 2] Adicionales del producto (museos, seguros…).';
comment on table catalog_accommodation_legs is '[Spec 16 §3.6] [Fase 2] Tramos de alojamiento del circuito.';
comment on table catalog_accommodation_hotels is '[Spec 16 §3.6] [Fase 2] Hoteles por tramo.';
comment on table catalog_accommodation_room_types is '[Spec 16 §3.6] [Fase 2] Tipos de habitación y precio por noche.';
comment on table catalog_payment_policies is '[Spec 16 §3.7] [Fase 2] Política de pago del producto (total/adelanto).';
comment on table catalog_pickup_points is '[Spec 16 §3.8] [Fase 2] Puntos de recojo del producto.';
comment on table booking_reservation_web_snapshots is '[Spec 04 §3 v2.1] [Fase 2] Snapshot 1:1 de la reserva web (motor de reservas).';
comment on table booking_reservation_web_lodging is '[Spec 04 §3 v2.1] [Fase 2] Alojamiento elegido en la reserva web.';
comment on table booking_reservation_web_addons is '[Spec 04 §3 v2.1] [Fase 2] Adicionales elegidos en la reserva web.';
comment on table notif_pax_message_templates is '[Spec 17 §3.4] [Fase 2] Plantillas de mensajes automáticos al pasajero.';
comment on table notif_pax_messages is '[Spec 17 §3.5 + 04 §3 v2.1] [Fase 2] Mensajes al pasajero (programados, enviados, respuestas).';
comment on table fin_currencies is '[Spec 17 §3.6] [Fase 2] Monedas activas del tenant (base / cobro).';
comment on table fx_rate_providers is '[Spec 17 §3.6 (v2.2)] [Fase 2] Proveedores de tipo de cambio.';
comment on table channel_widget_config is '[Spec 17 §3.8] [Fase 2] Configuración del widget embebible (1 por tenant).';
comment on table channel_widget_domains is '[Spec 17 §3.8] [Fase 2] Dominios autorizados del widget (CORS/CSP).';
comment on table channel_web_carts is '[Spec 15 §3.1] [Fase 2] Carritos del sitio público.';
comment on table channel_web_cart_items is '[Spec 15 §3.2] [Fase 2] Líneas del carrito (precio recalculado en cada lectura).';
comment on table channel_widget_handoffs is '[Spec 17 §3.8] [Fase 2] Traspaso del widget al checkout (TTL 24 h).';
comment on table channel_wishlist_items is '[Spec 15 §3.7] [Fase 2] Favoritos del cliente.';
comment on table channel_web_events is '[Spec 15 §3.8] [Fase 2] Eventos de analítica del sitio (particionada por mes).';
comment on table catalog_product_translations is '[Spec 15 §3.11] [Fase 2] Traducciones del producto para el sitio.';
comment on table catalog_destination_contents is '[Spec 15 §3.11] [Fase 2] Contenido de páginas de destino por idioma.';

