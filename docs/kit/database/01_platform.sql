-- =============================================================================
-- KipuControl · Esquema PostgreSQL 17 · 01_platform.sql
-- Plataforma (tablas sin tenant / sin RLS de tenant)
-- Generado desde §3 de las especificaciones 00–18 + CONVENCIONES.md (fuente de verdad del kit).
-- Tablas nuevas: 30. Requiere: 00_extensions_and_functions.sql.
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------- tablas
create table platform_users (
  id uuid not null default app_uuid_v7(),
  name varchar(150) not null,
  email varchar(190) not null,
  password varchar(255) not null,
  mfa_secret text not null,
  status varchar(20) not null default 'activo' check (status in ('activo', 'inactivo')),
  last_login_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_users primary key (id)
);

create table plans (
  id uuid not null default app_uuid_v7(),
  code varchar(30) not null,
  name varchar(60) not null,
  rank smallint not null,
  price_month numeric(14,2) not null check (price_month >= 0),
  price_year numeric(14,2) not null,
  currency char(3) not null default 'PEN',
  trial_days smallint not null default 14 check (trial_days between 0 and 60),
  support_level varchar(80),
  module_count smallint,
  status varchar(30) not null default 'active' check (status in ('active', 'hidden', 'retired')),
  gateway_price_ids jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_plans primary key (id),
  constraint ck_plans_1 check (price_year <= price_month * 12)
);

create table plan_limits (
  plan_id uuid not null,
  metric varchar(30) not null check (metric in ('users', 'sedes', 'storage_gb', 'reservations_month', 'whatsapp_month', 'email_month', 'api_calls_month', 'api_rate_per_min', 'webhooks', 'api_keys')),
  value bigint,
  hard boolean not null default true,
  constraint pk_plan_limits primary key (plan_id, metric)
);

create table addons (
  code varchar(40) not null,
  label varchar(120) not null,
  unit varchar(30),
  quantity_allowed boolean not null default false,
  price_month numeric(14,2),
  available_plans uuid[] not null default '{}',
  included_plans uuid[] not null default '{}',
  grants jsonb not null default '{}',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_addons primary key (code)
);

create table addon_prices (
  addon_code varchar(40) not null,
  plan_id uuid not null,
  price numeric(14,2) not null check (price >= 0),
  constraint pk_addon_prices primary key (addon_code, plan_id)
);

create table features (
  key varchar(60) not null,
  label varchar(120) not null,
  module varchar(40),
  kind varchar(20) not null check (kind in ('module', 'limit', 'addon', 'beta')),
  addon_code varchar(40),
  routes text[] not null default '{}',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_features primary key (key)
);

create table plan_features (
  plan_id uuid not null,
  feature_key varchar(60) not null,
  value varchar(30) not null,
  label varchar(120),
  constraint pk_plan_features primary key (plan_id, feature_key)
);

create table plan_channels (
  channel_key varchar(30) not null,
  label varchar(80) not null,
  min_plan_id uuid not null,
  description varchar(200) not null,
  depends_on_integration varchar(30),
  constraint pk_plan_channels primary key (channel_key)
);

create table tenants (
  id uuid not null default app_uuid_v7(),
  code varchar(20) not null,
  legal_name varchar(200) not null,
  commercial_name varchar(120) not null,
  ruc char(11) not null check (ruc ~ '^(10|15|17|20)[0-9]{9}$'),
  fiscal_address varchar(250) not null,
  business_type varchar(40) not null check (business_type in ('Agencia de viajes minorista', 'Agencia mayorista', 'Operador turístico', 'DMC / receptivo', 'Agencia corporativa')),
  legal_rep varchar(150),
  subdomain varchar(30) not null check (subdomain ~ '^[a-z0-9-]{3,30}$'),
  custom_domain varchar(190),
  country varchar(40) not null default 'Perú',
  base_currency char(3) not null default 'PEN',
  alt_currency char(3) not null default 'USD',
  timezone varchar(40) not null default 'America/Lima',
  locale varchar(10) not null default 'es-PE',
  logo_initials varchar(3) not null,
  logo_path varchar(255),
  plan_id uuid not null,
  status varchar(20) not null default 'prueba' check (status in ('prueba', 'activo', 'suspendido')),
  trial_ends_at timestamptz,
  suspend_reason text,
  suspended_at timestamptz,
  mrr numeric(14,2) not null default 0,
  modules smallint not null default 0,
  storage_used_bytes bigint not null default 0,
  admin_email varchar(190) not null,
  settings jsonb not null default '{}',
  created_by uuid,
  lock_version integer not null default 0,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_tenants primary key (id),
  constraint ck_tenants_1 check (status <> 'suspendido' or suspend_reason is not null)
);

create table tenant_onboarding (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null,
  payload jsonb not null,
  permission_template varchar(40) not null check (permission_template in ('estandar', 'minimo_privilegio', 'copiar_tenant')),
  copied_from_tenant_id uuid,
  idempotency_key varchar(80) not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_tenant_onboarding primary key (id)
);

create table platform_sequences (
  id uuid not null default app_uuid_v7(),
  doc_type varchar(40) not null,
  series varchar(10) not null default 'default',
  prefix varchar(30) not null default '',
  pad_width smallint not null default 5,
  next_number bigint not null default 1 check (next_number > 0),
  constraint pk_platform_sequences primary key (id)
);

create table feature_overrides (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null,
  feature_key varchar(60) not null,
  value boolean not null,
  reason varchar(300) not null,
  valid_until date,
  granted_by uuid not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_feature_overrides primary key (id)
);

create table sys_booking_rule_catalog (
  id uuid not null default app_uuid_v7(),
  code varchar(40) not null check (code ~ '^R-[A-Z0-9-]{2,38}$'),
  rule_group varchar(40) not null,
  name varchar(160) not null,
  description text not null,
  default_enabled boolean not null default false,
  default_params jsonb not null default '{}',
  params_schema jsonb not null default '{}',
  scope text[] not null default '{}',
  product_override boolean not null default false,
  min_plan varchar(20) not null default 'Starter' check (min_plan in ('Starter', 'Professional', 'Enterprise')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_sys_booking_rule_catalog primary key (id)
);

create table plan_rule_entitlements (
  rule_code varchar(40) not null,
  min_plan varchar(20) not null check (min_plan in ('Starter', 'Professional', 'Enterprise')),
  is_demo boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint pk_plan_rule_entitlements primary key (rule_code)
);

create table sys_rule_templates (
  id uuid not null default app_uuid_v7(),
  code varchar(30) not null check (code in ('receptivo','minorista','aventura','b2b')),
  name varchar(120) not null,
  description text,
  enabled_codes text[] not null default '{}',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_sys_rule_templates primary key (id)
);

create table permissions (
  id uuid not null default app_uuid_v7(),
  name varchar(125) not null,
  guard_name varchar(125) not null default 'api',
  module varchar(40) not null,
  description varchar(200),
  constraint pk_permissions primary key (id)
);

create table coupons (
  id uuid not null default app_uuid_v7(),
  code varchar(20) not null check (code ~ '^[A-Z0-9_-]{4,20}$'),
  type varchar(10) not null check (type in ('percent', 'fixed')),
  value numeric(10,2) not null check (value > 0),
  duration_cycles smallint not null check (duration_cycles between 1 and 12),
  plan_ids uuid[] not null default '{}',
  max_redemptions integer,
  redeemed_count integer not null default 0,
  valid_to date,
  status varchar(10) not null default 'active' check (status in ('active', 'inactive')),
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_coupons primary key (id),
  constraint ck_coupons_1 check (type <> 'percent' or value <= 50),
  constraint ck_coupons_2 check (max_redemptions is null or redeemed_count <= max_redemptions)
);

create table subscriptions (
  id uuid not null default app_uuid_v7(),
  code varchar(30) not null,
  tenant_id uuid not null,
  plan_id uuid not null,
  cycle varchar(10) not null check (cycle in ('monthly', 'annual')),
  status varchar(30) not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'cancel_scheduled', 'suspended', 'canceled')),
  trial_starts_at date,
  trial_ends_at date,
  trial_extended_days smallint not null default 0 check (trial_extended_days <= 14),
  current_period_start date not null,
  current_period_end date not null,
  billing_anchor_day smallint not null check (billing_anchor_day between 1 and 28),
  auto_renew boolean not null default true,
  cancel_at date,
  cancel_survey jsonb,
  credit_balance numeric(14,2) not null default 0,
  coupon_redemption_id uuid,
  gateway varchar(20) not null check (gateway in ('cashier_stripe','local_gateway')),
  gateway_customer_id varchar(100),
  gateway_subscription_id varchar(100),
  billing_ruc char(11) not null check (billing_ruc ~ '^(10|15|17|20)[0-9]{9}$'),
  billing_name varchar(200) not null,
  billing_address varchar(200) not null,
  billing_ubigeo char(6),
  billing_email varchar(150) not null,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_subscriptions primary key (id),
  constraint ck_subscriptions_1 check (current_period_end > current_period_start)
);

create table coupon_redemptions (
  id uuid not null default app_uuid_v7(),
  coupon_id uuid not null,
  tenant_id uuid not null,
  subscription_id uuid not null,
  remaining_cycles smallint not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_coupon_redemptions primary key (id)
);

create table subscription_items (
  id uuid not null default app_uuid_v7(),
  subscription_id uuid not null,
  addon_code varchar(40) not null,
  quantity smallint not null default 1 check (quantity >= 1),
  meta jsonb,
  starts_at date not null,
  ends_at date,
  unit_price numeric(14,2) not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_subscription_items primary key (id)
);

create table platform_invoices (
  id uuid not null default app_uuid_v7(),
  series char(4) not null,
  number integer not null,
  tenant_id uuid not null,
  subscription_id uuid not null,
  kind varchar(20) not null check (kind in ('subscription', 'proration', 'addon', 'manual')),
  period_from date not null,
  period_to date not null,
  issue_date date not null,
  due_date date not null,
  currency char(3) not null default 'PEN',
  subtotal numeric(14,2) not null,
  igv numeric(14,2) not null,
  total numeric(14,2) not null,
  igv_pct numeric(5,2) not null default 18.00,
  status varchar(20) not null default 'draft' check (status in ('draft', 'open', 'paid', 'failed', 'uncollectible', 'void')),
  paid_at timestamptz,
  payment_ref varchar(120),
  bill_to jsonb not null,
  sunat_status varchar(20) not null default 'pending' check (sunat_status in ('pending', 'accepted', 'observed', 'rejected')),
  sunat_hash varchar(120),
  sunat_cdr_path varchar(255),
  pdf_path varchar(255),
  xml_path varchar(255),
  dunning_failed_at date,
  dunning_retries_done smallint not null default 0,
  dunning_next_retry_at timestamptz,
  dunning_extended_days smallint not null default 0,
  void_reason varchar(300),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_invoices primary key (id),
  constraint ck_platform_invoices_1 check (total = subtotal + igv)
);

create table platform_invoice_lines (
  id uuid not null default app_uuid_v7(),
  invoice_id uuid not null,
  description varchar(250) not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(14,2) not null,
  amount numeric(14,2) not null,
  line_type varchar(20) not null check (line_type in ('plan', 'addon', 'proration_charge', 'proration_credit', 'discount', 'usage_overage')),
  constraint pk_platform_invoice_lines primary key (id)
);

create table subscription_changes (
  id uuid not null default app_uuid_v7(),
  subscription_id uuid not null,
  kind varchar(20) not null check (kind in ('upgrade', 'downgrade', 'cycle', 'addon_add', 'addon_update', 'addon_remove', 'cancel', 'resume')),
  from_plan_id uuid,
  to_plan_id uuid,
  from_cycle varchar(10),
  to_cycle varchar(10),
  effective_at date not null,
  status varchar(20) not null default 'scheduled' check (status in ('scheduled', 'applied', 'voided')),
  proration jsonb,
  invoice_id uuid,
  requested_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_subscription_changes primary key (id)
);

create table platform_credit_notes (
  id uuid not null default app_uuid_v7(),
  series char(4) not null default 'NQ01',
  number integer not null,
  invoice_id uuid not null,
  reason varchar(300) not null,
  amount numeric(14,2) not null,
  sunat_status varchar(20) not null default 'pending' check (sunat_status in ('pending', 'accepted', 'observed', 'rejected')),
  refund_ref varchar(120),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_platform_credit_notes primary key (id)
);

create table payment_methods (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null,
  gateway_token varchar(120) not null,
  brand varchar(20),
  last4 char(4),
  exp_month smallint,
  exp_year smallint,
  holder varchar(120),
  is_default boolean not null default false,
  status varchar(20) not null default 'active' check (status in ('active', 'expired', 'removed')),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_payment_methods primary key (id)
);

create table payment_attempts (
  id uuid not null default app_uuid_v7(),
  invoice_id uuid not null,
  attempt_no smallint not null,
  source varchar(20) not null check (source in ('initial', 'dunning', 'manual_retry', 'portal', 'manual_payment')),
  result varchar(20) not null check (result in ('succeeded', 'declined', 'error')),
  gateway_code varchar(40),
  message varchar(300),
  idempotency_key varchar(80) not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_payment_attempts primary key (id)
);

create table usage_counters (
  tenant_id uuid not null,
  metric varchar(30) not null check (metric in ('users', 'sedes', 'storage_gb', 'reservations_month', 'whatsapp_month', 'email_month', 'api_calls_month', 'api_rate_per_min', 'webhooks', 'api_keys')),
  day date not null,
  value bigint not null default 0,
  constraint pk_usage_counters primary key (tenant_id, metric, day)
) partition by range (day);

do $$ begin perform app_create_monthly_partitions('usage_counters', date '2026-01-01', 24); end $$;

create table usage_monthly (
  tenant_id uuid not null,
  metric varchar(30) not null,
  month date not null,
  value bigint not null default 0,
  limit_value bigint,
  alert_80_sent_at timestamptz,
  alert_100_sent_at timestamptz,
  constraint pk_usage_monthly primary key (tenant_id, metric, month)
);

create table usage_events (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null,
  metric varchar(30) not null,
  day date not null,
  value bigint not null default 1,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pk_usage_events primary key (id)
);

create table platform_metrics_daily (
  id uuid not null default app_uuid_v7(),
  day date not null,
  mrr numeric(14,2) not null default 0,
  arr numeric(14,2) not null default 0,
  arpa numeric(14,2) not null default 0,
  active_tenants integer not null default 0,
  new_tenants integer not null default 0,
  churned_tenants integer not null default 0,
  logo_churn_pct numeric(6,3),
  revenue_churn_pct numeric(6,3),
  breakdown jsonb not null default '{}',
  constraint pk_platform_metrics_daily primary key (id)
);


-- ---------------------------------------------------------------- unicidad (índices únicos, incluidos parciales)
create unique index uq_platform_users_lower_email on platform_users (lower(email));
create unique index uq_plans_code on plans (code);
create unique index uq_plans_rank on plans (rank);
create unique index uq_tenants_code on tenants (code);
create unique index uq_tenants_ruc on tenants (ruc);
create unique index uq_tenants_subdomain on tenants (subdomain);
create unique index uq_tenants_lower_custom_domain_p on tenants (lower(custom_domain)) where custom_domain is not null;
create unique index uq_tenant_onboarding_tenant_id on tenant_onboarding (tenant_id);
create unique index uq_tenant_onboarding_idempotency_key on tenant_onboarding (idempotency_key);
create unique index uq_platform_sequences_doc_type_series on platform_sequences (doc_type, series);
create unique index uq_feature_overrides_tenant_id_feature_key on feature_overrides (tenant_id, feature_key);
create unique index uq_sys_booking_rule_catalog_code on sys_booking_rule_catalog (code);
create unique index uq_sys_rule_templates_code on sys_rule_templates (code);
create unique index uq_permissions_name_guard_name on permissions (name, guard_name);
create unique index uq_coupons_code on coupons (code);
create unique index uq_subscriptions_code on subscriptions (code);
create unique index uq_subscriptions_tenant_id_p on subscriptions (tenant_id) where status <> 'canceled';
create unique index uq_coupon_redemptions_coupon_id_tenant_id on coupon_redemptions (coupon_id, tenant_id);
create unique index uq_subscription_items_subscription_id_addon_code_p on subscription_items (subscription_id, addon_code) where ends_at is null;
create unique index uq_platform_invoices_series_number on platform_invoices (series, number);
create unique index uq_subscription_changes_subscription_id_p on subscription_changes (subscription_id) where status = 'scheduled';
create unique index uq_platform_credit_notes_series_number on platform_credit_notes (series, number);
create unique index uq_platform_credit_notes_invoice_id on platform_credit_notes (invoice_id);
create unique index uq_payment_methods_tenant_id_p on payment_methods (tenant_id) where is_default;
create unique index uq_payment_attempts_idempotency_key on payment_attempts (idempotency_key);
create unique index uq_platform_metrics_daily_day on platform_metrics_daily (day);

-- ---------------------------------------------------------------- claves foráneas
alter table plan_limits add constraint fk_plan_limits_plan_id foreign key (plan_id) references plans (id) on delete cascade;
alter table addon_prices add constraint fk_addon_prices_addon_code foreign key (addon_code) references addons (code) on delete cascade;
alter table addon_prices add constraint fk_addon_prices_plan_id foreign key (plan_id) references plans (id) on delete cascade;
alter table features add constraint fk_features_addon_code foreign key (addon_code) references addons (code);
alter table plan_features add constraint fk_plan_features_plan_id foreign key (plan_id) references plans (id) on delete cascade;
alter table plan_features add constraint fk_plan_features_feature_key foreign key (feature_key) references features (key) on delete cascade;
alter table plan_channels add constraint fk_plan_channels_min_plan_id foreign key (min_plan_id) references plans (id);
alter table tenants add constraint fk_tenants_plan_id foreign key (plan_id) references plans (id);
alter table tenants add constraint fk_tenants_created_by foreign key (created_by) references platform_users (id);
alter table tenant_onboarding add constraint fk_tenant_onboarding_tenant_id foreign key (tenant_id) references tenants (id);
alter table tenant_onboarding add constraint fk_tenant_onboarding_copied_from_tenant_id foreign key (copied_from_tenant_id) references tenants (id);
alter table feature_overrides add constraint fk_feature_overrides_tenant_id foreign key (tenant_id) references tenants (id);
alter table feature_overrides add constraint fk_feature_overrides_feature_key foreign key (feature_key) references features (key);
alter table feature_overrides add constraint fk_feature_overrides_granted_by foreign key (granted_by) references platform_users (id);
alter table plan_rule_entitlements add constraint fk_plan_rule_entitlements_rule_code foreign key (rule_code) references sys_booking_rule_catalog (code) on delete cascade;
alter table plan_rule_entitlements add constraint fk_plan_rule_entitlements_updated_by foreign key (updated_by) references platform_users (id);
alter table coupons add constraint fk_coupons_created_by foreign key (created_by) references platform_users (id);
alter table subscriptions add constraint fk_subscriptions_tenant_id foreign key (tenant_id) references tenants (id);
alter table subscriptions add constraint fk_subscriptions_plan_id foreign key (plan_id) references plans (id);
alter table subscriptions add constraint fk_subscriptions_coupon_redemption_id foreign key (coupon_redemption_id) references coupon_redemptions (id);
alter table coupon_redemptions add constraint fk_coupon_redemptions_coupon_id foreign key (coupon_id) references coupons (id);
alter table coupon_redemptions add constraint fk_coupon_redemptions_tenant_id foreign key (tenant_id) references tenants (id);
alter table coupon_redemptions add constraint fk_coupon_redemptions_subscription_id foreign key (subscription_id) references subscriptions (id);
alter table subscription_items add constraint fk_subscription_items_subscription_id foreign key (subscription_id) references subscriptions (id) on delete cascade;
alter table subscription_items add constraint fk_subscription_items_addon_code foreign key (addon_code) references addons (code);
alter table platform_invoices add constraint fk_platform_invoices_tenant_id foreign key (tenant_id) references tenants (id);
alter table platform_invoices add constraint fk_platform_invoices_subscription_id foreign key (subscription_id) references subscriptions (id);
alter table platform_invoice_lines add constraint fk_platform_invoice_lines_invoice_id foreign key (invoice_id) references platform_invoices (id) on delete cascade;
alter table subscription_changes add constraint fk_subscription_changes_subscription_id foreign key (subscription_id) references subscriptions (id);
alter table subscription_changes add constraint fk_subscription_changes_from_plan_id foreign key (from_plan_id) references plans (id);
alter table subscription_changes add constraint fk_subscription_changes_to_plan_id foreign key (to_plan_id) references plans (id);
alter table subscription_changes add constraint fk_subscription_changes_invoice_id foreign key (invoice_id) references platform_invoices (id);
alter table platform_credit_notes add constraint fk_platform_credit_notes_invoice_id foreign key (invoice_id) references platform_invoices (id);
alter table platform_credit_notes add constraint fk_platform_credit_notes_created_by foreign key (created_by) references platform_users (id);
alter table payment_methods add constraint fk_payment_methods_tenant_id foreign key (tenant_id) references tenants (id);
alter table payment_attempts add constraint fk_payment_attempts_invoice_id foreign key (invoice_id) references platform_invoices (id);
alter table usage_counters add constraint fk_usage_counters_tenant_id foreign key (tenant_id) references tenants (id);
alter table usage_monthly add constraint fk_usage_monthly_tenant_id foreign key (tenant_id) references tenants (id);
alter table usage_events add constraint fk_usage_events_tenant_id foreign key (tenant_id) references tenants (id);

-- ---------------------------------------------------------------- índices (FK, listados, búsquedas)
create index ix_tenants_status on tenants (status);
create index ix_tenants_plan_id on tenants (plan_id);
create index ix_subscriptions_status on subscriptions (status);
create index ix_subscriptions_current_period_end on subscriptions (current_period_end);
create index ix_subscriptions_trial_ends_at_p on subscriptions (trial_ends_at) where status = 'trialing';
create index ix_platform_invoices_tenant_id_issue_date_desc on platform_invoices (tenant_id, issue_date desc);
create index ix_platform_invoices_dunning_next_retry_at_p on platform_invoices (dunning_next_retry_at) where status = 'failed';
create index ix_platform_invoices_status on platform_invoices (status);
create index ix_payment_attempts_invoice_id_created_at on payment_attempts (invoice_id, created_at);
create index ix_usage_events_processed_at_p on usage_events (processed_at) where processed_at is null;
create index ix_addon_prices_plan_id on addon_prices (plan_id);
create index ix_features_addon_code on features (addon_code);
create index ix_plan_features_feature_key on plan_features (feature_key);
create index ix_plan_channels_min_plan_id on plan_channels (min_plan_id);
create index ix_tenants_created_by on tenants (created_by);
create index ix_tenant_onboarding_copied_from_tenant_id on tenant_onboarding (copied_from_tenant_id);
create index ix_feature_overrides_feature_key on feature_overrides (feature_key);
create index ix_feature_overrides_granted_by on feature_overrides (granted_by);
create index ix_plan_rule_entitlements_updated_by on plan_rule_entitlements (updated_by);
create index ix_coupons_created_by on coupons (created_by);
create index ix_subscriptions_plan_id on subscriptions (plan_id);
create index ix_subscriptions_coupon_redemption_id on subscriptions (coupon_redemption_id);
create index ix_coupon_redemptions_subscription_id on coupon_redemptions (subscription_id);
create index ix_subscription_items_subscription_id on subscription_items (subscription_id);
create index ix_subscription_items_addon_code on subscription_items (addon_code);
create index ix_platform_invoices_subscription_id on platform_invoices (subscription_id);
create index ix_platform_invoice_lines_invoice_id on platform_invoice_lines (invoice_id);
create index ix_subscription_changes_subscription_id on subscription_changes (subscription_id);
create index ix_subscription_changes_from_plan_id on subscription_changes (from_plan_id);
create index ix_subscription_changes_to_plan_id on subscription_changes (to_plan_id);
create index ix_subscription_changes_invoice_id on subscription_changes (invoice_id);
create index ix_platform_credit_notes_created_by on platform_credit_notes (created_by);

-- ---------------------------------------------------------------- restricciones de exclusión y triggers específicos
create trigger trg_platform_sequences_no_decrease before update on platform_sequences for each row execute function app_sequence_no_decrease();

-- ---------------------------------------------------------------- triggers de updated_at / lock_version
create trigger trg_platform_users_updated_at before update on platform_users for each row execute function app_set_updated_at();
create trigger trg_plans_updated_at before update on plans for each row execute function app_set_updated_at();
create trigger trg_addons_updated_at before update on addons for each row execute function app_set_updated_at();
create trigger trg_tenants_updated_at before update on tenants for each row execute function app_set_updated_at();
create trigger trg_tenants_lock_version before update on tenants for each row execute function app_bump_lock_version();
create trigger trg_sys_booking_rule_catalog_updated_at before update on sys_booking_rule_catalog for each row execute function app_set_updated_at();
create trigger trg_plan_rule_entitlements_updated_at before update on plan_rule_entitlements for each row execute function app_set_updated_at();
create trigger trg_sys_rule_templates_updated_at before update on sys_rule_templates for each row execute function app_set_updated_at();
create trigger trg_subscriptions_updated_at before update on subscriptions for each row execute function app_set_updated_at();
create trigger trg_subscriptions_lock_version before update on subscriptions for each row execute function app_bump_lock_version();
create trigger trg_subscription_items_updated_at before update on subscription_items for each row execute function app_set_updated_at();
create trigger trg_platform_invoices_updated_at before update on platform_invoices for each row execute function app_set_updated_at();

-- ---------------------------------------------------------------- comentarios (spec de origen)
comment on table platform_users is '[Spec 00 §3.1] [Plataforma] Usuarios de plataforma (Super Admin). Guard `platform`; nunca tienen filas en iam_users.';
comment on table plans is '[Spec 13 §3.2 + 09 §3.1] [Plataforma] Planes comerciales (Starter/Professional/Enterprise).';
comment on table plan_limits is '[Spec 13 §3.3] [Plataforma] Límites por plan y métrica (NULL = ilimitado).';
comment on table addons is '[Spec 13 §3.5] [Plataforma] Catálogo de add-ons de suscripción.';
comment on table addon_prices is '[Spec 13 §3.5] [Plataforma] Precio de add-on por plan (p. ej. extra_users).';
comment on table features is '[Spec 13 §3.4] [Plataforma] Catálogo de feature flags / módulos.';
comment on table plan_features is '[Spec 13 §3.4 + 09 §3.2] [Plataforma] Matriz plan × feature (entitlements).';
comment on table plan_channels is '[Spec 09 §3.3] [Plataforma] Canal mínimo por plan (CHANNELS del prototipo).';
comment on table tenants is '[Spec 09 §3.4] [Plataforma] Tenant (agencia). Raíz del aislamiento; RLS propia: una fila visible = la del contexto.';
comment on table tenant_onboarding is '[Spec 09 §3.5] [Plataforma] Snapshot del asistente de alta PROC-001.';
comment on table platform_sequences is '[Spec 13 §3.8] [Plataforma] Correlativos globales de plataforma (series FQ01/NQ01, TNT-, SUB-).';
comment on table feature_overrides is '[Spec 13 §3.4] [Plataforma] Excepciones de feature por tenant (Super Admin).';
comment on table sys_booking_rule_catalog is '[Spec 17 §3.1 + 16 §3.1 + 13 §3.4] [Plataforma] Catálogo de plataforma de reglas del motor de reservas (31 reglas).';
comment on table plan_rule_entitlements is '[Spec 13 §3.4 (v2.2)] [Plataforma] Plan mínimo que incluye cada regla del motor (DEMO editable).';
comment on table sys_rule_templates is '[Spec 17 §3.3] [Plataforma] Plantillas de reglas por tipo de negocio (plataforma).';
comment on table permissions is '[Spec 00 §3.5] [Plataforma] Catálogo global de permisos (spatie). Sin tenant; sembrado por seeder.';
comment on table coupons is '[Spec 13 §3.9] [Plataforma] Cupones de suscripción. [Fase 3]';
comment on table subscriptions is '[Spec 13 §3.6] [Plataforma] Suscripción del tenant a un plan. [Fase 3]';
comment on table coupon_redemptions is '[Spec 13 §3.9] [Plataforma] Canje de cupón por tenant. [Fase 3]';
comment on table subscription_items is '[Spec 13 §3.6] [Plataforma] Add-ons contratados en la suscripción. [Fase 3]';
comment on table platform_invoices is '[Spec 13 §3.8] [Plataforma] Facturas de plataforma (emisor KipuControl Cloud). [Fase 3]';
comment on table platform_invoice_lines is '[Spec 13 §3.8] [Plataforma] Líneas de factura de plataforma. [Fase 3]';
comment on table subscription_changes is '[Spec 13 §3.6] [Plataforma] Cambios de plan/ciclo/add-on (programados o aplicados). [Fase 3]';
comment on table platform_credit_notes is '[Spec 13 §3.8] [Plataforma] Notas de crédito de plataforma (serie NQ01). [Fase 3]';
comment on table payment_methods is '[Spec 13 §3.7] [Plataforma] Medios de pago del tenant para la suscripción (solo token). [Fase 3]';
comment on table payment_attempts is '[Spec 13 §3.8] [Plataforma] Intentos de cobro de facturas de plataforma (dunning). [Fase 3]';
comment on table usage_counters is '[Spec 13 §3.10] [Plataforma] Contadores diarios de uso por tenant (particionada por mes). [Fase 3]';
comment on table usage_monthly is '[Spec 13 §3.10] [Plataforma] Uso mensual consolidado y alertas 80/100 %. [Fase 3]';
comment on table usage_events is '[Spec 13 §9 (fallback)] [Plataforma] Fallback de medición cuando Redis no está disponible. [Fase 3] (supuesto: columnas mínimas)';
comment on table platform_metrics_daily is '[Spec 13 §3.1] [Plataforma] Snapshot diario de MRR/ARR/churn. [Fase 3] (supuesto: columnas)';

