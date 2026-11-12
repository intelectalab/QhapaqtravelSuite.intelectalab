-- =============================================================================
-- KipuControl · Esquema PostgreSQL 17 · 40_fase3.sql
-- Fase 3 · SaaS y crecimiento
-- Generado desde §3 de las especificaciones 00–18 + CONVENCIONES.md (fuente de verdad del kit).
-- Tablas nuevas: 28. Requiere: 00_extensions_and_functions.sql y archivos previos.
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------- tablas
create table integration_api_keys (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  name varchar(120) not null,
  environment varchar(10) not null check (environment in ('live', 'test')),
  prefix varchar(16) not null,
  last4 char(4) not null,
  token_hash char(64) not null,
  scopes text[] not null default '{}',
  ip_allowlist cidr[],
  expires_at date,
  last_used_at timestamptz,
  last_used_ip inet,
  status varchar(20) not null default 'active' check (status in ('active', 'revoked', 'expired')),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason varchar(300),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_integration_api_keys primary key (id)
);

create table integration_webhooks (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  url varchar(500) not null check (url ~ '^https://'),
  description varchar(200),
  events text[] not null default '{}',
  secret_encrypted text not null,
  previous_secret_encrypted text,
  previous_secret_expires_at timestamptz,
  secret_prefix varchar(12) not null,
  api_version varchar(10) not null,
  status varchar(20) not null default 'active' check (status in ('active', 'paused', 'disabled', 'deleted')),
  consecutive_failures smallint not null default 0,
  disabled_reason varchar(200),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_integration_webhooks primary key (id)
);

create table integration_webhook_deliveries (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  webhook_id uuid not null,
  event_type varchar(50) not null,
  event_id varchar(40) not null,
  entity_code varchar(40),
  payload jsonb not null,
  attempt smallint not null default 1,
  status varchar(20) not null default 'pending' check (status in ('pending', 'delivered', 'retrying', 'failed')),
  http_status smallint,
  duration_ms integer,
  response_excerpt varchar(2000),
  error varchar(300),
  next_retry_at timestamptz,
  manual boolean not null default false,
  created_at timestamptz not null default now(),
  constraint pk_integration_webhook_deliveries primary key (id, created_at)
) partition by range (created_at);

do $$ begin perform app_create_monthly_partitions('integration_webhook_deliveries', date '2026-01-01', 24); end $$;

create table oauth_clients (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  owner_type varchar(255),
  owner_id uuid,
  name varchar(255) not null,
  secret varchar(255),
  provider varchar(255),
  redirect_uris text not null default '[]',
  grant_types text not null default '["authorization_code","refresh_token"]',
  revoked boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_oauth_clients primary key (id)
);

create table integration_oauth_apps (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  client_id uuid not null,
  vendor varchar(120) not null,
  allowed_scopes text[] not null default '{}',
  status varchar(20) not null default 'active' check (status in ('active', 'revoked')),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_integration_oauth_apps primary key (id)
);

create table mkt_contacts_subscribers (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  full_name varchar(160) not null,
  email citext not null,
  phone varchar(30),
  phone_e164 varchar(20),
  country varchar(60),
  interest_destination varchar(120),
  source varchar(60) not null,
  client_id uuid,
  lead_id uuid,
  double_opt_in_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_mkt_contacts_subscribers primary key (id)
);

create table mkt_segments (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  name varchar(160) not null,
  description text,
  match varchar(5) not null default 'all' check (match in ('all', 'any')),
  rules jsonb not null default '[]',
  owner_id uuid not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_mkt_segments primary key (id)
);

create table mkt_templates (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  name varchar(120) not null,
  channel varchar(20) not null check (channel in ('email', 'whatsapp')),
  category varchar(20) not null check (category in ('MARKETING', 'UTILITY', 'SERVICIO')),
  status varchar(20) not null default 'activa' check (status in ('activa', 'en_revision', 'aprobada', 'rechazada')),
  provider_template_id varchar(60),
  language varchar(10) not null default 'es',
  subject varchar(200),
  body text not null,
  reviewed_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_mkt_templates primary key (id),
  constraint ck_mkt_templates_1 check (channel <> 'email' or subject is not null),
  constraint ck_mkt_templates_2 check (channel <> 'whatsapp' or name ~ '^[a-z0-9_]+$')
);

create table mkt_campaigns (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  name varchar(160) not null,
  channel varchar(20) not null check (channel in ('email', 'whatsapp')),
  segment_id uuid not null,
  template_id uuid not null,
  subject varchar(200),
  body text not null,
  promotion_id uuid,
  promo_code varchar(20),
  utm varchar(200) not null,
  status varchar(20) not null default 'borrador' check (status in ('borrador', 'programada', 'enviando', 'enviada', 'cancelada')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  cancel_reason text,
  audience_snapshot jsonb,
  owner_id uuid not null,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_mkt_campaigns primary key (id)
);

create table mkt_consents (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  subject_type varchar(20) not null check (subject_type in ('client', 'lead', 'subscriber')),
  subject_id uuid not null,
  channel varchar(20) not null check (channel in ('email', 'whatsapp')),
  status varchar(20) not null default 'otorgado' check (status in ('otorgado', 'revocado')),
  granted_at timestamptz not null,
  source varchar(120) not null,
  evidence text not null,
  policy_version varchar(20) not null,
  revoked_at timestamptz,
  revoke_source varchar(120),
  revoke_campaign_id uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_mkt_consents primary key (id),
  constraint ck_mkt_consents_1 check ((status = 'revocado') = (revoked_at is not null))
);

create table mkt_consent_events (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  consent_id uuid not null,
  event varchar(20) not null check (event in ('otorgado', 'revocado')),
  source varchar(120) not null,
  evidence text,
  actor_id uuid,
  occurred_at timestamptz not null default now(),
  ip inet,
  constraint pk_mkt_consent_events primary key (id)
);

create table mkt_campaign_tests (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  campaign_id uuid not null,
  to_user_id uuid not null,
  to_address varchar(160) not null,
  sample_subject_type varchar(20),
  sample_subject_id uuid,
  sent_at timestamptz not null default now(),
  invalidated_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_mkt_campaign_tests primary key (id)
);

create table mkt_campaign_recipients (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  campaign_id uuid not null,
  subject_type varchar(20) not null,
  subject_id uuid not null,
  address varchar(160) not null,
  provider_message_id varchar(120),
  status varchar(20) not null default 'pendiente' check (status in ('pendiente', 'enviado', 'entregado', 'rebotado', 'fallido')),
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  unsubscribed_at timestamptz,
  error text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_mkt_campaign_recipients primary key (id)
);

create table mkt_campaign_suppressions (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  campaign_id uuid not null,
  subject_type varchar(20) not null,
  subject_id uuid not null,
  reason varchar(20) not null check (reason in ('optout', 'nodata', 'consent', 'fatigue')),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_mkt_campaign_suppressions primary key (id)
);

create table mkt_attributions (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  campaign_id uuid not null,
  kind varchar(20) not null check (kind in ('reservation', 'lead', 'promo_use')),
  reservation_id uuid,
  lead_id uuid,
  ecom_order_id uuid,
  revenue_pen numeric(14,2),
  attributed_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_mkt_attributions primary key (id),
  constraint ck_mkt_attributions_1 check ((kind <> 'reservation' or reservation_id is not null) and (kind <> 'lead' or lead_id is not null) and (kind <> 'promo_use' or ecom_order_id is not null or reservation_id is not null))
);

create table mkt_automations (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  key varchar(30) not null check (key in ('welcome', 'cart', 'pretrip', 'survey', 'birthday', 'reactivation')),
  name varchar(120) not null,
  trigger_desc varchar(200) not null,
  delay_desc varchar(80) not null,
  delay_minutes integer,
  schedule_cron varchar(60),
  channel varchar(20) not null check (channel in ('email', 'whatsapp')),
  template_id uuid not null,
  purpose varchar(20) not null check (purpose in ('comercial', 'servicio')),
  status varchar(20) not null default 'pausada' check (status in ('activa', 'pausada')),
  sent_total integer not null default 0,
  suppressed_total integer not null default 0,
  conversions_total integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_mkt_automations primary key (id)
);

create table mkt_automation_runs (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  automation_id uuid not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  queued integer not null default 0,
  sent integer not null default 0,
  suppressed integer not null default 0,
  triggered_by uuid,
  constraint pk_mkt_automation_runs primary key (id)
);

create table mkt_automation_enrollments (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  automation_id uuid not null,
  subject_type varchar(20) not null,
  subject_id uuid not null,
  ref_type varchar(20) not null check (ref_type in ('subscriber', 'ecom_order', 'reservation', 'client')),
  ref_id uuid not null,
  status varchar(20) not null check (status in ('enviado', 'suprimido')),
  reason varchar(60),
  processed_at timestamptz not null default now(),
  constraint pk_mkt_automation_enrollments primary key (id)
);

create table crm_sales_teams (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  name varchar(120) not null,
  leader_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_sales_teams primary key (id)
);

create table crm_sales_team_members (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  team_id uuid not null,
  user_id uuid not null,
  valid_from date not null,
  valid_to date,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_sales_team_members primary key (id)
);

create table crm_sales_targets (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  scope_type varchar(10) not null check (scope_type in ('asesor', 'sede', 'equipo')),
  scope_id uuid not null,
  period_type varchar(10) not null check (period_type in ('mes', 'trimestre')),
  period_key varchar(7) not null check (period_key ~ '^[0-9]{4}-([0-9]{2}|Q[1-4])$'),
  period_from date not null,
  period_to date not null,
  goal_sales_pen numeric(14,2) not null check (goal_sales_pen > 0),
  goal_bookings integer check (goal_bookings >= 0),
  goal_margin_pen numeric(14,2),
  goal_conversion_pct numeric(5,2) check (goal_conversion_pct between 0 and 100),
  bonus_amount numeric(14,2),
  bonus_currency char(3) default 'PEN',
  status varchar(20) not null default 'borrador' check (status in ('borrador', 'vigente', 'cerrada', 'anulada')),
  result jsonb,
  bonus_commission_id uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_sales_targets primary key (id),
  constraint ck_crm_sales_targets_1 check (bonus_amount is null or scope_type = 'asesor'),
  constraint ck_crm_sales_targets_2 check (period_to >= period_from)
);

create table crm_sales_target_adjustments (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  target_id uuid not null,
  action varchar(20) not null check (action in ('crear', 'activar', 'ajustar', 'anular', 'cerrar', 'bono')),
  before jsonb,
  after jsonb,
  reason text,
  actor_id uuid not null,
  occurred_at timestamptz not null default now(),
  constraint pk_crm_sales_target_adjustments primary key (id),
  constraint ck_crm_sales_target_adjustments_1 check (action not in ('ajustar','anular') or reason is not null)
);

create table crm_sales_target_policies (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  tiers jsonb not null default '[{"min":90,"pay":50},{"min":100,"pay":100},{"min":120,"pay":130}]',
  primary_metric varchar(20) not null default 'sales',
  lock_decrease_after_pct integer not null default 50,
  attribution_window_days integer not null default 30,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_sales_target_policies primary key (id)
);

create table integration_review_sources (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  provider varchar(20) not null check (provider in ('tripadvisor', 'trustpilot', 'google', 'facebook', 'getyourguide', 'viator')),
  status varchar(20) not null default 'no_conectado' check (status in ('no_conectado', 'pendiente', 'conectado', 'error')),
  account_ref varchar(120),
  secret_ref varchar(200),
  secret_last4 char(4),
  scopes text[] not null default '{}',
  can_reply boolean not null default false,
  supports_invites boolean not null default false,
  rating numeric(3,2),
  review_count integer not null default 0,
  last_sync_at timestamptz,
  connected_at timestamptz,
  connected_by uuid,
  contract_ack_at timestamptz,
  contract_ack_by uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_integration_review_sources primary key (id)
);

create table channel_external_reviews (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  source_id uuid not null,
  external_id varchar(120) not null,
  author_display varchar(120) not null,
  review_date date not null,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text,
  lang char(2),
  product_id uuid,
  url text,
  response_status varchar(20) not null default 'sin_responder' check (response_status in ('sin_responder', 'pendiente_publicar', 'publicada', 'no_admite')),
  reply text,
  replied_at timestamptz,
  replied_by uuid,
  conversation_id uuid,
  raw jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_external_reviews primary key (id)
);

create table crm_review_requests (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  reservation_id uuid not null,
  client_id uuid not null,
  to_address varchar(160) not null,
  channel varchar(10) not null check (channel in ('email', 'whatsapp')),
  lang char(2) not null default 'es',
  token_hash char(64) not null,
  scheduled_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  reminded_at timestamptz,
  expires_at timestamptz,
  status varchar(15) not null default 'programada' check (status in ('programada', 'enviada', 'abierta', 'respondida', 'vencida', 'cancelada')),
  is_demo boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_review_requests primary key (id)
);

create table crm_own_reviews (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  reservation_id uuid not null,
  product_id uuid not null,
  client_id uuid not null,
  passenger_id uuid,
  author_display varchar(80) not null,
  author_name varchar(160) not null,
  country varchar(60),
  travel_date date not null,
  stars smallint not null check (stars between 1 and 5),
  subratings jsonb not null default '{}',
  title varchar(120) not null,
  body text not null check (char_length(body) between 20 and 2000),
  photos jsonb not null default '[]',
  lang char(2) not null default 'es' check (lang in ('es', 'en', 'de', 'fr', 'pt')),
  verified boolean not null default true,
  consent_publish boolean not null default false,
  status varchar(20) not null default 'pendiente' check (status in ('pendiente', 'publicada', 'rechazada', 'oculta')),
  moderation_reason text,
  reply_text text,
  reply_by uuid,
  replied_at timestamptz,
  helpful_count integer not null default 0,
  source varchar(10) not null check (source in ('portal', 'email', 'widget')),
  request_id uuid,
  is_demo boolean not null default false,
  published_at timestamptz,
  moderated_by uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_crm_own_reviews primary key (id),
  constraint ck_crm_own_reviews_1 check (status <> 'publicada' or consent_publish)
);

create table crm_own_review_log (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  review_id uuid not null,
  action varchar(30) not null check (action in ('crear', 'publicar', 'rechazar', 'ocultar', 'responder', 'editar_respuesta', 'autopublicar')),
  note text,
  user_id uuid,
  created_at timestamptz not null default now(),
  constraint pk_crm_own_review_log primary key (id)
);


-- ---------------------------------------------------------------- columnas agregadas a tablas de fases previas
alter table catalog_product_promotions add column campaign_id uuid;
alter table crm_leads add column utm_campaign varchar(40);
alter table fin_commissions add column sales_target_id uuid;
alter table channel_ecom_orders add column utm_campaign varchar(40);

-- ---------------------------------------------------------------- checks agregados
alter table fin_commissions add constraint ck_fin_commissions_x1 check ((kind = 'Bono por meta') = (sales_target_id is not null));

-- ---------------------------------------------------------------- unicidad (índices únicos, incluidos parciales)
create unique index uq_fin_commissions_tenant_id_sales_target_id_p on fin_commissions (tenant_id, sales_target_id) where sales_target_id is not null;
create unique index uq_integration_api_keys_tenant_id_code on integration_api_keys (tenant_id, code);
create unique index uq_integration_api_keys_prefix on integration_api_keys (prefix);
create unique index uq_integration_webhooks_tenant_id_code on integration_webhooks (tenant_id, code);
create unique index uq_integration_oauth_apps_client_id on integration_oauth_apps (client_id);
create unique index uq_mkt_contacts_subscribers_tenant_id_code on mkt_contacts_subscribers (tenant_id, code);
create unique index uq_mkt_contacts_subscribers_tenant_id_email on mkt_contacts_subscribers (tenant_id, email);
create unique index uq_mkt_segments_tenant_id_code on mkt_segments (tenant_id, code);
create unique index uq_mkt_segments_tenant_id_lower_name on mkt_segments (tenant_id, lower(name));
create unique index uq_mkt_templates_tenant_id_code on mkt_templates (tenant_id, code);
create unique index uq_mkt_campaigns_tenant_id_code on mkt_campaigns (tenant_id, code);
create unique index uq_mkt_consents_tenant_id_code on mkt_consents (tenant_id, code);
create unique index uq_mkt_consents_tenant_id_subject_type_subject_id_channel on mkt_consents (tenant_id, subject_type, subject_id, channel);
create unique index uq_mkt_campaign_recipients_campaign_id_subject_type_subject_id on mkt_campaign_recipients (campaign_id, subject_type, subject_id);
create unique index uq_mkt_campaign_suppressions_campaign_id_subject_type_su_c790b4 on mkt_campaign_suppressions (campaign_id, subject_type, subject_id);
create unique index uq_mkt_attributions_tenant_id_kind_reservation_id_p on mkt_attributions (tenant_id, kind, reservation_id) where reservation_id is not null;
create unique index uq_mkt_attributions_tenant_id_kind_lead_id_p on mkt_attributions (tenant_id, kind, lead_id) where lead_id is not null;
create unique index uq_mkt_automations_tenant_id_code on mkt_automations (tenant_id, code);
create unique index uq_mkt_automations_tenant_id_key on mkt_automations (tenant_id, key);
create unique index uq_mkt_automation_enrollments_automation_id_subject_type_bd6412 on mkt_automation_enrollments (automation_id, subject_type, subject_id, ref_type, ref_id);
create unique index uq_crm_sales_teams_tenant_id_code on crm_sales_teams (tenant_id, code);
create unique index uq_crm_sales_team_members_team_id_user_id_valid_from on crm_sales_team_members (team_id, user_id, valid_from);
create unique index uq_crm_sales_targets_tenant_id_code on crm_sales_targets (tenant_id, code);
create unique index uq_crm_sales_targets_tenant_id_scope_type_scope_id_period_key_p on crm_sales_targets (tenant_id, scope_type, scope_id, period_key) where status <> 'anulada';
create unique index uq_crm_sales_target_policies_tenant_id on crm_sales_target_policies (tenant_id);
create unique index uq_integration_review_sources_tenant_id_provider on integration_review_sources (tenant_id, provider);
create unique index uq_channel_external_reviews_tenant_id_source_id_external_id on channel_external_reviews (tenant_id, source_id, external_id);
create unique index uq_crm_review_requests_tenant_id_code on crm_review_requests (tenant_id, code);
create unique index uq_crm_review_requests_tenant_id_reservation_id on crm_review_requests (tenant_id, reservation_id);
create unique index uq_crm_review_requests_token_hash on crm_review_requests (token_hash);
create unique index uq_crm_own_reviews_tenant_id_code on crm_own_reviews (tenant_id, code);
create unique index uq_crm_own_reviews_tenant_id_reservation_id_product_id_p_7ca549 on crm_own_reviews (tenant_id, reservation_id, product_id, passenger_id) nulls not distinct where deleted_at is null;

-- ---------------------------------------------------------------- claves foráneas
alter table catalog_product_promotions add constraint fk_catalog_product_promotions_campaign_id foreign key (campaign_id) references mkt_campaigns (id);
alter table fin_commissions add constraint fk_fin_commissions_sales_target_id foreign key (sales_target_id) references crm_sales_targets (id);
alter table integration_api_keys add constraint fk_integration_api_keys_tenant_id foreign key (tenant_id) references tenants (id);
alter table integration_api_keys add constraint fk_integration_api_keys_revoked_by foreign key (revoked_by) references iam_users (id);
alter table integration_webhooks add constraint fk_integration_webhooks_tenant_id foreign key (tenant_id) references tenants (id);
alter table integration_webhook_deliveries add constraint fk_integration_webhook_deliveries_tenant_id foreign key (tenant_id) references tenants (id);
alter table integration_webhook_deliveries add constraint fk_integration_webhook_deliveries_webhook_id foreign key (webhook_id) references integration_webhooks (id);
alter table oauth_clients add constraint fk_oauth_clients_tenant_id foreign key (tenant_id) references tenants (id);
alter table integration_oauth_apps add constraint fk_integration_oauth_apps_tenant_id foreign key (tenant_id) references tenants (id);
alter table integration_oauth_apps add constraint fk_integration_oauth_apps_client_id foreign key (client_id) references oauth_clients (id);
alter table mkt_contacts_subscribers add constraint fk_mkt_contacts_subscribers_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_contacts_subscribers add constraint fk_mkt_contacts_subscribers_client_id foreign key (client_id) references crm_clients (id);
alter table mkt_contacts_subscribers add constraint fk_mkt_contacts_subscribers_lead_id foreign key (lead_id) references crm_leads (id);
alter table mkt_segments add constraint fk_mkt_segments_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_segments add constraint fk_mkt_segments_owner_id foreign key (owner_id) references iam_users (id);
alter table mkt_templates add constraint fk_mkt_templates_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_campaigns add constraint fk_mkt_campaigns_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_campaigns add constraint fk_mkt_campaigns_segment_id foreign key (segment_id) references mkt_segments (id);
alter table mkt_campaigns add constraint fk_mkt_campaigns_template_id foreign key (template_id) references mkt_templates (id);
alter table mkt_campaigns add constraint fk_mkt_campaigns_promotion_id foreign key (promotion_id) references catalog_product_promotions (id);
alter table mkt_campaigns add constraint fk_mkt_campaigns_owner_id foreign key (owner_id) references iam_users (id);
alter table mkt_consents add constraint fk_mkt_consents_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_consents add constraint fk_mkt_consents_revoke_campaign_id foreign key (revoke_campaign_id) references mkt_campaigns (id);
alter table mkt_consent_events add constraint fk_mkt_consent_events_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_consent_events add constraint fk_mkt_consent_events_consent_id foreign key (consent_id) references mkt_consents (id);
alter table mkt_consent_events add constraint fk_mkt_consent_events_actor_id foreign key (actor_id) references iam_users (id);
alter table mkt_campaign_tests add constraint fk_mkt_campaign_tests_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_campaign_tests add constraint fk_mkt_campaign_tests_campaign_id foreign key (campaign_id) references mkt_campaigns (id);
alter table mkt_campaign_tests add constraint fk_mkt_campaign_tests_to_user_id foreign key (to_user_id) references iam_users (id);
alter table mkt_campaign_recipients add constraint fk_mkt_campaign_recipients_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_campaign_recipients add constraint fk_mkt_campaign_recipients_campaign_id foreign key (campaign_id) references mkt_campaigns (id);
alter table mkt_campaign_suppressions add constraint fk_mkt_campaign_suppressions_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_campaign_suppressions add constraint fk_mkt_campaign_suppressions_campaign_id foreign key (campaign_id) references mkt_campaigns (id);
alter table mkt_attributions add constraint fk_mkt_attributions_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_attributions add constraint fk_mkt_attributions_campaign_id foreign key (campaign_id) references mkt_campaigns (id);
alter table mkt_attributions add constraint fk_mkt_attributions_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table mkt_attributions add constraint fk_mkt_attributions_lead_id foreign key (lead_id) references crm_leads (id);
alter table mkt_attributions add constraint fk_mkt_attributions_ecom_order_id foreign key (ecom_order_id) references channel_ecom_orders (id);
alter table mkt_automations add constraint fk_mkt_automations_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_automations add constraint fk_mkt_automations_template_id foreign key (template_id) references mkt_templates (id);
alter table mkt_automation_runs add constraint fk_mkt_automation_runs_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_automation_runs add constraint fk_mkt_automation_runs_automation_id foreign key (automation_id) references mkt_automations (id);
alter table mkt_automation_runs add constraint fk_mkt_automation_runs_triggered_by foreign key (triggered_by) references iam_users (id);
alter table mkt_automation_enrollments add constraint fk_mkt_automation_enrollments_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_automation_enrollments add constraint fk_mkt_automation_enrollments_automation_id foreign key (automation_id) references mkt_automations (id);
alter table crm_sales_teams add constraint fk_crm_sales_teams_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_sales_teams add constraint fk_crm_sales_teams_leader_id foreign key (leader_id) references iam_users (id);
alter table crm_sales_team_members add constraint fk_crm_sales_team_members_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_sales_team_members add constraint fk_crm_sales_team_members_team_id foreign key (team_id) references crm_sales_teams (id);
alter table crm_sales_team_members add constraint fk_crm_sales_team_members_user_id foreign key (user_id) references iam_users (id);
alter table crm_sales_targets add constraint fk_crm_sales_targets_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_sales_targets add constraint fk_crm_sales_targets_bonus_commission_id foreign key (bonus_commission_id) references fin_commissions (id);
alter table crm_sales_target_adjustments add constraint fk_crm_sales_target_adjustments_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_sales_target_adjustments add constraint fk_crm_sales_target_adjustments_target_id foreign key (target_id) references crm_sales_targets (id);
alter table crm_sales_target_adjustments add constraint fk_crm_sales_target_adjustments_actor_id foreign key (actor_id) references iam_users (id);
alter table crm_sales_target_policies add constraint fk_crm_sales_target_policies_tenant_id foreign key (tenant_id) references tenants (id);
alter table integration_review_sources add constraint fk_integration_review_sources_tenant_id foreign key (tenant_id) references tenants (id);
alter table integration_review_sources add constraint fk_integration_review_sources_connected_by foreign key (connected_by) references iam_users (id);
alter table integration_review_sources add constraint fk_integration_review_sources_contract_ack_by foreign key (contract_ack_by) references iam_users (id);
alter table channel_external_reviews add constraint fk_channel_external_reviews_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_external_reviews add constraint fk_channel_external_reviews_source_id foreign key (source_id) references integration_review_sources (id);
alter table channel_external_reviews add constraint fk_channel_external_reviews_product_id foreign key (product_id) references catalog_products (id);
alter table channel_external_reviews add constraint fk_channel_external_reviews_replied_by foreign key (replied_by) references iam_users (id);
alter table channel_external_reviews add constraint fk_channel_external_reviews_conversation_id foreign key (conversation_id) references collab_conversations (id);
alter table crm_review_requests add constraint fk_crm_review_requests_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_review_requests add constraint fk_crm_review_requests_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table crm_review_requests add constraint fk_crm_review_requests_client_id foreign key (client_id) references crm_clients (id);
alter table crm_own_reviews add constraint fk_crm_own_reviews_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_own_reviews add constraint fk_crm_own_reviews_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table crm_own_reviews add constraint fk_crm_own_reviews_product_id foreign key (product_id) references catalog_products (id);
alter table crm_own_reviews add constraint fk_crm_own_reviews_client_id foreign key (client_id) references crm_clients (id);
alter table crm_own_reviews add constraint fk_crm_own_reviews_passenger_id foreign key (passenger_id) references booking_passengers (id);
alter table crm_own_reviews add constraint fk_crm_own_reviews_reply_by foreign key (reply_by) references iam_users (id);
alter table crm_own_reviews add constraint fk_crm_own_reviews_request_id foreign key (request_id) references crm_review_requests (id);
alter table crm_own_reviews add constraint fk_crm_own_reviews_moderated_by foreign key (moderated_by) references iam_users (id);
alter table crm_own_review_log add constraint fk_crm_own_review_log_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_own_review_log add constraint fk_crm_own_review_log_review_id foreign key (review_id) references crm_own_reviews (id);
alter table crm_own_review_log add constraint fk_crm_own_review_log_user_id foreign key (user_id) references iam_users (id);

-- ---------------------------------------------------------------- índices (FK, listados, búsquedas)
create index ix_integration_api_keys_tenant_id_status on integration_api_keys (tenant_id, status);
create index ix_integration_webhooks_events on integration_webhooks using gin (events);
create index ix_integration_webhooks_tenant_id_status on integration_webhooks (tenant_id, status);
create index ix_integration_webhook_deliveries_tenant_id_webhook_id_c_761fb0 on integration_webhook_deliveries (tenant_id, webhook_id, created_at desc);
create index ix_integration_webhook_deliveries_status_next_retry_at_p on integration_webhook_deliveries (status, next_retry_at) where status = 'retrying';
create index ix_oauth_clients_owner_type_owner_id on oauth_clients (owner_type, owner_id);
create index ix_mkt_contacts_subscribers_tenant_id_phone_e164 on mkt_contacts_subscribers (tenant_id, phone_e164);
create index ix_mkt_segments_tenant_id_owner_id on mkt_segments (tenant_id, owner_id);
create index ix_mkt_campaigns_tenant_id_status on mkt_campaigns (tenant_id, status);
create index ix_mkt_campaigns_tenant_id_owner_id on mkt_campaigns (tenant_id, owner_id);
create index ix_mkt_campaigns_tenant_id_scheduled_at_p on mkt_campaigns (tenant_id, scheduled_at) where status = 'programada';
create index ix_mkt_campaigns_tenant_id_sent_at_desc on mkt_campaigns (tenant_id, sent_at desc);
create index ix_mkt_consents_tenant_id_subject_type_subject_id on mkt_consents (tenant_id, subject_type, subject_id);
create index ix_mkt_consents_tenant_id_channel_p on mkt_consents (tenant_id, channel) where status = 'otorgado';
create index ix_mkt_consent_events_tenant_id_occurred_at on mkt_consent_events (tenant_id, occurred_at);
create index ix_mkt_campaign_recipients_tenant_id_subject_type_subjec_4344ad on mkt_campaign_recipients (tenant_id, subject_type, subject_id, campaign_id);
create index ix_mkt_campaign_recipients_tenant_id_status on mkt_campaign_recipients (tenant_id, status);
create index ix_crm_sales_targets_tenant_id_period_key on crm_sales_targets (tenant_id, period_key);
create index ix_crm_sales_targets_tenant_id_scope_type_scope_id on crm_sales_targets (tenant_id, scope_type, scope_id);
create index ix_crm_sales_targets_tenant_id_status on crm_sales_targets (tenant_id, status);
create index ix_channel_external_reviews_tenant_id_response_status on channel_external_reviews (tenant_id, response_status);
create index ix_crm_review_requests_tenant_id_status on crm_review_requests (tenant_id, status);
create index ix_crm_own_reviews_tenant_id_status on crm_own_reviews (tenant_id, status);
create index ix_crm_own_reviews_tenant_id_product_id_status_published_d101db on crm_own_reviews (tenant_id, product_id, status, published_at desc);
create index ix_crm_own_reviews_tenant_id_client_id on crm_own_reviews (tenant_id, client_id);
create index ix_integration_api_keys_tenant_id_created_at_desc on integration_api_keys (tenant_id, created_at desc);
create index ix_integration_webhooks_tenant_id_created_at_desc on integration_webhooks (tenant_id, created_at desc);
create index ix_integration_webhook_deliveries_tenant_id_status on integration_webhook_deliveries (tenant_id, status);
create index ix_oauth_clients_tenant_id_owner_id on oauth_clients (tenant_id, owner_id);
create index ix_integration_oauth_apps_tenant_id_status on integration_oauth_apps (tenant_id, status);
create index ix_mkt_contacts_subscribers_tenant_id_created_at_desc on mkt_contacts_subscribers (tenant_id, created_at desc);
create index ix_mkt_segments_tenant_id_created_at_desc on mkt_segments (tenant_id, created_at desc);
create index ix_mkt_templates_tenant_id_status on mkt_templates (tenant_id, status);
create index ix_mkt_templates_tenant_id_created_at_desc on mkt_templates (tenant_id, created_at desc);
create index ix_mkt_campaigns_tenant_id_created_at_desc on mkt_campaigns (tenant_id, created_at desc);
create index ix_mkt_consents_tenant_id_status on mkt_consents (tenant_id, status);
create index ix_mkt_consents_tenant_id_created_at_desc on mkt_consents (tenant_id, created_at desc);
create index ix_mkt_automations_tenant_id_status on mkt_automations (tenant_id, status);
create index ix_mkt_automations_tenant_id_created_at_desc on mkt_automations (tenant_id, created_at desc);
create index ix_mkt_automation_enrollments_tenant_id_status on mkt_automation_enrollments (tenant_id, status);
create index ix_crm_sales_teams_tenant_id_created_at_desc on crm_sales_teams (tenant_id, created_at desc);
create index ix_crm_sales_targets_tenant_id_created_at_desc on crm_sales_targets (tenant_id, created_at desc);
create index ix_integration_review_sources_tenant_id_status on integration_review_sources (tenant_id, status);
create index ix_crm_review_requests_tenant_id_created_at_desc on crm_review_requests (tenant_id, created_at desc);
create index ix_crm_own_reviews_tenant_id_created_at_desc on crm_own_reviews (tenant_id, created_at desc);
create index ix_catalog_product_promotions_campaign_id on catalog_product_promotions (campaign_id);
create index ix_fin_commissions_sales_target_id on fin_commissions (sales_target_id);
create index ix_integration_api_keys_revoked_by on integration_api_keys (revoked_by);
create index ix_integration_webhook_deliveries_webhook_id on integration_webhook_deliveries (webhook_id);
create index ix_mkt_contacts_subscribers_client_id on mkt_contacts_subscribers (client_id);
create index ix_mkt_contacts_subscribers_lead_id on mkt_contacts_subscribers (lead_id);
create index ix_mkt_segments_owner_id on mkt_segments (owner_id);
create index ix_mkt_campaigns_segment_id on mkt_campaigns (segment_id);
create index ix_mkt_campaigns_template_id on mkt_campaigns (template_id);
create index ix_mkt_campaigns_promotion_id on mkt_campaigns (promotion_id);
create index ix_mkt_campaigns_owner_id on mkt_campaigns (owner_id);
create index ix_mkt_consents_revoke_campaign_id on mkt_consents (revoke_campaign_id);
create index ix_mkt_consent_events_consent_id on mkt_consent_events (consent_id);
create index ix_mkt_consent_events_actor_id on mkt_consent_events (actor_id);
create index ix_mkt_campaign_tests_campaign_id on mkt_campaign_tests (campaign_id);
create index ix_mkt_campaign_tests_to_user_id on mkt_campaign_tests (to_user_id);
create index ix_mkt_attributions_campaign_id on mkt_attributions (campaign_id);
create index ix_mkt_attributions_reservation_id on mkt_attributions (reservation_id);
create index ix_mkt_attributions_lead_id on mkt_attributions (lead_id);
create index ix_mkt_attributions_ecom_order_id on mkt_attributions (ecom_order_id);
create index ix_mkt_automations_template_id on mkt_automations (template_id);
create index ix_mkt_automation_runs_automation_id on mkt_automation_runs (automation_id);
create index ix_mkt_automation_runs_triggered_by on mkt_automation_runs (triggered_by);
create index ix_crm_sales_teams_leader_id on crm_sales_teams (leader_id);
create index ix_crm_sales_team_members_user_id on crm_sales_team_members (user_id);
create index ix_crm_sales_targets_bonus_commission_id on crm_sales_targets (bonus_commission_id);
create index ix_crm_sales_target_adjustments_target_id on crm_sales_target_adjustments (target_id);
create index ix_crm_sales_target_adjustments_actor_id on crm_sales_target_adjustments (actor_id);
create index ix_integration_review_sources_connected_by on integration_review_sources (connected_by);
create index ix_integration_review_sources_contract_ack_by on integration_review_sources (contract_ack_by);
create index ix_channel_external_reviews_source_id on channel_external_reviews (source_id);
create index ix_channel_external_reviews_product_id on channel_external_reviews (product_id);
create index ix_channel_external_reviews_replied_by on channel_external_reviews (replied_by);
create index ix_channel_external_reviews_conversation_id on channel_external_reviews (conversation_id);
create index ix_crm_review_requests_reservation_id on crm_review_requests (reservation_id);
create index ix_crm_review_requests_client_id on crm_review_requests (client_id);
create index ix_crm_own_reviews_reservation_id on crm_own_reviews (reservation_id);
create index ix_crm_own_reviews_product_id on crm_own_reviews (product_id);
create index ix_crm_own_reviews_client_id on crm_own_reviews (client_id);
create index ix_crm_own_reviews_passenger_id on crm_own_reviews (passenger_id);
create index ix_crm_own_reviews_reply_by on crm_own_reviews (reply_by);
create index ix_crm_own_reviews_request_id on crm_own_reviews (request_id);
create index ix_crm_own_reviews_moderated_by on crm_own_reviews (moderated_by);
create index ix_crm_own_review_log_review_id on crm_own_review_log (review_id);
create index ix_crm_own_review_log_user_id on crm_own_review_log (user_id);
create index ix_mkt_campaign_tests_tenant_id on mkt_campaign_tests (tenant_id);
create index ix_mkt_campaign_suppressions_tenant_id on mkt_campaign_suppressions (tenant_id);
create index ix_mkt_attributions_tenant_id on mkt_attributions (tenant_id);
create index ix_mkt_automation_runs_tenant_id on mkt_automation_runs (tenant_id);
create index ix_crm_sales_team_members_tenant_id on crm_sales_team_members (tenant_id);
create index ix_crm_sales_target_adjustments_tenant_id on crm_sales_target_adjustments (tenant_id);
create index ix_crm_own_review_log_tenant_id on crm_own_review_log (tenant_id);

-- ---------------------------------------------------------------- restricciones de exclusión y triggers específicos
create trigger trg_mkt_consent_events_append_only before update or delete on mkt_consent_events for each row execute function app_forbid_update_delete();

-- ---------------------------------------------------------------- triggers de updated_at / lock_version
create trigger trg_integration_webhooks_updated_at before update on integration_webhooks for each row execute function app_set_updated_at();
create trigger trg_oauth_clients_updated_at before update on oauth_clients for each row execute function app_set_updated_at();
create trigger trg_mkt_contacts_subscribers_updated_at before update on mkt_contacts_subscribers for each row execute function app_set_updated_at();
create trigger trg_mkt_segments_updated_at before update on mkt_segments for each row execute function app_set_updated_at();
create trigger trg_mkt_templates_updated_at before update on mkt_templates for each row execute function app_set_updated_at();
create trigger trg_mkt_campaigns_updated_at before update on mkt_campaigns for each row execute function app_set_updated_at();
create trigger trg_mkt_campaigns_lock_version before update on mkt_campaigns for each row execute function app_bump_lock_version();
create trigger trg_mkt_consents_updated_at before update on mkt_consents for each row execute function app_set_updated_at();
create trigger trg_mkt_consents_lock_version before update on mkt_consents for each row execute function app_bump_lock_version();
create trigger trg_mkt_campaign_recipients_updated_at before update on mkt_campaign_recipients for each row execute function app_set_updated_at();
create trigger trg_mkt_attributions_updated_at before update on mkt_attributions for each row execute function app_set_updated_at();
create trigger trg_mkt_automations_updated_at before update on mkt_automations for each row execute function app_set_updated_at();
create trigger trg_crm_sales_teams_updated_at before update on crm_sales_teams for each row execute function app_set_updated_at();
create trigger trg_crm_sales_team_members_updated_at before update on crm_sales_team_members for each row execute function app_set_updated_at();
create trigger trg_crm_sales_targets_updated_at before update on crm_sales_targets for each row execute function app_set_updated_at();
create trigger trg_crm_sales_targets_lock_version before update on crm_sales_targets for each row execute function app_bump_lock_version();
create trigger trg_crm_sales_target_policies_updated_at before update on crm_sales_target_policies for each row execute function app_set_updated_at();
create trigger trg_integration_review_sources_updated_at before update on integration_review_sources for each row execute function app_set_updated_at();
create trigger trg_channel_external_reviews_updated_at before update on channel_external_reviews for each row execute function app_set_updated_at();
create trigger trg_crm_review_requests_updated_at before update on crm_review_requests for each row execute function app_set_updated_at();
create trigger trg_crm_own_reviews_updated_at before update on crm_own_reviews for each row execute function app_set_updated_at();
create trigger trg_crm_own_reviews_lock_version before update on crm_own_reviews for each row execute function app_bump_lock_version();

-- ---------------------------------------------------------------- comentarios (spec de origen)
comment on column catalog_product_promotions.campaign_id is 'Columnas agregadas en Fase 3 por spec 14 §3.17';
comment on column crm_leads.utm_campaign is 'Columnas agregadas en Fase 3 por spec 14 §3.17';
comment on column fin_commissions.sales_target_id is 'Columnas agregadas en Fase 3 por spec 14 §3.17';
comment on column channel_ecom_orders.utm_campaign is 'Columnas agregadas en Fase 3 por spec 14 §3.17';
comment on table integration_api_keys is '[Spec 13 §3.11] [Fase 3] API keys del tenant (solo hash del token).';
comment on table integration_webhooks is '[Spec 13 §3.12] [Fase 3] Suscripciones de webhooks del tenant.';
comment on table integration_webhook_deliveries is '[Spec 13 §3.13] [Fase 3] Entregas de webhooks (particionada por mes, retención 30 días).';
comment on table oauth_clients is '[Spec 13 §3.14] [Fase 3] Clientes OAuth (Laravel Passport) extendidos con tenant_id.';
comment on table integration_oauth_apps is '[Spec 13 §3.14] [Fase 3] Apps OAuth de terceros autorizadas (Authorization Code + PKCE).';
comment on table mkt_contacts_subscribers is '[Spec 14 §3.1] [Fase 3] Suscriptores del newsletter.';
comment on table mkt_segments is '[Spec 14 §3.4] [Fase 3] Segmentos de audiencia.';
comment on table mkt_templates is '[Spec 14 §3.5] [Fase 3] Plantillas de marketing (email / WhatsApp).';
comment on table mkt_campaigns is '[Spec 14 §3.6] [Fase 3] Campañas de marketing.';
comment on table mkt_consents is '[Spec 14 §3.2] [Fase 3] Consentimiento vigente por titular y canal.';
comment on table mkt_consent_events is '[Spec 14 §3.3] [Fase 3] Historial inmutable de consentimientos (evidencia ANPD).';
comment on table mkt_campaign_tests is '[Spec 14 §3.7] [Fase 3] Envíos de prueba de campaña.';
comment on table mkt_campaign_recipients is '[Spec 14 §3.8] [Fase 3] Destinatarios de la campaña y métricas.';
comment on table mkt_campaign_suppressions is '[Spec 14 §3.9] [Fase 3] Contactos suprimidos del envío (evidencia).';
comment on table mkt_attributions is '[Spec 14 §3.10] [Fase 3] Atribución de conversiones a campañas (read model).';
comment on table mkt_automations is '[Spec 14 §3.11] [Fase 3] Automatizaciones de marketing / servicio.';
comment on table mkt_automation_runs is '[Spec 14 §3.12] [Fase 3] Ejecuciones de automatizaciones.';
comment on table mkt_automation_enrollments is '[Spec 14 §3.12] [Fase 3] Disparos procesados por automatización (idempotencia).';
comment on table crm_sales_teams is '[Spec 14 §3.13] [Fase 3] Equipos de venta.';
comment on table crm_sales_team_members is '[Spec 14 §3.13] [Fase 3] Integrantes del equipo (vigencias).';
comment on table crm_sales_targets is '[Spec 14 §3.14] [Fase 3] Metas comerciales por asesor, sede o equipo.';
comment on table crm_sales_target_adjustments is '[Spec 14 §3.15] [Fase 3] Historial de ajustes de la meta.';
comment on table crm_sales_target_policies is '[Spec 14 §3.16] [Fase 3] Política de metas y bonos (1 fila por tenant).';
comment on table integration_review_sources is '[Spec 17 §3.7] [Fase 3] Conectores de reseñas externas (TripAdvisor, Google…).';
comment on table channel_external_reviews is '[Spec 17 §3.7] [Fase 3] Reseñas importadas (texto inmutable).';
comment on table crm_review_requests is '[Spec 18 §3.3] [Fase 3] Solicitudes de reseña post-viaje.';
comment on table crm_own_reviews is '[Spec 18 §3.1] [Fase 3] Reseñas propias verificadas por reserva.';
comment on table crm_own_review_log is '[Spec 18 §3.2] [Fase 3] Historial de moderación de la reseña.';


-- ================================================================ v2.6 · Crecimiento comercial (spec 19)
-- IA de ventas, WhatsApp oficial, cobro local, recuperación de carritos, importador, OTAs, marketplace B2B,
-- precios dinámicos, vales de regalo, check-in QR y deslinde, exportación contable, aéreo/hotel por integración.

create table sys_ai_requests (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  kind varchar(20) not null check (kind in ('itinerary', 'quote_draft', 'reply_draft', 'summary', 'product_import', 'insight')),
  source_type varchar(40),
  source_id uuid,
  user_id uuid,
  prompt text not null,
  input_ref jsonb not null default '{}',
  output jsonb,
  provider varchar(40) not null default 'fake',
  model varchar(80),
  tokens_in integer not null default 0 check (tokens_in >= 0),
  tokens_out integer not null default 0 check (tokens_out >= 0),
  cost_usd numeric(10,4) not null default 0 check (cost_usd >= 0),
  status varchar(12) not null default 'pending' check (status in ('pending', 'completed', 'failed', 'applied', 'discarded')),
  error text,
  completed_at timestamptz,
  applied_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_sys_ai_requests primary key (id),
  constraint ck_sys_ai_requests_1 check (status <> 'applied' or applied_at is not null)
);

create table report_ai_insights (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  kind varchar(30) not null check (kind in ('margen_bajo', 'proveedor_caro', 'meta_en_riesgo', 'cobranza_atrasada', 'demanda_alta')),
  severity varchar(10) not null default 'media' check (severity in ('baja', 'media', 'alta')),
  title varchar(160) not null,
  detail text not null,
  source_type varchar(40),
  source_id uuid,
  metric jsonb not null default '{}',
  audience_user_id uuid,
  status varchar(12) not null default 'nueva' check (status in ('nueva', 'vista', 'resuelta', 'descartada')),
  ai_request_id uuid,
  generated_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_report_ai_insights primary key (id)
);

create table collab_whatsapp_templates (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  channel_account_id uuid not null,
  name varchar(80) not null check (name ~ '^[a-z0-9_]{1,80}$'),
  lang varchar(10) not null default 'es',
  category varchar(20) not null check (category in ('utility', 'marketing', 'authentication')),
  purpose varchar(30) not null check (purpose in ('cotizacion', 'link_pago', 'voucher', 'recordatorio', 'recuperacion', 'resena', 'otro')),
  body text not null,
  variables text[] not null default '{}',
  meta_template_id varchar(60),
  status varchar(12) not null default 'borrador' check (status in ('borrador', 'enviada', 'aprobada', 'rechazada', 'pausada')),
  rejected_reason text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_collab_whatsapp_templates primary key (id)
);

create table fin_payment_links (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  reservation_id uuid,
  receivable_id uuid,
  gift_card_id uuid,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null,
  methods text[] not null default '{card}' check (methods <@ array['card', 'yape', 'plin', 'mercadopago', 'transfer', 'pagoefectivo', 'paypal']::text[]),
  installments_max smallint not null default 1 check (installments_max between 1 and 24),
  provider varchar(30) not null default 'fake',
  provider_ref varchar(120),
  url text,
  token_hash char(64) not null,
  sent_via varchar(10) check (sent_via is null or sent_via in ('email', 'whatsapp', 'copia')),
  expires_at timestamptz not null,
  status varchar(10) not null default 'activo' check (status in ('activo', 'pagado', 'vencido', 'anulado')),
  paid_at timestamptz,
  payment_id uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_payment_links primary key (id),
  constraint ck_fin_payment_links_1 check (reservation_id is not null or receivable_id is not null or gift_card_id is not null),
  constraint ck_fin_payment_links_2 check (status <> 'pagado' or (paid_at is not null and payment_id is not null))
);

create table mkt_recovery_flows (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  name varchar(120) not null,
  trigger_kind varchar(10) not null check (trigger_kind in ('cart', 'quote')),
  delay_minutes integer not null check (delay_minutes between 15 and 20160),
  channel varchar(10) not null check (channel in ('email', 'whatsapp')),
  template_ref varchar(80) not null,
  max_attempts smallint not null default 2 check (max_attempts between 1 and 5),
  include_payment_link boolean not null default true,
  active boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_mkt_recovery_flows primary key (id)
);

create table mkt_recovery_attempts (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  flow_id uuid not null,
  cart_id uuid,
  quote_id uuid,
  client_id uuid,
  to_address varchar(160) not null,
  attempt_no smallint not null default 1 check (attempt_no between 1 and 5),
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  status varchar(12) not null default 'programado' check (status in ('programado', 'enviado', 'recuperado', 'descartado', 'fallido')),
  recovered_reservation_id uuid,
  recovered_amount numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_mkt_recovery_attempts primary key (id),
  constraint ck_mkt_recovery_attempts_1 check ((cart_id is not null) <> (quote_id is not null)),
  constraint ck_mkt_recovery_attempts_2 check (status <> 'recuperado' or recovered_reservation_id is not null)
);

create table catalog_import_jobs (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  source_type varchar(10) not null check (source_type in ('url', 'pdf', 'csv', 'xlsx')),
  source_url text,
  file_path text,
  status varchar(12) not null default 'en_cola' check (status in ('en_cola', 'procesando', 'revision', 'importado', 'fallido', 'cancelado')),
  extracted jsonb not null default '[]',
  products_detected integer not null default 0,
  products_created integer not null default 0,
  ai_request_id uuid,
  error text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_import_jobs primary key (id),
  constraint ck_catalog_import_jobs_1 check (source_url is not null or file_path is not null)
);

create table catalog_dynamic_price_rules (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  name varchar(120) not null,
  product_id uuid,
  basis varchar(15) not null check (basis in ('ocupacion', 'anticipacion', 'dia_semana', 'temporada', 'demanda')),
  conditions jsonb not null,
  adjust_pct numeric(6,2) not null check (adjust_pct between -50 and 100),
  floor_pct numeric(6,2) not null default -30 check (floor_pct between -50 and 0),
  ceiling_pct numeric(6,2) not null default 50 check (ceiling_pct between 0 and 100),
  priority smallint not null default 100,
  channels text[] not null default '{web,b2b,ota,interno}',
  valid_from date,
  valid_to date,
  active boolean not null default false,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_dynamic_price_rules primary key (id),
  constraint ck_catalog_dynamic_price_rules_1 check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create table channel_ota_connections (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  ota varchar(20) not null check (ota in ('viator', 'getyourguide', 'expedia', 'google_ttd', 'civitatis', 'otro')),
  name varchar(120) not null,
  account_ref varchar(120),
  credentials_encrypted text,
  webhook_secret_encrypted text,
  commission_pct numeric(5,2) not null default 0 check (commission_pct between 0 and 60),
  markup_pct numeric(5,2) not null default 0 check (markup_pct between -20 and 100),
  sync_availability boolean not null default true,
  status varchar(12) not null default 'borrador' check (status in ('borrador', 'conectado', 'pausado', 'error', 'desconectado')),
  last_sync_at timestamptz,
  last_error text,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_ota_connections primary key (id)
);

create table channel_ota_product_mappings (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  connection_id uuid not null,
  product_id uuid not null,
  ota_product_ref varchar(120) not null,
  ota_option_ref varchar(120),
  price_mode varchar(10) not null default 'markup' check (price_mode in ('markup', 'fijo', 'neto')),
  fixed_price numeric(14,2) check (fixed_price is null or fixed_price > 0),
  status varchar(12) not null default 'pendiente' check (status in ('pendiente', 'activo', 'pausado', 'error')),
  last_sync_at timestamptz,
  last_error text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_ota_product_mappings primary key (id),
  constraint ck_channel_ota_product_mappings_1 check (price_mode <> 'fijo' or fixed_price is not null)
);

create table channel_ota_bookings (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  connection_id uuid not null,
  ota_booking_ref varchar(120) not null,
  mapping_id uuid,
  reservation_id uuid,
  payload jsonb not null,
  gross_amount numeric(14,2),
  net_amount numeric(14,2),
  currency char(3),
  travel_date date,
  pax smallint check (pax is null or pax > 0),
  status varchar(12) not null default 'recibida' check (status in ('recibida', 'confirmada', 'rechazada', 'cancelada', 'error')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_ota_bookings primary key (id),
  constraint ck_channel_ota_bookings_1 check (status <> 'confirmada' or reservation_id is not null)
);

-- Marketplace B2B entre tenants: tablas de PLATAFORMA (sin tenant_id; seller/reseller son tenants).
-- app_role no tiene privilegios; se accede por MarketplaceService con la conexión platform (spec 19 §3.12).
create table platform_marketplace_listings (
  id uuid not null default app_uuid_v7(),
  seller_tenant_id uuid not null,
  product_ref uuid not null,
  product_code varchar(40) not null,
  title varchar(200) not null,
  destination varchar(120),
  summary text,
  currency char(3) not null,
  from_price numeric(14,2) check (from_price is null or from_price > 0),
  reseller_commission_pct numeric(5,2) not null check (reseller_commission_pct between 0 and 40),
  status varchar(12) not null default 'borrador' check (status in ('borrador', 'publicado', 'pausado', 'retirado')),
  published_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_marketplace_listings primary key (id)
);

create table platform_marketplace_partnerships (
  id uuid not null default app_uuid_v7(),
  seller_tenant_id uuid not null,
  reseller_tenant_id uuid not null,
  status varchar(12) not null default 'solicitada' check (status in ('solicitada', 'activa', 'rechazada', 'suspendida', 'terminada')),
  commission_pct numeric(5,2) not null check (commission_pct between 0 and 40),
  platform_fee_pct numeric(4,2) not null default 1.00 check (platform_fee_pct between 0 and 10),
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  payment_terms varchar(10) not null default 'prepago' check (payment_terms in ('prepago', 'credito')),
  requested_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_marketplace_partnerships primary key (id),
  constraint ck_platform_marketplace_partnerships_1 check (seller_tenant_id <> reseller_tenant_id)
);

create table platform_marketplace_orders (
  id uuid not null default app_uuid_v7(),
  code varchar(30) not null,
  partnership_id uuid not null,
  listing_id uuid not null,
  seller_tenant_id uuid not null,
  reseller_tenant_id uuid not null,
  seller_reservation_ref uuid,
  reseller_reservation_ref uuid,
  gross_amount numeric(14,2) not null check (gross_amount > 0),
  commission_amount numeric(14,2) not null check (commission_amount >= 0),
  platform_fee_amount numeric(14,2) not null check (platform_fee_amount >= 0),
  currency char(3) not null,
  status varchar(12) not null default 'solicitada' check (status in ('solicitada', 'confirmada', 'rechazada', 'cancelada', 'liquidada')),
  idempotency_key varchar(80) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_marketplace_orders primary key (id)
);

create table fin_gift_cards (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  redeem_code_hash char(64) not null,
  redeem_code_last4 char(4) not null,
  initial_amount numeric(14,2) not null check (initial_amount > 0),
  balance numeric(14,2) not null check (balance >= 0),
  currency char(3) not null,
  buyer_client_id uuid,
  recipient_name varchar(160),
  recipient_email varchar(190),
  message varchar(500),
  deliver_at timestamptz,
  expires_at date not null,
  status varchar(10) not null default 'pendiente' check (status in ('pendiente', 'activa', 'agotada', 'vencida', 'anulada')),
  payment_id uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_gift_cards primary key (id),
  constraint ck_fin_gift_cards_1 check (balance <= initial_amount),
  constraint ck_fin_gift_cards_2 check (status <> 'agotada' or balance = 0)
);

create table fin_gift_card_movements (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  gift_card_id uuid not null,
  kind varchar(10) not null check (kind in ('emision', 'canje', 'reverso', 'ajuste', 'anulacion', 'vencimiento')),
  amount numeric(14,2) not null check (amount <> 0),
  balance_after numeric(14,2) not null check (balance_after >= 0),
  reservation_id uuid,
  receivable_id uuid,
  note varchar(300),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_fin_gift_card_movements primary key (id)
);

create table ops_waiver_templates (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  name varchar(120) not null,
  lang char(2) not null default 'es',
  version smallint not null default 1 check (version >= 1),
  body text not null,
  requires_guardian_for_minors boolean not null default true,
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_ops_waiver_templates primary key (id)
);

create table ops_waiver_signatures (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  template_id uuid not null,
  template_version smallint not null,
  body_sha256 char(64) not null,
  reservation_id uuid not null,
  passenger_id uuid not null,
  signed_name varchar(160) not null,
  guardian_name varchar(160),
  signature_path text not null,
  ip inet,
  user_agent varchar(300),
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint pk_ops_waiver_signatures primary key (id)
);

create table ops_checkin_passes (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  passenger_id uuid not null,
  service_id uuid not null,
  token_hash char(64) not null,
  status varchar(10) not null default 'emitido' check (status in ('emitido', 'usado', 'anulado')),
  issued_at timestamptz not null default now(),
  scanned_at timestamptz,
  scanned_by uuid,
  scan_device_id varchar(80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_ops_checkin_passes primary key (id),
  constraint ck_ops_checkin_passes_1 check (status <> 'usado' or scanned_at is not null)
);

create table fin_account_mappings (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  target varchar(15) not null check (target in ('contasis', 'concar', 'siigo', 'quickbooks', 'xero', 'csv')),
  concept varchar(30) not null check (concept in ('venta_gravada', 'venta_exonerada', 'igv', 'cxc', 'caja', 'banco', 'cxp', 'costo_servicio', 'comision', 'diferencia_cambio', 'anticipo', 'vale_regalo')),
  account_code varchar(30) not null,
  cost_center varchar(30),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_account_mappings primary key (id)
);

create table fin_accounting_exports (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  target varchar(15) not null check (target in ('contasis', 'concar', 'siigo', 'quickbooks', 'xero', 'csv')),
  period_from date not null,
  period_to date not null,
  scope text[] not null default '{ventas,cobros,compras}',
  status varchar(10) not null default 'en_cola' check (status in ('en_cola', 'generado', 'enviado', 'fallido')),
  rows_count integer not null default 0,
  file_path text,
  sha256 char(64),
  error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_accounting_exports primary key (id),
  constraint ck_fin_accounting_exports_1 check (period_to >= period_from),
  constraint ck_fin_accounting_exports_2 check (status not in ('generado', 'enviado') or file_path is not null)
);

create table quote_external_offers (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  quote_id uuid not null,
  version_id uuid,
  reservation_id uuid,
  provider varchar(20) not null check (provider in ('amadeus', 'sabre', 'travelport', 'hotelbeds', 'otro')),
  kind varchar(10) not null check (kind in ('aereo', 'hotel', 'auto', 'seguro')),
  offer_ref varchar(160) not null,
  summary varchar(300) not null,
  payload jsonb not null,
  net_amount numeric(14,2) not null check (net_amount >= 0),
  sell_amount numeric(14,2) not null check (sell_amount >= 0),
  currency char(3) not null,
  offer_expires_at timestamptz,
  pnr varchar(20),
  status varchar(12) not null default 'cotizada' check (status in ('cotizada', 'retenida', 'emitida', 'vencida', 'cancelada', 'error')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_quote_external_offers primary key (id),
  constraint ck_quote_external_offers_1 check (status <> 'emitida' or pnr is not null)
);

-- ---------------------------------------------------------------- v2.6 · UNIQUE
create unique index uq_fin_payment_links_tenant_id_code on fin_payment_links (tenant_id, code);
create unique index uq_fin_payment_links_token_hash on fin_payment_links (token_hash);
create unique index uq_collab_whatsapp_templates_account_name_lang on collab_whatsapp_templates (channel_account_id, name, lang);
create unique index uq_mkt_recovery_flows_tenant_id_code on mkt_recovery_flows (tenant_id, code);
create unique index uq_mkt_recovery_attempts_flow_cart_attempt on mkt_recovery_attempts (flow_id, cart_id, attempt_no) where cart_id is not null;
create unique index uq_mkt_recovery_attempts_flow_quote_attempt on mkt_recovery_attempts (flow_id, quote_id, attempt_no) where quote_id is not null;
create unique index uq_catalog_import_jobs_tenant_id_code on catalog_import_jobs (tenant_id, code);
create unique index uq_catalog_dynamic_price_rules_tenant_id_code on catalog_dynamic_price_rules (tenant_id, code);
create unique index uq_channel_ota_connections_tenant_id_code on channel_ota_connections (tenant_id, code);
create unique index uq_channel_ota_product_mappings_conn_product on channel_ota_product_mappings (connection_id, product_id, coalesce(ota_option_ref, ''));
create unique index uq_channel_ota_bookings_conn_ref on channel_ota_bookings (connection_id, ota_booking_ref);
create unique index uq_platform_marketplace_listings_seller_product on platform_marketplace_listings (seller_tenant_id, product_ref);
create unique index uq_platform_marketplace_partnerships_pair on platform_marketplace_partnerships (seller_tenant_id, reseller_tenant_id);
create unique index uq_platform_marketplace_orders_code on platform_marketplace_orders (code);
create unique index uq_platform_marketplace_orders_reseller_idem on platform_marketplace_orders (reseller_tenant_id, idempotency_key);
create unique index uq_fin_gift_cards_tenant_id_code on fin_gift_cards (tenant_id, code);
create unique index uq_fin_gift_cards_tenant_id_redeem_code_hash on fin_gift_cards (tenant_id, redeem_code_hash);
create unique index uq_ops_waiver_templates_tenant_id_code_version on ops_waiver_templates (tenant_id, code, version);
create unique index uq_ops_waiver_signatures_template_res_pax on ops_waiver_signatures (template_id, template_version, reservation_id, passenger_id);
create unique index uq_ops_checkin_passes_token_hash on ops_checkin_passes (token_hash);
create unique index uq_ops_checkin_passes_service_passenger on ops_checkin_passes (service_id, passenger_id) where status <> 'anulado';
create unique index uq_fin_account_mappings_tenant_target_concept on fin_account_mappings (tenant_id, target, concept);
create unique index uq_fin_accounting_exports_tenant_id_code on fin_accounting_exports (tenant_id, code);
create unique index uq_quote_external_offers_tenant_provider_ref on quote_external_offers (tenant_id, provider, offer_ref);

-- ---------------------------------------------------------------- v2.6 · FK (90_rls las convierte en compuestas con tenant_id)
alter table sys_ai_requests add constraint fk_sys_ai_requests_tenant_id foreign key (tenant_id) references tenants (id);
alter table sys_ai_requests add constraint fk_sys_ai_requests_user_id foreign key (user_id) references iam_users (id);
alter table report_ai_insights add constraint fk_report_ai_insights_tenant_id foreign key (tenant_id) references tenants (id);
alter table report_ai_insights add constraint fk_report_ai_insights_audience_user_id foreign key (audience_user_id) references iam_users (id);
alter table report_ai_insights add constraint fk_report_ai_insights_ai_request_id foreign key (ai_request_id) references sys_ai_requests (id);
alter table collab_whatsapp_templates add constraint fk_collab_whatsapp_templates_tenant_id foreign key (tenant_id) references tenants (id);
alter table collab_whatsapp_templates add constraint fk_collab_whatsapp_templates_channel_account_id foreign key (channel_account_id) references collab_channel_accounts (id);
alter table fin_payment_links add constraint fk_fin_payment_links_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_payment_links add constraint fk_fin_payment_links_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table fin_payment_links add constraint fk_fin_payment_links_receivable_id foreign key (receivable_id) references fin_receivables (id);
alter table fin_payment_links add constraint fk_fin_payment_links_gift_card_id foreign key (gift_card_id) references fin_gift_cards (id);
alter table fin_payment_links add constraint fk_fin_payment_links_payment_id foreign key (payment_id) references fin_payments (id);
alter table mkt_recovery_flows add constraint fk_mkt_recovery_flows_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_recovery_attempts add constraint fk_mkt_recovery_attempts_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_recovery_attempts add constraint fk_mkt_recovery_attempts_flow_id foreign key (flow_id) references mkt_recovery_flows (id);
alter table mkt_recovery_attempts add constraint fk_mkt_recovery_attempts_cart_id foreign key (cart_id) references channel_web_carts (id);
alter table mkt_recovery_attempts add constraint fk_mkt_recovery_attempts_quote_id foreign key (quote_id) references quote_quotes (id);
alter table mkt_recovery_attempts add constraint fk_mkt_recovery_attempts_client_id foreign key (client_id) references crm_clients (id);
alter table mkt_recovery_attempts add constraint fk_mkt_recovery_attempts_recovered_reservation_id foreign key (recovered_reservation_id) references booking_reservations (id);
alter table catalog_import_jobs add constraint fk_catalog_import_jobs_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_import_jobs add constraint fk_catalog_import_jobs_ai_request_id foreign key (ai_request_id) references sys_ai_requests (id);
alter table catalog_dynamic_price_rules add constraint fk_catalog_dynamic_price_rules_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_dynamic_price_rules add constraint fk_catalog_dynamic_price_rules_product_id foreign key (product_id) references catalog_products (id);
alter table channel_ota_connections add constraint fk_channel_ota_connections_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_ota_product_mappings add constraint fk_channel_ota_product_mappings_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_ota_product_mappings add constraint fk_channel_ota_product_mappings_connection_id foreign key (connection_id) references channel_ota_connections (id);
alter table channel_ota_product_mappings add constraint fk_channel_ota_product_mappings_product_id foreign key (product_id) references catalog_products (id);
alter table channel_ota_bookings add constraint fk_channel_ota_bookings_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_ota_bookings add constraint fk_channel_ota_bookings_connection_id foreign key (connection_id) references channel_ota_connections (id);
alter table channel_ota_bookings add constraint fk_channel_ota_bookings_mapping_id foreign key (mapping_id) references channel_ota_product_mappings (id);
alter table channel_ota_bookings add constraint fk_channel_ota_bookings_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table platform_marketplace_listings add constraint fk_platform_marketplace_listings_seller_tenant_id foreign key (seller_tenant_id) references tenants (id);
alter table platform_marketplace_partnerships add constraint fk_platform_marketplace_partnerships_seller_tenant_id foreign key (seller_tenant_id) references tenants (id);
alter table platform_marketplace_partnerships add constraint fk_platform_marketplace_partnerships_reseller_tenant_id foreign key (reseller_tenant_id) references tenants (id);
alter table platform_marketplace_orders add constraint fk_platform_marketplace_orders_partnership_id foreign key (partnership_id) references platform_marketplace_partnerships (id);
alter table platform_marketplace_orders add constraint fk_platform_marketplace_orders_listing_id foreign key (listing_id) references platform_marketplace_listings (id);
alter table platform_marketplace_orders add constraint fk_platform_marketplace_orders_seller_tenant_id foreign key (seller_tenant_id) references tenants (id);
alter table platform_marketplace_orders add constraint fk_platform_marketplace_orders_reseller_tenant_id foreign key (reseller_tenant_id) references tenants (id);
alter table fin_gift_cards add constraint fk_fin_gift_cards_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_gift_cards add constraint fk_fin_gift_cards_buyer_client_id foreign key (buyer_client_id) references crm_clients (id);
alter table fin_gift_cards add constraint fk_fin_gift_cards_payment_id foreign key (payment_id) references fin_payments (id);
alter table fin_gift_card_movements add constraint fk_fin_gift_card_movements_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_gift_card_movements add constraint fk_fin_gift_card_movements_gift_card_id foreign key (gift_card_id) references fin_gift_cards (id);
alter table fin_gift_card_movements add constraint fk_fin_gift_card_movements_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table fin_gift_card_movements add constraint fk_fin_gift_card_movements_receivable_id foreign key (receivable_id) references fin_receivables (id);
alter table ops_waiver_templates add constraint fk_ops_waiver_templates_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_waiver_signatures add constraint fk_ops_waiver_signatures_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_waiver_signatures add constraint fk_ops_waiver_signatures_template_id foreign key (template_id) references ops_waiver_templates (id);
alter table ops_waiver_signatures add constraint fk_ops_waiver_signatures_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table ops_waiver_signatures add constraint fk_ops_waiver_signatures_passenger_id foreign key (passenger_id) references booking_passengers (id);
alter table ops_checkin_passes add constraint fk_ops_checkin_passes_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_checkin_passes add constraint fk_ops_checkin_passes_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table ops_checkin_passes add constraint fk_ops_checkin_passes_passenger_id foreign key (passenger_id) references booking_passengers (id);
alter table ops_checkin_passes add constraint fk_ops_checkin_passes_service_id foreign key (service_id) references booking_reservation_services (id);
alter table ops_checkin_passes add constraint fk_ops_checkin_passes_scanned_by foreign key (scanned_by) references iam_users (id);
alter table fin_account_mappings add constraint fk_fin_account_mappings_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_accounting_exports add constraint fk_fin_accounting_exports_tenant_id foreign key (tenant_id) references tenants (id);
alter table quote_external_offers add constraint fk_quote_external_offers_tenant_id foreign key (tenant_id) references tenants (id);
alter table quote_external_offers add constraint fk_quote_external_offers_quote_id foreign key (quote_id) references quote_quotes (id);
alter table quote_external_offers add constraint fk_quote_external_offers_version_id foreign key (version_id) references quote_versions (id);
alter table quote_external_offers add constraint fk_quote_external_offers_reservation_id foreign key (reservation_id) references booking_reservations (id);

-- ---------------------------------------------------------------- v2.6 · índices (toda FK con índice + consultas de la spec 19)
create index ix_sys_ai_requests_tenant_id_kind_created_at_desc on sys_ai_requests (tenant_id, kind, created_at desc);
create index ix_sys_ai_requests_user_id on sys_ai_requests (user_id);
create index ix_sys_ai_requests_source on sys_ai_requests (source_type, source_id);
create index ix_report_ai_insights_tenant_id_status_generated_at_desc on report_ai_insights (tenant_id, status, generated_at desc);
create index ix_report_ai_insights_audience_user_id on report_ai_insights (audience_user_id);
create index ix_report_ai_insights_ai_request_id on report_ai_insights (ai_request_id);
create index ix_collab_whatsapp_templates_tenant_id_status on collab_whatsapp_templates (tenant_id, status);
create index ix_fin_payment_links_tenant_id_status_expires_at on fin_payment_links (tenant_id, status, expires_at);
create index ix_fin_payment_links_reservation_id on fin_payment_links (reservation_id);
create index ix_fin_payment_links_receivable_id on fin_payment_links (receivable_id);
create index ix_fin_payment_links_gift_card_id on fin_payment_links (gift_card_id);
create index ix_fin_payment_links_payment_id on fin_payment_links (payment_id);
create index ix_mkt_recovery_attempts_tenant_id_status_scheduled_at on mkt_recovery_attempts (tenant_id, status, scheduled_at);
create index ix_mkt_recovery_attempts_cart_id on mkt_recovery_attempts (cart_id);
create index ix_mkt_recovery_attempts_quote_id on mkt_recovery_attempts (quote_id);
create index ix_mkt_recovery_attempts_client_id on mkt_recovery_attempts (client_id);
create index ix_mkt_recovery_attempts_recovered_reservation_id on mkt_recovery_attempts (recovered_reservation_id);
create index ix_catalog_import_jobs_tenant_id_status on catalog_import_jobs (tenant_id, status);
create index ix_catalog_import_jobs_ai_request_id on catalog_import_jobs (ai_request_id);
create index ix_catalog_dynamic_price_rules_tenant_id_active_priority on catalog_dynamic_price_rules (tenant_id, active, priority);
create index ix_catalog_dynamic_price_rules_product_id on catalog_dynamic_price_rules (product_id);
create index ix_channel_ota_connections_tenant_id_status on channel_ota_connections (tenant_id, status);
create index ix_channel_ota_product_mappings_product_id on channel_ota_product_mappings (product_id);
create index ix_channel_ota_bookings_tenant_id_status_received_at_desc on channel_ota_bookings (tenant_id, status, received_at desc);
create index ix_channel_ota_bookings_mapping_id on channel_ota_bookings (mapping_id);
create index ix_channel_ota_bookings_reservation_id on channel_ota_bookings (reservation_id);
create index ix_platform_marketplace_listings_status_destination on platform_marketplace_listings (status, destination);
create index ix_platform_marketplace_partnerships_reseller_tenant_id on platform_marketplace_partnerships (reseller_tenant_id);
create index ix_platform_marketplace_orders_partnership_id on platform_marketplace_orders (partnership_id);
create index ix_platform_marketplace_orders_listing_id on platform_marketplace_orders (listing_id);
create index ix_platform_marketplace_orders_seller_tenant_id_status on platform_marketplace_orders (seller_tenant_id, status);
create index ix_fin_gift_cards_tenant_id_status_expires_at on fin_gift_cards (tenant_id, status, expires_at);
create index ix_fin_gift_cards_buyer_client_id on fin_gift_cards (buyer_client_id);
create index ix_fin_gift_cards_payment_id on fin_gift_cards (payment_id);
create index ix_fin_gift_card_movements_gift_card_id_created_at on fin_gift_card_movements (gift_card_id, created_at);
create index ix_fin_gift_card_movements_reservation_id on fin_gift_card_movements (reservation_id);
create index ix_fin_gift_card_movements_receivable_id on fin_gift_card_movements (receivable_id);
create index ix_ops_waiver_signatures_reservation_id on ops_waiver_signatures (reservation_id);
create index ix_ops_waiver_signatures_passenger_id on ops_waiver_signatures (passenger_id);
create index ix_ops_checkin_passes_reservation_id on ops_checkin_passes (reservation_id);
create index ix_ops_checkin_passes_passenger_id on ops_checkin_passes (passenger_id);
create index ix_ops_checkin_passes_scanned_by on ops_checkin_passes (scanned_by);
create index ix_fin_accounting_exports_tenant_id_created_at_desc on fin_accounting_exports (tenant_id, created_at desc);
create index ix_quote_external_offers_quote_id on quote_external_offers (quote_id);
create index ix_quote_external_offers_version_id on quote_external_offers (version_id);
create index ix_quote_external_offers_reservation_id on quote_external_offers (reservation_id);
create index ix_quote_external_offers_tenant_id_status_offer_expires_at on quote_external_offers (tenant_id, status, offer_expires_at);

-- ---------------------------------------------------------------- v2.6 · triggers
create trigger trg_fin_gift_card_movements_append_only before update or delete on fin_gift_card_movements for each row execute function app_forbid_update_delete();
create trigger trg_ops_waiver_signatures_append_only before update or delete on ops_waiver_signatures for each row execute function app_forbid_update_delete();
create trigger trg_sys_ai_requests_updated_at before update on sys_ai_requests for each row execute function app_set_updated_at();
create trigger trg_report_ai_insights_updated_at before update on report_ai_insights for each row execute function app_set_updated_at();
create trigger trg_collab_whatsapp_templates_updated_at before update on collab_whatsapp_templates for each row execute function app_set_updated_at();
create trigger trg_fin_payment_links_updated_at before update on fin_payment_links for each row execute function app_set_updated_at();
create trigger trg_fin_payment_links_lock_version before update on fin_payment_links for each row execute function app_bump_lock_version();
create trigger trg_mkt_recovery_flows_updated_at before update on mkt_recovery_flows for each row execute function app_set_updated_at();
create trigger trg_mkt_recovery_attempts_updated_at before update on mkt_recovery_attempts for each row execute function app_set_updated_at();
create trigger trg_catalog_import_jobs_updated_at before update on catalog_import_jobs for each row execute function app_set_updated_at();
create trigger trg_catalog_dynamic_price_rules_updated_at before update on catalog_dynamic_price_rules for each row execute function app_set_updated_at();
create trigger trg_catalog_dynamic_price_rules_lock_version before update on catalog_dynamic_price_rules for each row execute function app_bump_lock_version();
create trigger trg_channel_ota_connections_updated_at before update on channel_ota_connections for each row execute function app_set_updated_at();
create trigger trg_channel_ota_connections_lock_version before update on channel_ota_connections for each row execute function app_bump_lock_version();
create trigger trg_channel_ota_product_mappings_updated_at before update on channel_ota_product_mappings for each row execute function app_set_updated_at();
create trigger trg_channel_ota_bookings_updated_at before update on channel_ota_bookings for each row execute function app_set_updated_at();
create trigger trg_platform_marketplace_listings_updated_at before update on platform_marketplace_listings for each row execute function app_set_updated_at();
create trigger trg_platform_marketplace_partnerships_updated_at before update on platform_marketplace_partnerships for each row execute function app_set_updated_at();
create trigger trg_platform_marketplace_orders_updated_at before update on platform_marketplace_orders for each row execute function app_set_updated_at();
create trigger trg_fin_gift_cards_updated_at before update on fin_gift_cards for each row execute function app_set_updated_at();
create trigger trg_fin_gift_cards_lock_version before update on fin_gift_cards for each row execute function app_bump_lock_version();
create trigger trg_ops_waiver_templates_updated_at before update on ops_waiver_templates for each row execute function app_set_updated_at();
create trigger trg_ops_checkin_passes_updated_at before update on ops_checkin_passes for each row execute function app_set_updated_at();
create trigger trg_fin_account_mappings_updated_at before update on fin_account_mappings for each row execute function app_set_updated_at();
create trigger trg_fin_accounting_exports_updated_at before update on fin_accounting_exports for each row execute function app_set_updated_at();
create trigger trg_quote_external_offers_updated_at before update on quote_external_offers for each row execute function app_set_updated_at();

-- ---------------------------------------------------------------- v2.6 · comentarios
comment on table sys_ai_requests is '[Spec 19 §3.1] [Fase 3] Pedidos al asistente de IA (itinerario, borrador de cotización o respuesta, resumen, importación, insight): entrada, salida, tokens y costo; base del cupo mensual por plan.';
comment on table report_ai_insights is '[Spec 19 §3.13] [Fase 3] Alertas de rentabilidad generadas por IA (margen bajo, proveedor caro, meta en riesgo, cobranza).';
comment on table collab_whatsapp_templates is '[Spec 19 §3.2] [Fase 3] Plantillas de WhatsApp Business aprobadas por Meta por cuenta de canal.';
comment on table fin_payment_links is '[Spec 19 §3.3] [Fase 3] Links de pago con medios locales (Yape, Plin, Mercado Pago, cuotas) para reserva, CxC o vale de regalo.';
comment on table mkt_recovery_flows is '[Spec 19 §3.4] [Fase 3] Flujos de recuperación de carritos y cotizaciones abandonadas.';
comment on table mkt_recovery_attempts is '[Spec 19 §3.4] [Fase 3] Intentos de recuperación programados y su resultado.';
comment on table catalog_import_jobs is '[Spec 19 §3.5] [Fase 3] Importación de productos desde una web, PDF o planilla con IA; revisión humana antes de crear.';
comment on table catalog_dynamic_price_rules is '[Spec 19 §3.8] [Fase 3] Ajustes de precio dinámicos por ocupación, anticipación, día, temporada o demanda (regla R-DYNAMIC-PRICING).';
comment on table channel_ota_connections is '[Spec 19 §3.6] [Fase 3] Conexiones del tenant con OTAs (Viator, GetYourGuide, Expedia, Google Things to Do).';
comment on table channel_ota_product_mappings is '[Spec 19 §3.6] [Fase 3] Producto del catálogo ↔ producto/opción de la OTA y su modo de precio.';
comment on table channel_ota_bookings is '[Spec 19 §3.6] [Fase 3] Reservas recibidas de OTAs (idempotentes por referencia de la OTA).';
comment on table platform_marketplace_listings is '[Spec 19 §3.7] [Fase 3] Productos publicados por un tenant en el marketplace B2B (tabla de plataforma).';
comment on table platform_marketplace_partnerships is '[Spec 19 §3.7] [Fase 3] Alianzas vendedor ↔ revendedor con comisión y tarifa de plataforma.';
comment on table platform_marketplace_orders is '[Spec 19 §3.7] [Fase 3] Ventas entre tenants por el marketplace; crean la reserva en el vendedor y en el revendedor.';
comment on table fin_gift_cards is '[Spec 19 §3.9] [Fase 3] Vales y tarjetas de regalo con saldo (código de canje con hash).';
comment on table fin_gift_card_movements is '[Spec 19 §3.9] [Fase 3] Movimientos del vale (append-only).';
comment on table ops_waiver_templates is '[Spec 19 §3.10] [Fase 3] Textos de deslinde de responsabilidad versionados.';
comment on table ops_waiver_signatures is '[Spec 19 §3.10] [Fase 3] Firmas del deslinde por pasajero (append-only, con hash del texto firmado).';
comment on table ops_checkin_passes is '[Spec 19 §3.10] [Fase 3] Pases QR de check-in por pasajero y servicio.';
comment on table fin_account_mappings is '[Spec 19 §3.11] [Fase 3] Plan de cuentas del tenant por sistema contable de destino.';
comment on table fin_accounting_exports is '[Spec 19 §3.11] [Fase 3] Exportaciones contables por período.';
comment on table quote_external_offers is '[Spec 19 §3.12] [Fase 3] Ofertas de aéreo, hotel, auto o seguro tomadas de un GDS o banco de camas para una cotización.';

-- ================================================================ v2.7 · Portal corporativo (spec 20)
-- Cuenta corporativa de la empresa cliente: centros de costo, viajeros, usuarios del portal con rol, aprobaciones,
-- asignación de costos por reserva, estados de cuenta mensuales y exportaciones de reportes.

create table crm_corporate_accounts (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  client_id uuid not null,
  status varchar(12) not null default 'activa' check (status in ('activa', 'suspendida', 'cerrada')),
  currency char(3) not null default 'PEN' check (currency ~ '^[A-Z]{3}$'),
  credit_days smallint not null default 0 check (credit_days between 0 and 120),
  require_approval boolean not null default false,
  approval_threshold numeric(14,2) check (approval_threshold is null or approval_threshold >= 0),
  approval_ttl_hours smallint not null default 72 check (approval_ttl_hours between 1 and 720),
  default_cost_center_id uuid,
  statement_auto boolean not null default false,
  statement_day smallint not null default 1 check (statement_day between 1 and 28),
  statement_recipients text[] not null default '{}',
  statement_last_sent_at timestamptz,
  notes text,
  lock_version integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_corporate_accounts primary key (id),
  constraint ck_crm_corporate_accounts_1 check (not require_approval or approval_threshold is not null),
  constraint ck_crm_corporate_accounts_2 check (not statement_auto or cardinality(statement_recipients) > 0)
);

create table crm_corporate_cost_centers (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  account_id uuid not null,
  code varchar(20) not null check (code ~ '^[A-Z0-9-]{2,20}$'),
  name varchar(120) not null,
  budget_amount numeric(14,2) check (budget_amount is null or budget_amount >= 0),
  budget_period varchar(12) not null default 'anual' check (budget_period in ('mensual', 'trimestral', 'anual')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_corporate_cost_centers primary key (id)
);

create table crm_corporate_travelers (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  account_id uuid not null,
  cost_center_id uuid,
  full_name varchar(160) not null,
  email varchar(160),
  doc_type varchar(10) check (doc_type is null or doc_type in ('DNI', 'CE', 'PAS', 'RUC', 'OTRO')),
  doc_number varchar(20),
  employee_code varchar(30),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_corporate_travelers primary key (id),
  constraint ck_crm_corporate_travelers_1 check ((doc_type is null) = (doc_number is null))
);

create table crm_corporate_portal_users (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  account_id uuid not null,
  user_id uuid,
  email varchar(160) not null,
  full_name varchar(160) not null,
  portal_role varchar(15) not null check (portal_role in ('administrador', 'aprobador', 'pagador', 'viajero')),
  cost_center_id uuid,
  traveler_id uuid,
  status varchar(10) not null default 'invitado' check (status in ('invitado', 'activo', 'inactivo')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_corporate_portal_users primary key (id),
  constraint ck_crm_corporate_portal_users_1 check (portal_role <> 'aprobador' or cost_center_id is not null),
  constraint ck_crm_corporate_portal_users_2 check (status <> 'activo' or (user_id is not null and accepted_at is not null))
);

create table booking_corporate_approvals (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  account_id uuid not null,
  quote_id uuid,
  reservation_id uuid,
  cost_center_id uuid not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  requested_by_portal_user_id uuid,
  requested_by_user_id uuid,
  approver_portal_user_id uuid,
  status varchar(10) not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada', 'vencida', 'cancelada')),
  reason text,
  expires_at timestamptz not null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lock_version integer not null default 0,
  constraint pk_booking_corporate_approvals primary key (id),
  constraint ck_booking_corporate_approvals_1 check (num_nonnulls(quote_id, reservation_id) = 1),
  constraint ck_booking_corporate_approvals_2 check (status not in ('aprobada', 'rechazada') or (decided_at is not null and approver_portal_user_id is not null)),
  constraint ck_booking_corporate_approvals_3 check (status <> 'rechazada' or coalesce(btrim(reason), '') <> '')
);

create table booking_cost_allocations (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  account_id uuid not null,
  cost_center_id uuid not null,
  traveler_id uuid,
  pct numeric(5,2) not null check (pct > 0 and pct <= 100),
  amount numeric(14,2) not null check (amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_booking_cost_allocations primary key (id)
);

create table fin_corporate_statements (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  account_id uuid not null,
  period_start date not null,
  period_end date not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  opening_balance numeric(14,2) not null,
  charges numeric(14,2) not null default 0 check (charges >= 0),
  payments numeric(14,2) not null default 0 check (payments >= 0),
  credits numeric(14,2) not null default 0 check (credits >= 0),
  closing_balance numeric(14,2) not null,
  lines jsonb not null default '[]',
  status varchar(10) not null default 'generado' check (status in ('generado', 'enviado', 'anulado')),
  document_id uuid,
  generated_by uuid,
  generated_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_to text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_corporate_statements primary key (id),
  constraint ck_fin_corporate_statements_1 check (period_end >= period_start),
  constraint ck_fin_corporate_statements_2 check (closing_balance = opening_balance + charges - payments - credits),
  constraint ck_fin_corporate_statements_3 check (status <> 'enviado' or (sent_at is not null and cardinality(sent_to) > 0))
);

create table report_corporate_exports (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  account_id uuid not null,
  requested_by_portal_user_id uuid,
  requested_by_user_id uuid,
  report_type varchar(20) not null check (report_type in ('compras', 'movimientos', 'centro_costo', 'viajeros', 'estado_cuenta', 'aprobaciones')),
  filters jsonb not null default '{}',
  format varchar(5) not null check (format in ('xlsx', 'pdf', 'csv')),
  status varchar(12) not null default 'en_cola' check (status in ('en_cola', 'procesando', 'listo', 'fallido', 'vencido')),
  row_count integer check (row_count is null or row_count >= 0),
  document_id uuid,
  error text,
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_report_corporate_exports primary key (id),
  constraint ck_report_corporate_exports_1 check (num_nonnulls(requested_by_portal_user_id, requested_by_user_id) >= 1),
  constraint ck_report_corporate_exports_2 check (status <> 'listo' or (document_id is not null and completed_at is not null))
);

-- ---------------------------------------------------------------- v2.7 · índices únicos
create unique index uq_crm_corporate_accounts_tenant_id_client_id on crm_corporate_accounts (tenant_id, client_id);
create unique index uq_crm_corporate_cost_centers_account_id_code on crm_corporate_cost_centers (tenant_id, account_id, code);
create unique index uq_crm_corporate_travelers_account_id_doc on crm_corporate_travelers (tenant_id, account_id, doc_type, doc_number) where doc_number is not null;
create unique index uq_crm_corporate_travelers_account_id_employee_code on crm_corporate_travelers (tenant_id, account_id, employee_code) where employee_code is not null;
create unique index uq_crm_corporate_portal_users_account_id_email on crm_corporate_portal_users (tenant_id, account_id, lower(email));
create unique index uq_crm_corporate_portal_users_account_id_user_id on crm_corporate_portal_users (tenant_id, account_id, user_id) where user_id is not null;
create unique index uq_booking_corporate_approvals_tenant_id_code on booking_corporate_approvals (tenant_id, code);
create unique index uq_booking_corporate_approvals_pending_quote on booking_corporate_approvals (tenant_id, quote_id) where status = 'pendiente' and quote_id is not null;
create unique index uq_booking_corporate_approvals_pending_reservation on booking_corporate_approvals (tenant_id, reservation_id) where status = 'pendiente' and reservation_id is not null;
create unique index uq_booking_cost_allocations_res_cc_traveler on booking_cost_allocations (tenant_id, reservation_id, cost_center_id, coalesce(traveler_id, '00000000-0000-0000-0000-000000000000'::uuid));
create unique index uq_fin_corporate_statements_tenant_id_code on fin_corporate_statements (tenant_id, code);
create unique index uq_fin_corporate_statements_account_period on fin_corporate_statements (tenant_id, account_id, period_start, currency) where status <> 'anulado';
create unique index uq_report_corporate_exports_tenant_id_code on report_corporate_exports (tenant_id, code);

-- ---------------------------------------------------------------- v2.7 · claves foráneas
alter table crm_corporate_accounts add constraint fk_crm_corporate_accounts_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_corporate_accounts add constraint fk_crm_corporate_accounts_client_id foreign key (client_id) references crm_clients (id);
alter table crm_corporate_accounts add constraint fk_crm_corporate_accounts_default_cost_center_id foreign key (default_cost_center_id) references crm_corporate_cost_centers (id);
alter table crm_corporate_accounts add constraint fk_crm_corporate_accounts_created_by foreign key (created_by) references iam_users (id);
alter table crm_corporate_cost_centers add constraint fk_crm_corporate_cost_centers_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_corporate_cost_centers add constraint fk_crm_corporate_cost_centers_account_id foreign key (account_id) references crm_corporate_accounts (id) on delete cascade;
alter table crm_corporate_travelers add constraint fk_crm_corporate_travelers_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_corporate_travelers add constraint fk_crm_corporate_travelers_account_id foreign key (account_id) references crm_corporate_accounts (id) on delete cascade;
alter table crm_corporate_travelers add constraint fk_crm_corporate_travelers_cost_center_id foreign key (cost_center_id) references crm_corporate_cost_centers (id);
alter table crm_corporate_portal_users add constraint fk_crm_corporate_portal_users_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_corporate_portal_users add constraint fk_crm_corporate_portal_users_account_id foreign key (account_id) references crm_corporate_accounts (id) on delete cascade;
alter table crm_corporate_portal_users add constraint fk_crm_corporate_portal_users_user_id foreign key (user_id) references iam_users (id);
alter table crm_corporate_portal_users add constraint fk_crm_corporate_portal_users_cost_center_id foreign key (cost_center_id) references crm_corporate_cost_centers (id);
alter table crm_corporate_portal_users add constraint fk_crm_corporate_portal_users_traveler_id foreign key (traveler_id) references crm_corporate_travelers (id);
alter table booking_corporate_approvals add constraint fk_booking_corporate_approvals_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_corporate_approvals add constraint fk_booking_corporate_approvals_account_id foreign key (account_id) references crm_corporate_accounts (id);
alter table booking_corporate_approvals add constraint fk_booking_corporate_approvals_quote_id foreign key (quote_id) references quote_quotes (id);
alter table booking_corporate_approvals add constraint fk_booking_corporate_approvals_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table booking_corporate_approvals add constraint fk_booking_corporate_approvals_cost_center_id foreign key (cost_center_id) references crm_corporate_cost_centers (id);
alter table booking_corporate_approvals add constraint fk_booking_corporate_approvals_requested_by_portal_user_id foreign key (requested_by_portal_user_id) references crm_corporate_portal_users (id);
alter table booking_corporate_approvals add constraint fk_booking_corporate_approvals_requested_by_user_id foreign key (requested_by_user_id) references iam_users (id);
alter table booking_corporate_approvals add constraint fk_booking_corporate_approvals_approver_portal_user_id foreign key (approver_portal_user_id) references crm_corporate_portal_users (id);
alter table booking_cost_allocations add constraint fk_booking_cost_allocations_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_cost_allocations add constraint fk_booking_cost_allocations_reservation_id foreign key (reservation_id) references booking_reservations (id) on delete cascade;
alter table booking_cost_allocations add constraint fk_booking_cost_allocations_account_id foreign key (account_id) references crm_corporate_accounts (id);
alter table booking_cost_allocations add constraint fk_booking_cost_allocations_cost_center_id foreign key (cost_center_id) references crm_corporate_cost_centers (id);
alter table booking_cost_allocations add constraint fk_booking_cost_allocations_traveler_id foreign key (traveler_id) references crm_corporate_travelers (id);
alter table booking_cost_allocations add constraint fk_booking_cost_allocations_created_by foreign key (created_by) references iam_users (id);
alter table fin_corporate_statements add constraint fk_fin_corporate_statements_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_corporate_statements add constraint fk_fin_corporate_statements_account_id foreign key (account_id) references crm_corporate_accounts (id);
alter table fin_corporate_statements add constraint fk_fin_corporate_statements_document_id foreign key (document_id) references sys_documents (id);
alter table fin_corporate_statements add constraint fk_fin_corporate_statements_generated_by foreign key (generated_by) references iam_users (id);
alter table report_corporate_exports add constraint fk_report_corporate_exports_tenant_id foreign key (tenant_id) references tenants (id);
alter table report_corporate_exports add constraint fk_report_corporate_exports_account_id foreign key (account_id) references crm_corporate_accounts (id);
alter table report_corporate_exports add constraint fk_report_corporate_exports_requested_by_portal_user_id foreign key (requested_by_portal_user_id) references crm_corporate_portal_users (id);
alter table report_corporate_exports add constraint fk_report_corporate_exports_requested_by_user_id foreign key (requested_by_user_id) references iam_users (id);
alter table report_corporate_exports add constraint fk_report_corporate_exports_document_id foreign key (document_id) references sys_documents (id);

-- ---------------------------------------------------------------- v2.7 · índices
create index ix_crm_corporate_accounts_client_id on crm_corporate_accounts (client_id);
create index ix_crm_corporate_accounts_default_cost_center_id on crm_corporate_accounts (default_cost_center_id);
create index ix_crm_corporate_accounts_created_by on crm_corporate_accounts (created_by);
create index ix_crm_corporate_accounts_tenant_id_statement on crm_corporate_accounts (tenant_id, statement_day) where statement_auto;
create index ix_crm_corporate_cost_centers_account_id on crm_corporate_cost_centers (account_id);
create index ix_crm_corporate_travelers_account_id on crm_corporate_travelers (account_id);
create index ix_crm_corporate_travelers_cost_center_id on crm_corporate_travelers (cost_center_id);
create index ix_crm_corporate_portal_users_account_id on crm_corporate_portal_users (account_id);
create index ix_crm_corporate_portal_users_user_id on crm_corporate_portal_users (user_id);
create index ix_crm_corporate_portal_users_cost_center_id on crm_corporate_portal_users (cost_center_id);
create index ix_crm_corporate_portal_users_traveler_id on crm_corporate_portal_users (traveler_id);
create index ix_booking_corporate_approvals_account_id_status on booking_corporate_approvals (tenant_id, account_id, status, expires_at);
create index ix_booking_corporate_approvals_quote_id on booking_corporate_approvals (quote_id);
create index ix_booking_corporate_approvals_reservation_id on booking_corporate_approvals (reservation_id);
create index ix_booking_corporate_approvals_cost_center_id on booking_corporate_approvals (cost_center_id);
create index ix_booking_corporate_approvals_requested_by_portal_user_id on booking_corporate_approvals (requested_by_portal_user_id);
create index ix_booking_corporate_approvals_requested_by_user_id on booking_corporate_approvals (requested_by_user_id);
create index ix_booking_corporate_approvals_approver_portal_user_id on booking_corporate_approvals (approver_portal_user_id);
create index ix_booking_cost_allocations_reservation_id on booking_cost_allocations (reservation_id);
create index ix_booking_cost_allocations_account_id on booking_cost_allocations (account_id);
create index ix_booking_cost_allocations_cost_center_id on booking_cost_allocations (cost_center_id);
create index ix_booking_cost_allocations_traveler_id on booking_cost_allocations (traveler_id);
create index ix_booking_cost_allocations_created_by on booking_cost_allocations (created_by);
create index ix_fin_corporate_statements_account_id on fin_corporate_statements (account_id, period_start desc);
create index ix_fin_corporate_statements_document_id on fin_corporate_statements (document_id);
create index ix_fin_corporate_statements_generated_by on fin_corporate_statements (generated_by);
create index ix_report_corporate_exports_account_id on report_corporate_exports (account_id, created_at desc);
create index ix_report_corporate_exports_requested_by_portal_user_id on report_corporate_exports (requested_by_portal_user_id);
create index ix_report_corporate_exports_requested_by_user_id on report_corporate_exports (requested_by_user_id);
create index ix_report_corporate_exports_document_id on report_corporate_exports (document_id);
create index ix_report_corporate_exports_status on report_corporate_exports (tenant_id, status, expires_at);

-- ---------------------------------------------------------------- v2.7 · triggers
create trigger trg_crm_corporate_accounts_updated_at before update on crm_corporate_accounts for each row execute function app_set_updated_at();
create trigger trg_crm_corporate_accounts_lock_version before update on crm_corporate_accounts for each row execute function app_bump_lock_version();
create trigger trg_crm_corporate_cost_centers_updated_at before update on crm_corporate_cost_centers for each row execute function app_set_updated_at();
create trigger trg_crm_corporate_travelers_updated_at before update on crm_corporate_travelers for each row execute function app_set_updated_at();
create trigger trg_crm_corporate_portal_users_updated_at before update on crm_corporate_portal_users for each row execute function app_set_updated_at();
create trigger trg_booking_corporate_approvals_updated_at before update on booking_corporate_approvals for each row execute function app_set_updated_at();
create trigger trg_booking_corporate_approvals_lock_version before update on booking_corporate_approvals for each row execute function app_bump_lock_version();
create trigger trg_booking_cost_allocations_updated_at before update on booking_cost_allocations for each row execute function app_set_updated_at();
create trigger trg_fin_corporate_statements_updated_at before update on fin_corporate_statements for each row execute function app_set_updated_at();
create trigger trg_report_corporate_exports_updated_at before update on report_corporate_exports for each row execute function app_set_updated_at();

-- ---------------------------------------------------------------- v2.7 · comentarios
comment on table crm_corporate_accounts is '[Spec 20 §3.1] [Fase 3] Cuenta corporativa de una empresa cliente: crédito, aprobación previa y envío automático del estado de cuenta.';
comment on table crm_corporate_cost_centers is '[Spec 20 §3.2] [Fase 3] Centros de costo de la empresa cliente con presupuesto por período.';
comment on table crm_corporate_travelers is '[Spec 20 §3.3] [Fase 3] Empleados que viajan por cuenta de la empresa cliente.';
comment on table crm_corporate_portal_users is '[Spec 20 §3.4] [Fase 3] Usuarios del portal corporativo con su rol (administrador, aprobador, pagador, viajero).';
comment on table booking_corporate_approvals is '[Spec 20 §3.5] [Fase 3] Aprobación de la empresa cliente para una cotización o reserva que supera el umbral.';
comment on table booking_cost_allocations is '[Spec 20 §3.6] [Fase 3] Reparto del importe de una reserva corporativa por centro de costo y viajero.';
comment on table fin_corporate_statements is '[Spec 20 §3.7] [Fase 3] Estados de cuenta mensuales de la empresa cliente (saldo inicial, compras, pagos, notas de crédito y saldo final).';
comment on table report_corporate_exports is '[Spec 20 §3.8] [Fase 3] Exportaciones de reportes del portal corporativo en Excel, PDF o CSV.';

-- ================================================================ v2.8 · Viajes por tramos (spec 21)
-- Noches por ciudad con mínimo y máximo, tarifas de hotel por temporada, tours y movilidad por tramo,
-- detalle del viaje armado en la reserva y venta en ruta de lo que falta.

alter table catalog_accommodation_legs add column min_nights smallint;
alter table catalog_accommodation_legs add column max_nights smallint;
alter table catalog_accommodation_legs add constraint ck_catalog_accommodation_legs_nights_range
  check ((min_nights is null and max_nights is null) or (min_nights between 1 and 30 and max_nights between min_nights and 30 and nights between min_nights and max_nights));

create table catalog_hotel_season_rates (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  hotel_id uuid not null,
  label varchar(60) not null,
  date_from date not null,
  date_to date not null,
  adjust_pct numeric(6,2) not null check (adjust_pct between -50 and 300),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_hotel_season_rates primary key (id),
  constraint ck_catalog_hotel_season_rates_1 check (date_to >= date_from),
  constraint ex_catalog_hotel_season_rates_overlap exclude using gist (tenant_id with =, hotel_id with =, daterange(date_from, date_to, '[]') with &&)
);

create table catalog_leg_tours (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  leg_id uuid not null,
  code varchar(20) not null,
  name varchar(160) not null,
  day_offset smallint not null default 0 check (day_offset between 0 and 30),
  start_time time not null,
  duration_hours numeric(4,1) not null check (duration_hours > 0 and duration_hours <= 24),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  price_adult numeric(14,2) not null check (price_adult >= 0),
  price_child numeric(14,2) not null default 0 check (price_child >= 0),
  min_age smallint check (min_age is null or min_age between 0 and 99),
  capacity smallint check (capacity is null or capacity > 0),
  provider_id uuid,
  in_trip_sale boolean not null default true,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_leg_tours primary key (id)
);

create table catalog_transport_options (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  code varchar(20) not null,
  from_leg_id uuid not null,
  to_leg_id uuid,
  mode varchar(12) not null check (mode in ('vuelo', 'bus', 'tren', 'traslado', 'movilidad')),
  name varchar(160) not null,
  pricing varchar(10) not null check (pricing in ('pax', 'vehiculo')),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  price_adult numeric(14,2) check (price_adult is null or price_adult >= 0),
  price_child numeric(14,2) check (price_child is null or price_child >= 0),
  duration_hours numeric(4,1) check (duration_hours is null or duration_hours > 0),
  provider_id uuid,
  in_trip_sale boolean not null default true,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_transport_options primary key (id),
  constraint ck_catalog_transport_options_1 check (to_leg_id is null or to_leg_id <> from_leg_id),
  constraint ck_catalog_transport_options_2 check ((pricing = 'pax') = (price_adult is not null))
);

create table catalog_transport_vehicles (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  option_id uuid not null,
  name varchar(60) not null,
  max_pax smallint not null check (max_pax between 1 and 60),
  price numeric(14,2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_transport_vehicles primary key (id)
);

create table booking_trip_legs (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  leg_id uuid not null,
  sequence smallint not null check (sequence >= 1),
  city varchar(80) not null,
  nights smallint not null check (nights between 1 and 30),
  check_in date not null,
  check_out date not null,
  created_at timestamptz not null default now(),
  constraint pk_booking_trip_legs primary key (id),
  constraint ck_booking_trip_legs_1 check (check_out = check_in + nights)
);

create table booking_trip_items (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  trip_leg_id uuid,
  kind varchar(10) not null check (kind in ('tour', 'transporte')),
  leg_tour_id uuid,
  transport_option_id uuid,
  vehicle_id uuid,
  vehicle_units smallint check (vehicle_units is null or vehicle_units between 1 and 20),
  service_date date not null,
  start_time time,
  adults smallint not null default 0 check (adults >= 0),
  children smallint not null default 0 check (children >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  amount numeric(14,2) not null check (amount >= 0),
  reservation_service_id uuid,
  sold_in_trip boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_booking_trip_items primary key (id),
  constraint ck_booking_trip_items_1 check ((kind = 'tour' and leg_tour_id is not null and transport_option_id is null) or (kind = 'transporte' and transport_option_id is not null and leg_tour_id is null)),
  constraint ck_booking_trip_items_2 check ((vehicle_id is null) = (vehicle_units is null)),
  constraint ck_booking_trip_items_3 check (adults + children > 0)
);

create table booking_in_trip_offers (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  reservation_id uuid not null,
  kind varchar(10) not null check (kind in ('tour', 'transporte')),
  leg_tour_id uuid,
  transport_option_id uuid,
  service_date date not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  amount numeric(14,2) not null check (amount > 0),
  status varchar(14) not null default 'ofrecida' check (status in ('ofrecida', 'link_enviado', 'pagada', 'confirmada', 'vencida', 'cancelada', 'reembolsada')),
  payment_link_id uuid,
  trip_item_id uuid,
  expires_at timestamptz not null,
  channel varchar(12) not null default 'portal' check (channel in ('portal', 'whatsapp', 'email', 'app', 'asesor')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_booking_in_trip_offers primary key (id),
  constraint ck_booking_in_trip_offers_1 check ((kind = 'tour') = (leg_tour_id is not null) and (kind = 'transporte') = (transport_option_id is not null)),
  constraint ck_booking_in_trip_offers_2 check (status not in ('pagada', 'confirmada') or payment_link_id is not null),
  constraint ck_booking_in_trip_offers_3 check (status <> 'confirmada' or trip_item_id is not null)
);

-- ================================================================ v2.8 · Pasarelas, dominio propio, SEO y aventuras (spec 22, tenant)

create table fin_gateway_accounts (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  provider varchar(16) not null check (provider in ('pasarela_local', 'paypal', 'yape', 'plin', 'otro')),
  label varchar(80) not null,
  status varchar(12) not null default 'pendiente' check (status in ('pendiente', 'activa', 'pausada', 'error')),
  mode varchar(10) not null default 'sandbox' check (mode in ('sandbox', 'produccion')),
  account_ref varchar(120) not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  fee_pct numeric(5,2) not null default 0 check (fee_pct between 0 and 15),
  fee_fixed numeric(10,2) not null default 0 check (fee_fixed >= 0),
  fee_currency char(3) not null check (fee_currency ~ '^[A-Z]{3}$'),
  fx_spread_pct numeric(5,2) not null default 0 check (fx_spread_pct between 0 and 10),
  tax_on_fee boolean not null default false,
  settle_days smallint not null default 0 check (settle_days between 0 and 60),
  pass_fee_to_customer boolean not null default false,
  credentials_ref varchar(120),
  addon_required varchar(40),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_gateway_accounts primary key (id),
  constraint ck_fin_gateway_accounts_1 check (status <> 'activa' or mode = 'sandbox' or credentials_ref is not null)
);

create table fin_payment_fees (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  payment_id uuid not null,
  gateway_account_id uuid not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  gross numeric(14,2) not null check (gross > 0),
  fee numeric(14,2) not null default 0 check (fee >= 0),
  fee_tax numeric(14,2) not null default 0 check (fee_tax >= 0),
  fx_spread numeric(14,2) not null default 0 check (fx_spread >= 0),
  net numeric(14,2) not null,
  status varchar(10) not null default 'estimado' check (status in ('estimado', 'liquidado', 'ajustado')),
  external_ref varchar(80),
  settled_on date,
  passed_to_customer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_payment_fees primary key (id),
  constraint ck_fin_payment_fees_1 check (net = gross - fee - fee_tax - fx_spread),
  constraint ck_fin_payment_fees_2 check (status <> 'liquidado' or settled_on is not null)
);

create table cms_site_domains (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  host varchar(253) not null check (host ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  purpose varchar(12) not null default 'principal' check (purpose in ('principal', 'reservas', 'blog', 'aventuras', 'portal')),
  status varchar(14) not null default 'pendiente_dns' check (status in ('pendiente_dns', 'verificado', 'error', 'retirado')),
  verify_token varchar(40) not null,
  ssl_status varchar(10) not null default 'pendiente' check (ssl_status in ('pendiente', 'emitido', 'renovando', 'error')),
  ssl_expires_at timestamptz,
  verified_at timestamptz,
  last_check_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_cms_site_domains primary key (id),
  constraint ck_cms_site_domains_1 check (status <> 'verificado' or verified_at is not null),
  constraint ck_cms_site_domains_2 check (ssl_status <> 'emitido' or ssl_expires_at is not null)
);

create table cms_seo_pages (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  path varchar(300) not null check (path ~ '^/'),
  title varchar(120) not null,
  meta_description varchar(320),
  focus_keyword varchar(120),
  schema_types text[] not null default '{}',
  canonical_url varchar(400),
  indexable boolean not null default true,
  h1_count smallint not null default 0 check (h1_count >= 0),
  word_count integer not null default 0 check (word_count >= 0),
  images smallint not null default 0 check (images >= 0),
  images_with_alt smallint not null default 0 check (images_with_alt >= 0),
  speed_mobile smallint check (speed_mobile is null or speed_mobile between 0 and 100),
  score smallint check (score is null or score between 0 and 100),
  issues jsonb not null default '[]',
  clicks_28d integer not null default 0 check (clicks_28d >= 0),
  avg_position numeric(5,1),
  audited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_cms_seo_pages primary key (id),
  constraint ck_cms_seo_pages_1 check (images_with_alt <= images)
);

create table cms_redirects (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  from_path varchar(300) not null check (from_path ~ '^/'),
  to_path varchar(400) not null,
  code smallint not null default 301 check (code in (301, 302)),
  hits bigint not null default 0 check (hits >= 0),
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_cms_redirects primary key (id),
  constraint ck_cms_redirects_1 check (from_path <> to_path)
);

create table cms_travel_stories (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  slug varchar(160) not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title varchar(200) not null,
  client_id uuid not null,
  reservation_id uuid,
  product_id uuid,
  city varchar(80),
  quote text,
  body text,
  photo_count smallint not null default 0 check (photo_count >= 0),
  status varchar(24) not null default 'borrador' check (status in ('borrador', 'pendiente_consentimiento', 'publicado', 'despublicado')),
  consent_at timestamptz,
  consent_by_name varchar(160),
  consent_channel varchar(20) check (consent_channel is null or consent_channel in ('portal', 'correo_firmado', 'whatsapp', 'presencial')),
  consent_photos boolean,
  consent_name_mode varchar(16) check (consent_name_mode is null or consent_name_mode in ('nombre_completo', 'solo_nombre', 'anonimo')),
  consent_revoked_at timestamptz,
  published_at timestamptz,
  seo_score smallint check (seo_score is null or seo_score between 0 and 100),
  views integer not null default 0 check (views >= 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_cms_travel_stories primary key (id),
  constraint ck_cms_travel_stories_1 check ((consent_at is null) = (consent_by_name is null) and (consent_at is null) = (consent_channel is null) and (consent_at is null) = (consent_name_mode is null)),
  constraint ck_cms_travel_stories_2 check (status <> 'publicado' or (consent_at is not null and consent_revoked_at is null and published_at is not null)),
  constraint ck_cms_travel_stories_3 check (photo_count = 0 or status <> 'publicado' or consent_photos)
);

-- ================================================================ v2.8 · Vitrina, pases y add-ons (spec 22, plataforma)
-- Tablas de la PLATAFORMA (sin tenant_id): el tenant no las lee ni escribe; usa /api/v1/showcase/* que filtra por su perfil.

alter table addons add column billing_mode varchar(8) not null default 'mensual' check (billing_mode in ('mensual', 'unico', 'ambos'));
alter table addons add column price_once numeric(14,2) check (price_once is null or price_once >= 0);
alter table addons add constraint ck_addons_billing_prices check ((billing_mode = 'mensual' or price_once is not null) and (billing_mode = 'unico' or price_month is not null));
alter table subscription_items add column billing_mode varchar(8) not null default 'mensual' check (billing_mode in ('mensual', 'unico'));
alter table subscription_items add column paid_once_at timestamptz;
alter table subscription_items add constraint ck_subscription_items_once check (billing_mode = 'mensual' or ends_at is null);

create table platform_access_passes (
  id uuid not null default app_uuid_v7(),
  code varchar(20) not null,
  tenant_id uuid not null,
  name varchar(80) not null default 'Pase Básico 30 días',
  starts_on date not null,
  ends_on date not null,
  price numeric(14,2) not null default 0 check (price >= 0),
  currency char(3) not null default 'PEN' check (currency ~ '^[A-Z]{3}$'),
  features text[] not null check (cardinality(features) > 0),
  reason varchar(200) not null,
  status varchar(10) not null default 'activo' check (status in ('activo', 'vencido', 'convertido', 'revocado')),
  convert_to_plan_id uuid,
  source varchar(12) not null default 'consola' check (source in ('consola', 'vitrina', 'ventas')),
  invoice_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_access_passes primary key (id),
  constraint ck_platform_access_passes_1 check (ends_on > starts_on and ends_on - starts_on <= 60),
  constraint ck_platform_access_passes_2 check (price = 0 or invoice_id is not null or status = 'revocado')
);

create table platform_showcase_agencies (
  id uuid not null default app_uuid_v7(),
  code varchar(12) not null,
  tenant_id uuid,
  name varchar(160) not null,
  slug varchar(120) not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  city varchar(40) not null,
  ruc char(11) check (ruc is null or ruc ~ '^(10|20)[0-9]{9}$'),
  email varchar(160) not null,
  phone varchar(30),
  license_ref varchar(60),
  status varchar(12) not null default 'en_revision' check (status in ('en_revision', 'activa', 'suspendida', 'rechazada')),
  verified_at timestamptz,
  rating numeric(2,1) check (rating is null or rating between 1 and 5),
  reviews integer not null default 0 check (reviews >= 0),
  marketing_opt_in boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_showcase_agencies primary key (id),
  constraint ck_platform_showcase_agencies_1 check (status <> 'activa' or verified_at is not null)
);

create table platform_showcase_listings (
  id uuid not null default app_uuid_v7(),
  code varchar(12) not null,
  agency_id uuid not null,
  slug varchar(160) not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title varchar(160) not null,
  city varchar(40) not null,
  zone varchar(80),
  theme varchar(40),
  languages text[] not null default '{es}' check (cardinality(languages) > 0),
  start_times text[] not null check (cardinality(start_times) > 0),
  duration_hours numeric(4,1) not null check (duration_hours > 0 and duration_hours <= 24),
  meeting_point varchar(300) not null,
  model varchar(8) not null check (model in ('propina', 'pago')),
  price numeric(14,2) not null default 0 check (price >= 0),
  currency char(3) not null default 'PEN' check (currency ~ '^[A-Z]{3}$'),
  capacity smallint not null default 20 check (capacity between 1 and 200),
  highlights text[] not null default '{}',
  tenant_product_ref uuid,
  status varchar(12) not null default 'en_revision' check (status in ('borrador', 'en_revision', 'publicado', 'rechazado', 'despublicado')),
  reject_reason text,
  featured_until date,
  rating numeric(2,1) check (rating is null or rating between 1 and 5),
  reviews integer not null default 0 check (reviews >= 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_showcase_listings primary key (id),
  constraint ck_platform_showcase_listings_1 check ((model = 'pago') = (price > 0)),
  constraint ck_platform_showcase_listings_2 check (status <> 'rechazado' or reject_reason is not null),
  constraint ck_platform_showcase_listings_3 check (status <> 'publicado' or published_at is not null)
);

create table platform_showcase_bookings (
  id uuid not null default app_uuid_v7(),
  code varchar(12) not null,
  listing_id uuid not null,
  service_date date not null,
  start_time varchar(5) not null check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  traveler_name varchar(160) not null,
  traveler_email citext not null,
  pax smallint not null check (pax between 1 and 30),
  language char(2) not null,
  status varchar(10) not null default 'confirmada' check (status in ('confirmada', 'asistio', 'no_show', 'cancelada')),
  amount numeric(14,2) check (amount is null or amount > 0),
  currency char(3) not null default 'PEN' check (currency ~ '^[A-Z]{3}$'),
  commission_pct numeric(5,2) check (commission_pct is null or commission_pct between 0 and 30),
  fee_amount numeric(14,2) not null default 0 check (fee_amount >= 0),
  fee_basis varchar(14) not null check (fee_basis in ('cupo_gratis', 'por_asistente', 'comision', 'plan')),
  marketing_consent boolean not null default false,
  source varchar(40),
  cancel_token varchar(40) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_showcase_bookings primary key (id),
  constraint ck_platform_showcase_bookings_1 check ((fee_basis = 'comision') = (commission_pct is not null) and (fee_basis = 'comision') = (amount is not null))
);

create table platform_blog_posts (
  id uuid not null default app_uuid_v7(),
  slug varchar(160) not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title varchar(200) not null,
  excerpt varchar(320) not null,
  body text,
  city varchar(40),
  focus_keyword varchar(120) not null,
  status varchar(12) not null default 'borrador' check (status in ('borrador', 'en_revision', 'publicado', 'archivado')),
  word_count integer not null default 0 check (word_count >= 0),
  seo_score smallint check (seo_score is null or seo_score between 0 and 100),
  published_at timestamptz,
  author_id uuid,
  linked_listing_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_blog_posts primary key (id),
  constraint ck_platform_blog_posts_1 check (status <> 'publicado' or (published_at is not null and word_count >= 800))
);

create table platform_funnel_events (
  id bigint generated always as identity,
  occurred_at timestamptz not null default now(),
  kind varchar(20) not null check (kind in ('visita', 'reserva', 'registro_agencia', 'pase_iniciado', 'plan_pagado', 'addon_comprado')),
  agency_id uuid,
  tenant_id uuid,
  listing_id uuid,
  session_hash char(64),
  utm jsonb,
  constraint pk_platform_funnel_events primary key (id)
);

-- ---------------------------------------------------------------- v2.8 · índices únicos
create unique index uq_catalog_leg_tours_leg_id_code on catalog_leg_tours (tenant_id, leg_id, code);
create unique index uq_catalog_transport_options_product_id_code on catalog_transport_options (tenant_id, product_id, code);
create unique index uq_catalog_transport_vehicles_option_id_name on catalog_transport_vehicles (tenant_id, option_id, name);
create unique index uq_booking_trip_legs_reservation_id_sequence on booking_trip_legs (tenant_id, reservation_id, sequence);
create unique index uq_booking_trip_items_res_tour_date on booking_trip_items (tenant_id, reservation_id, leg_tour_id, service_date) where leg_tour_id is not null;
create unique index uq_booking_trip_items_res_transport on booking_trip_items (tenant_id, reservation_id, transport_option_id) where transport_option_id is not null;
create unique index uq_booking_in_trip_offers_tenant_id_code on booking_in_trip_offers (tenant_id, code);
create unique index uq_fin_gateway_accounts_provider_account on fin_gateway_accounts (tenant_id, provider, account_ref);
create unique index uq_fin_payment_fees_payment_id on fin_payment_fees (tenant_id, payment_id);
create unique index uq_cms_site_domains_host on cms_site_domains (host) where status <> 'retirado';
create unique index uq_cms_seo_pages_tenant_id_path on cms_seo_pages (tenant_id, path);
create unique index uq_cms_redirects_tenant_id_from_path on cms_redirects (tenant_id, from_path) where active;
create unique index uq_cms_travel_stories_tenant_id_slug on cms_travel_stories (tenant_id, slug);
create unique index uq_platform_access_passes_code on platform_access_passes (code);
create unique index uq_platform_access_passes_active_tenant on platform_access_passes (tenant_id) where status = 'activo';
create unique index uq_platform_showcase_agencies_code on platform_showcase_agencies (code);
create unique index uq_platform_showcase_agencies_slug on platform_showcase_agencies (slug);
create unique index uq_platform_showcase_agencies_tenant_id on platform_showcase_agencies (tenant_id) where tenant_id is not null;
create unique index uq_platform_showcase_listings_code on platform_showcase_listings (code);
create unique index uq_platform_showcase_listings_slug on platform_showcase_listings (slug);
create unique index uq_platform_showcase_bookings_code on platform_showcase_bookings (code);
create unique index uq_platform_showcase_bookings_cancel_token on platform_showcase_bookings (cancel_token);
create unique index uq_platform_blog_posts_slug on platform_blog_posts (slug);

-- ---------------------------------------------------------------- v2.8 · claves foráneas
alter table catalog_hotel_season_rates add constraint fk_catalog_hotel_season_rates_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_hotel_season_rates add constraint fk_catalog_hotel_season_rates_hotel_id foreign key (hotel_id) references catalog_accommodation_hotels (id) on delete cascade;
alter table catalog_hotel_season_rates add constraint fk_catalog_hotel_season_rates_created_by foreign key (created_by) references iam_users (id);
alter table catalog_leg_tours add constraint fk_catalog_leg_tours_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_leg_tours add constraint fk_catalog_leg_tours_leg_id foreign key (leg_id) references catalog_accommodation_legs (id) on delete cascade;
alter table catalog_leg_tours add constraint fk_catalog_leg_tours_provider_id foreign key (provider_id) references catalog_providers (id);
alter table catalog_leg_tours add constraint fk_catalog_leg_tours_created_by foreign key (created_by) references iam_users (id);
alter table catalog_transport_options add constraint fk_catalog_transport_options_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_transport_options add constraint fk_catalog_transport_options_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_transport_options add constraint fk_catalog_transport_options_from_leg_id foreign key (from_leg_id) references catalog_accommodation_legs (id);
alter table catalog_transport_options add constraint fk_catalog_transport_options_to_leg_id foreign key (to_leg_id) references catalog_accommodation_legs (id);
alter table catalog_transport_options add constraint fk_catalog_transport_options_provider_id foreign key (provider_id) references catalog_providers (id);
alter table catalog_transport_options add constraint fk_catalog_transport_options_created_by foreign key (created_by) references iam_users (id);
alter table catalog_transport_vehicles add constraint fk_catalog_transport_vehicles_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_transport_vehicles add constraint fk_catalog_transport_vehicles_option_id foreign key (option_id) references catalog_transport_options (id) on delete cascade;
alter table booking_trip_legs add constraint fk_booking_trip_legs_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_trip_legs add constraint fk_booking_trip_legs_reservation_id foreign key (reservation_id) references booking_reservations (id) on delete cascade;
alter table booking_trip_legs add constraint fk_booking_trip_legs_leg_id foreign key (leg_id) references catalog_accommodation_legs (id);
alter table booking_trip_items add constraint fk_booking_trip_items_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_trip_items add constraint fk_booking_trip_items_reservation_id foreign key (reservation_id) references booking_reservations (id) on delete cascade;
alter table booking_trip_items add constraint fk_booking_trip_items_trip_leg_id foreign key (trip_leg_id) references booking_trip_legs (id);
alter table booking_trip_items add constraint fk_booking_trip_items_leg_tour_id foreign key (leg_tour_id) references catalog_leg_tours (id);
alter table booking_trip_items add constraint fk_booking_trip_items_transport_option_id foreign key (transport_option_id) references catalog_transport_options (id);
alter table booking_trip_items add constraint fk_booking_trip_items_vehicle_id foreign key (vehicle_id) references catalog_transport_vehicles (id);
alter table booking_trip_items add constraint fk_booking_trip_items_reservation_service_id foreign key (reservation_service_id) references booking_reservation_services (id);
alter table booking_trip_items add constraint fk_booking_trip_items_created_by foreign key (created_by) references iam_users (id);
alter table booking_in_trip_offers add constraint fk_booking_in_trip_offers_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_in_trip_offers add constraint fk_booking_in_trip_offers_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table booking_in_trip_offers add constraint fk_booking_in_trip_offers_leg_tour_id foreign key (leg_tour_id) references catalog_leg_tours (id);
alter table booking_in_trip_offers add constraint fk_booking_in_trip_offers_transport_option_id foreign key (transport_option_id) references catalog_transport_options (id);
alter table booking_in_trip_offers add constraint fk_booking_in_trip_offers_payment_link_id foreign key (payment_link_id) references fin_payment_links (id);
alter table booking_in_trip_offers add constraint fk_booking_in_trip_offers_trip_item_id foreign key (trip_item_id) references booking_trip_items (id);
alter table booking_in_trip_offers add constraint fk_booking_in_trip_offers_created_by foreign key (created_by) references iam_users (id);
alter table fin_gateway_accounts add constraint fk_fin_gateway_accounts_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_gateway_accounts add constraint fk_fin_gateway_accounts_created_by foreign key (created_by) references iam_users (id);
alter table fin_payment_fees add constraint fk_fin_payment_fees_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_payment_fees add constraint fk_fin_payment_fees_payment_id foreign key (payment_id) references fin_payments (id);
alter table fin_payment_fees add constraint fk_fin_payment_fees_gateway_account_id foreign key (gateway_account_id) references fin_gateway_accounts (id);
alter table cms_site_domains add constraint fk_cms_site_domains_tenant_id foreign key (tenant_id) references tenants (id);
alter table cms_site_domains add constraint fk_cms_site_domains_created_by foreign key (created_by) references iam_users (id);
alter table cms_seo_pages add constraint fk_cms_seo_pages_tenant_id foreign key (tenant_id) references tenants (id);
alter table cms_redirects add constraint fk_cms_redirects_tenant_id foreign key (tenant_id) references tenants (id);
alter table cms_redirects add constraint fk_cms_redirects_created_by foreign key (created_by) references iam_users (id);
alter table cms_travel_stories add constraint fk_cms_travel_stories_tenant_id foreign key (tenant_id) references tenants (id);
alter table cms_travel_stories add constraint fk_cms_travel_stories_client_id foreign key (client_id) references crm_clients (id);
alter table cms_travel_stories add constraint fk_cms_travel_stories_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table cms_travel_stories add constraint fk_cms_travel_stories_product_id foreign key (product_id) references catalog_products (id);
alter table cms_travel_stories add constraint fk_cms_travel_stories_created_by foreign key (created_by) references iam_users (id);
alter table platform_access_passes add constraint fk_platform_access_passes_tenant_id foreign key (tenant_id) references tenants (id);
alter table platform_access_passes add constraint fk_platform_access_passes_convert_to_plan_id foreign key (convert_to_plan_id) references plans (id);
alter table platform_access_passes add constraint fk_platform_access_passes_invoice_id foreign key (invoice_id) references platform_invoices (id);
alter table platform_access_passes add constraint fk_platform_access_passes_created_by foreign key (created_by) references platform_users (id);
alter table platform_showcase_agencies add constraint fk_platform_showcase_agencies_tenant_id foreign key (tenant_id) references tenants (id);
alter table platform_showcase_listings add constraint fk_platform_showcase_listings_agency_id foreign key (agency_id) references platform_showcase_agencies (id);
alter table platform_showcase_bookings add constraint fk_platform_showcase_bookings_listing_id foreign key (listing_id) references platform_showcase_listings (id);
alter table platform_blog_posts add constraint fk_platform_blog_posts_author_id foreign key (author_id) references platform_users (id);
alter table platform_funnel_events add constraint fk_platform_funnel_events_agency_id foreign key (agency_id) references platform_showcase_agencies (id);
alter table platform_funnel_events add constraint fk_platform_funnel_events_tenant_id foreign key (tenant_id) references tenants (id);
alter table platform_funnel_events add constraint fk_platform_funnel_events_listing_id foreign key (listing_id) references platform_showcase_listings (id);

-- ---------------------------------------------------------------- v2.8 · índices
create index ix_catalog_hotel_season_rates_hotel_id on catalog_hotel_season_rates (hotel_id, date_from);
create index ix_catalog_hotel_season_rates_created_by on catalog_hotel_season_rates (created_by);
create index ix_catalog_leg_tours_leg_id on catalog_leg_tours (leg_id);
create index ix_catalog_leg_tours_provider_id on catalog_leg_tours (provider_id);
create index ix_catalog_leg_tours_created_by on catalog_leg_tours (created_by);
create index ix_catalog_transport_options_product_id on catalog_transport_options (product_id);
create index ix_catalog_transport_options_from_leg_id on catalog_transport_options (from_leg_id);
create index ix_catalog_transport_options_to_leg_id on catalog_transport_options (to_leg_id);
create index ix_catalog_transport_options_provider_id on catalog_transport_options (provider_id);
create index ix_catalog_transport_options_created_by on catalog_transport_options (created_by);
create index ix_catalog_transport_vehicles_option_id on catalog_transport_vehicles (option_id);
create index ix_booking_trip_legs_reservation_id on booking_trip_legs (reservation_id);
create index ix_booking_trip_legs_leg_id on booking_trip_legs (leg_id);
create index ix_booking_trip_items_reservation_id on booking_trip_items (reservation_id, service_date);
create index ix_booking_trip_items_trip_leg_id on booking_trip_items (trip_leg_id);
create index ix_booking_trip_items_leg_tour_id on booking_trip_items (leg_tour_id);
create index ix_booking_trip_items_transport_option_id on booking_trip_items (transport_option_id);
create index ix_booking_trip_items_vehicle_id on booking_trip_items (vehicle_id);
create index ix_booking_trip_items_reservation_service_id on booking_trip_items (reservation_service_id);
create index ix_booking_trip_items_created_by on booking_trip_items (created_by);
create index ix_booking_in_trip_offers_reservation_id on booking_in_trip_offers (reservation_id, status);
create index ix_booking_in_trip_offers_leg_tour_id on booking_in_trip_offers (leg_tour_id);
create index ix_booking_in_trip_offers_transport_option_id on booking_in_trip_offers (transport_option_id);
create index ix_booking_in_trip_offers_payment_link_id on booking_in_trip_offers (payment_link_id);
create index ix_booking_in_trip_offers_trip_item_id on booking_in_trip_offers (trip_item_id);
create index ix_booking_in_trip_offers_created_by on booking_in_trip_offers (created_by);
create index ix_booking_in_trip_offers_expires on booking_in_trip_offers (tenant_id, expires_at) where status in ('ofrecida', 'link_enviado');
create index ix_fin_gateway_accounts_created_by on fin_gateway_accounts (created_by);
create index ix_fin_payment_fees_gateway_account_id on fin_payment_fees (gateway_account_id, settled_on);
create index ix_cms_site_domains_tenant_id on cms_site_domains (tenant_id, status);
create index ix_cms_site_domains_created_by on cms_site_domains (created_by);
create index ix_cms_site_domains_ssl on cms_site_domains (ssl_expires_at) where ssl_status = 'emitido';
create index ix_cms_redirects_created_by on cms_redirects (created_by);
create index ix_cms_travel_stories_client_id on cms_travel_stories (client_id);
create index ix_cms_travel_stories_reservation_id on cms_travel_stories (reservation_id);
create index ix_cms_travel_stories_product_id on cms_travel_stories (product_id);
create index ix_cms_travel_stories_created_by on cms_travel_stories (created_by);
create index ix_cms_travel_stories_status on cms_travel_stories (tenant_id, status, published_at desc);
create index ix_platform_access_passes_convert_to_plan_id on platform_access_passes (convert_to_plan_id);
create index ix_platform_access_passes_invoice_id on platform_access_passes (invoice_id);
create index ix_platform_access_passes_created_by on platform_access_passes (created_by);
create index ix_platform_access_passes_ends_on on platform_access_passes (ends_on) where status = 'activo';
create index ix_platform_showcase_agencies_status on platform_showcase_agencies (status, city);
create index ix_platform_showcase_listings_agency_id on platform_showcase_listings (agency_id);
create index ix_platform_showcase_listings_city_status on platform_showcase_listings (city, status, theme);
create index ix_platform_showcase_bookings_listing_id on platform_showcase_bookings (listing_id, service_date);
create index ix_platform_showcase_bookings_email on platform_showcase_bookings (traveler_email);
create index ix_platform_blog_posts_author_id on platform_blog_posts (author_id);
create index ix_platform_blog_posts_status on platform_blog_posts (status, published_at desc);
create index ix_platform_funnel_events_kind_time on platform_funnel_events (kind, occurred_at);
create index ix_platform_funnel_events_agency_id on platform_funnel_events (agency_id);
create index ix_platform_funnel_events_tenant_id on platform_funnel_events (tenant_id);
create index ix_platform_funnel_events_listing_id on platform_funnel_events (listing_id);

-- ---------------------------------------------------------------- v2.8 · triggers
create trigger trg_catalog_hotel_season_rates_updated_at before update on catalog_hotel_season_rates for each row execute function app_set_updated_at();
create trigger trg_catalog_leg_tours_updated_at before update on catalog_leg_tours for each row execute function app_set_updated_at();
create trigger trg_catalog_transport_options_updated_at before update on catalog_transport_options for each row execute function app_set_updated_at();
create trigger trg_catalog_transport_vehicles_updated_at before update on catalog_transport_vehicles for each row execute function app_set_updated_at();
create trigger trg_booking_trip_items_updated_at before update on booking_trip_items for each row execute function app_set_updated_at();
create trigger trg_booking_in_trip_offers_updated_at before update on booking_in_trip_offers for each row execute function app_set_updated_at();
create trigger trg_fin_gateway_accounts_updated_at before update on fin_gateway_accounts for each row execute function app_set_updated_at();
create trigger trg_fin_payment_fees_updated_at before update on fin_payment_fees for each row execute function app_set_updated_at();
create trigger trg_cms_site_domains_updated_at before update on cms_site_domains for each row execute function app_set_updated_at();
create trigger trg_cms_seo_pages_updated_at before update on cms_seo_pages for each row execute function app_set_updated_at();
create trigger trg_cms_redirects_updated_at before update on cms_redirects for each row execute function app_set_updated_at();
create trigger trg_cms_travel_stories_updated_at before update on cms_travel_stories for each row execute function app_set_updated_at();
create trigger trg_platform_access_passes_updated_at before update on platform_access_passes for each row execute function app_set_updated_at();
create trigger trg_platform_showcase_agencies_updated_at before update on platform_showcase_agencies for each row execute function app_set_updated_at();
create trigger trg_platform_showcase_listings_updated_at before update on platform_showcase_listings for each row execute function app_set_updated_at();
create trigger trg_platform_showcase_bookings_updated_at before update on platform_showcase_bookings for each row execute function app_set_updated_at();
create trigger trg_platform_blog_posts_updated_at before update on platform_blog_posts for each row execute function app_set_updated_at();
create trigger trg_platform_funnel_events_append_only before update or delete on platform_funnel_events for each row execute function app_forbid_update_delete();

-- ---------------------------------------------------------------- v2.8 · comentarios
comment on table catalog_hotel_season_rates is '[Spec 21 §3.1] [Fase 3] Ajuste porcentual de la tarifa de un hotel del tramo por rango de fechas (temporada); sin solapes por hotel.';
comment on table catalog_leg_tours is '[Spec 21 §3.2] [Fase 3] Tours opcionales de un tramo (ciudad) con precio adulto/niño, día relativo, edad mínima y cupo.';
comment on table catalog_transport_options is '[Spec 21 §3.3] [Fase 3] Movilidad del circuito: entre tramos (elegir una por par) o local, por pasajero o por vehículo.';
comment on table catalog_transport_vehicles is '[Spec 21 §3.3] [Fase 3] Vehículos y capacidad de una opción de movilidad cobrada por vehículo.';
comment on table booking_trip_legs is '[Spec 21 §3.4] [Fase 3] Tramos del viaje armado en la reserva: noches elegidas y fechas de entrada y salida por ciudad.';
comment on table booking_trip_items is '[Spec 21 §3.5] [Fase 3] Tours y movilidad del viaje armado, con importe confirmado por el servidor y servicio generado.';
comment on table booking_in_trip_offers is '[Spec 21 §3.6] [Fase 3] Venta en ruta: oferta de un tour o movilidad de un tramo pendiente, con link de pago y vencimiento.';
comment on table fin_gateway_accounts is '[Spec 22 §3.1] [Fase 3] Pasarelas de cobro del tenant (tarjeta local, PayPal, Yape/Plin) con su esquema de comisión.';
comment on table fin_payment_fees is '[Spec 22 §3.2] [Fase 3] Comisión real de cada cobro por pasarela: bruto, comisión, IGV de la comisión, margen de cambio y neto.';
comment on table cms_site_domains is '[Spec 22 §3.3] [Fase 3] Dominios propios del sitio y portales, con verificación DNS y certificado SSL.';
comment on table cms_seo_pages is '[Spec 22 §3.4] [Fase 3] Auditoría SEO por página publicada: metadatos, contenido, velocidad, puntaje y métricas de búsqueda.';
comment on table cms_redirects is '[Spec 22 §3.5] [Fase 3] Redirecciones 301/302 del sitio del tenant, sin cadenas.';
comment on table cms_travel_stories is '[Spec 22 §3.6] [Fase 3] Blog de aventuras con clientes: solo se publica con consentimiento vigente (Ley 29733).';
comment on table platform_access_passes is '[Spec 22 §3.7] [Fase 3] Pase Básico de hasta 60 días con funciones elegidas por el Super Admin; uno activo por tenant.';
comment on table platform_showcase_agencies is '[Spec 22 §3.8] [Fase 3] Agencias que publican en la vitrina gratuita (con o sin tenant en KipuControl).';
comment on table platform_showcase_listings is '[Spec 22 §3.9] [Fase 3] Tours publicados en la vitrina: free tour (propina) o de pago, con moderación.';
comment on table platform_showcase_bookings is '[Spec 22 §3.10] [Fase 3] Reservas de la vitrina con nombre y correo, y el cargo a la agencia (cupo, por asistente o comisión).';
comment on table platform_blog_posts is '[Spec 22 §3.11] [Fase 3] Artículos del blog SEO de la vitrina, enlazados a tours publicados.';
comment on table platform_funnel_events is '[Spec 22 §3.12] [Fase 3] Eventos del embudo de captación de agencias (visita, reserva, registro, pase, plan). Append-only.';

-- ================================================================ v2.9 · Plantillas web y contenido con IA (spec 23, plataforma)
-- Catálogo de plantillas del sitio público (las crea el equipo de desarrollo o un partner), versiones con su
-- manifiesto y puntajes de calidad, envíos a revisión y paquetes de créditos de IA. Sin RLS: REVOKE a app_role.

create table platform_site_templates (
  id uuid not null default app_uuid_v7(),
  code varchar(20) not null,
  slug varchar(60) not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name varchar(80) not null,
  description text not null,
  category varchar(16) not null check (category in ('agencia', 'free_tour', 'aventura', 'lujo', 'corporativo', 'multi')),
  tier varchar(10) not null default 'incluida' check (tier in ('incluida', 'premium')),
  price_once numeric(12,2) not null default 0 check (price_once >= 0),
  currency char(3) not null default 'PEN' check (currency ~ '^[A-Z]{3}$'),
  min_plan_code varchar(40),
  author_kind varchar(10) not null default 'equipo' check (author_kind in ('equipo', 'partner')),
  author_name varchar(120) not null,
  repo_url varchar(300),
  status varchar(12) not null default 'borrador' check (status in ('borrador', 'en_revision', 'publicado', 'retirado')),
  current_version_id uuid,
  default_for_new boolean not null default false,
  installs integer not null default 0 check (installs >= 0),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_site_templates primary key (id),
  constraint ck_platform_site_templates_1 check ((tier = 'incluida' and price_once = 0) or (tier = 'premium' and price_once > 0)),
  constraint ck_platform_site_templates_2 check (status <> 'publicado' or current_version_id is not null),
  constraint ck_platform_site_templates_3 check (not default_for_new or (status = 'publicado' and tier = 'incluida'))
);

create table platform_site_template_versions (
  id uuid not null default app_uuid_v7(),
  template_id uuid not null,
  version varchar(20) not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object' and manifest ? 'sections' and manifest ? 'tokens'),
  bundle_path varchar(300) not null,
  bundle_sha256 char(64) not null check (bundle_sha256 ~ '^[0-9a-f]{64}$'),
  changelog text,
  status varchar(12) not null default 'candidata' check (status in ('candidata', 'aprobada', 'publicada', 'retirada')),
  lh_performance smallint check (lh_performance between 0 and 100),
  lh_accessibility smallint check (lh_accessibility between 0 and 100),
  lh_seo smallint check (lh_seo between 0 and 100),
  lh_best_practices smallint check (lh_best_practices between 0 and 100),
  approved_by uuid,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_site_template_versions primary key (id),
  constraint ck_platform_site_template_versions_1 check (status not in ('aprobada', 'publicada') or (approved_by is not null and lh_performance >= 85 and lh_accessibility >= 95 and lh_seo >= 95 and lh_best_practices >= 90)),
  constraint ck_platform_site_template_versions_2 check (status <> 'publicada' or published_at is not null)
);

create table platform_template_submissions (
  id uuid not null default app_uuid_v7(),
  code varchar(20) not null,
  template_id uuid not null,
  version varchar(20) not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  submitted_by uuid,
  submitted_by_name varchar(120) not null,
  status varchar(12) not null default 'recibida' check (status in ('recibida', 'validando', 'aprobada', 'rechazada')),
  checks jsonb not null default '{}'::jsonb check (jsonb_typeof(checks) = 'object'),
  reviewer_id uuid,
  decided_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_template_submissions primary key (id),
  constraint ck_platform_template_submissions_1 check (status not in ('aprobada', 'rechazada') or (decided_at is not null and reviewer_id is not null)),
  constraint ck_platform_template_submissions_2 check (status <> 'rechazada' or length(coalesce(reject_reason, '')) >= 10)
);

create table platform_ai_credit_packs (
  id uuid not null default app_uuid_v7(),
  code varchar(30) not null,
  name varchar(80) not null,
  kind varchar(10) not null check (kind in ('contenido', 'imagenes')),
  credits integer not null check (credits > 0),
  price numeric(12,2) not null check (price >= 0),
  currency char(3) not null default 'PEN' check (currency ~ '^[A-Z]{3}$'),
  billing varchar(8) not null check (billing in ('unico', 'mensual')),
  addon_code varchar(40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_ai_credit_packs primary key (id)
);

-- ================================================================ v2.9 · Tema del sitio y contenido con IA (spec 23, tenant)

create table cms_site_themes (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  template_id uuid not null,
  template_version_id uuid not null,
  status varchar(12) not null default 'vista_previa' check (status in ('vista_previa', 'activo', 'anterior')),
  tokens jsonb not null default '{}'::jsonb check (jsonb_typeof(tokens) = 'object'),
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  logo_path varchar(300),
  chosen_by varchar(16) not null check (chosen_by in ('alta', 'agencia', 'admin_plataforma')),
  applied_by uuid,
  applied_at timestamptz,
  preview_token varchar(64),
  lock_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_cms_site_themes primary key (id),
  constraint ck_cms_site_themes_1 check (status = 'vista_previa' or applied_at is not null),
  constraint ck_cms_site_themes_2 check (status <> 'vista_previa' or preview_token is not null)
);

create table cms_ai_content_jobs (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  kind varchar(16) not null check (kind in ('mejorar_texto', 'meta_seo', 'traducir', 'relato_aventura', 'articulo', 'imagen')),
  target_type varchar(12) not null check (target_type in ('producto', 'pagina', 'articulo', 'historia', 'libre')),
  target_id uuid,
  locale varchar(5) not null default 'es' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  tone varchar(16) check (tone in ('cercano', 'profesional', 'aventurero', 'lujo', 'familiar')),
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  output jsonb,
  status varchar(12) not null default 'en_cola' check (status in ('en_cola', 'procesando', 'listo', 'aplicado', 'descartado', 'fallido')),
  credits_used integer not null default 0 check (credits_used >= 0),
  ai_request_id uuid,
  error text,
  applied_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_cms_ai_content_jobs primary key (id),
  constraint ck_cms_ai_content_jobs_1 check (status not in ('listo', 'aplicado') or output is not null),
  constraint ck_cms_ai_content_jobs_2 check (status <> 'aplicado' or applied_at is not null),
  constraint ck_cms_ai_content_jobs_3 check (status <> 'fallido' or (error is not null and credits_used = 0)),
  constraint ck_cms_ai_content_jobs_4 check (target_type = 'libre' or target_id is not null)
);

create table cms_ai_images (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  job_id uuid not null,
  prompt text not null check (length(prompt) between 10 and 2000),
  style varchar(16) not null check (style in ('fotografico', 'ilustracion', 'acuarela', 'mapa', 'textil')),
  width smallint not null check (width between 256 and 4096),
  height smallint not null check (height between 256 and 4096),
  file_path varchar(300) not null,
  alt_text varchar(200) not null check (length(alt_text) >= 5),
  ai_label boolean not null default true,
  credits_used integer not null check (credits_used > 0),
  status varchar(12) not null default 'generada' check (status in ('generada', 'en_uso', 'descartada')),
  used_in jsonb not null default '[]'::jsonb check (jsonb_typeof(used_in) = 'array'),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_cms_ai_images primary key (id)
);

create table fin_ai_credit_ledger (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  kind varchar(10) not null check (kind in ('contenido', 'imagenes')),
  movement varchar(16) not null check (movement in ('asignacion_plan', 'compra_paquete', 'consumo', 'reembolso', 'vencimiento', 'ajuste')),
  credits integer not null check (credits <> 0),
  balance_after integer not null check (balance_after >= 0),
  pack_id uuid,
  job_id uuid,
  invoice_id uuid,
  note varchar(200),
  occurred_at timestamptz not null default now(),
  created_by uuid,
  constraint pk_fin_ai_credit_ledger primary key (id),
  constraint ck_fin_ai_credit_ledger_1 check (movement <> 'compra_paquete' or (pack_id is not null and credits > 0)),
  constraint ck_fin_ai_credit_ledger_2 check (movement <> 'consumo' or (job_id is not null and credits < 0)),
  constraint ck_fin_ai_credit_ledger_3 check (movement <> 'vencimiento' or credits < 0),
  constraint ck_fin_ai_credit_ledger_4 check (movement not in ('asignacion_plan', 'reembolso') or credits > 0)
);

-- ---------------------------------------------------------------- v2.9 · índices únicos
create unique index uq_platform_site_templates_code on platform_site_templates (code);
create unique index uq_platform_site_templates_slug on platform_site_templates (slug);
create unique index uq_platform_site_templates_default on platform_site_templates ((true)) where default_for_new;
create unique index uq_platform_site_template_versions_tpl_version on platform_site_template_versions (template_id, version);
create unique index uq_platform_template_submissions_code on platform_template_submissions (code);
create unique index uq_platform_ai_credit_packs_code on platform_ai_credit_packs (code);
create unique index uq_cms_site_themes_one_active on cms_site_themes (tenant_id) where status = 'activo';
create unique index uq_cms_site_themes_preview_token on cms_site_themes (preview_token) where preview_token is not null;
create unique index uq_cms_ai_content_jobs_tenant_id_code on cms_ai_content_jobs (tenant_id, code);

-- ---------------------------------------------------------------- v2.9 · claves foráneas
alter table platform_site_templates add constraint fk_platform_site_templates_current_version_id foreign key (current_version_id) references platform_site_template_versions (id) deferrable initially deferred;
alter table platform_site_template_versions add constraint fk_platform_site_template_versions_template_id foreign key (template_id) references platform_site_templates (id);
alter table platform_site_template_versions add constraint fk_platform_site_template_versions_approved_by foreign key (approved_by) references platform_users (id);
alter table platform_template_submissions add constraint fk_platform_template_submissions_template_id foreign key (template_id) references platform_site_templates (id);
alter table platform_template_submissions add constraint fk_platform_template_submissions_submitted_by foreign key (submitted_by) references platform_users (id);
alter table platform_template_submissions add constraint fk_platform_template_submissions_reviewer_id foreign key (reviewer_id) references platform_users (id);
alter table cms_site_themes add constraint fk_cms_site_themes_tenant_id foreign key (tenant_id) references tenants (id);
alter table cms_site_themes add constraint fk_cms_site_themes_template_id foreign key (template_id) references platform_site_templates (id);
alter table cms_site_themes add constraint fk_cms_site_themes_template_version_id foreign key (template_version_id) references platform_site_template_versions (id);
alter table cms_site_themes add constraint fk_cms_site_themes_applied_by foreign key (applied_by) references iam_users (id);
alter table cms_ai_content_jobs add constraint fk_cms_ai_content_jobs_tenant_id foreign key (tenant_id) references tenants (id);
alter table cms_ai_content_jobs add constraint fk_cms_ai_content_jobs_ai_request_id foreign key (ai_request_id) references sys_ai_requests (id);
alter table cms_ai_content_jobs add constraint fk_cms_ai_content_jobs_created_by foreign key (created_by) references iam_users (id);
alter table cms_ai_images add constraint fk_cms_ai_images_tenant_id foreign key (tenant_id) references tenants (id);
alter table cms_ai_images add constraint fk_cms_ai_images_job_id foreign key (job_id) references cms_ai_content_jobs (id);
alter table cms_ai_images add constraint fk_cms_ai_images_created_by foreign key (created_by) references iam_users (id);
alter table fin_ai_credit_ledger add constraint fk_fin_ai_credit_ledger_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_ai_credit_ledger add constraint fk_fin_ai_credit_ledger_pack_id foreign key (pack_id) references platform_ai_credit_packs (id);
alter table fin_ai_credit_ledger add constraint fk_fin_ai_credit_ledger_job_id foreign key (job_id) references cms_ai_content_jobs (id);
alter table fin_ai_credit_ledger add constraint fk_fin_ai_credit_ledger_invoice_id foreign key (invoice_id) references platform_invoices (id);
alter table fin_ai_credit_ledger add constraint fk_fin_ai_credit_ledger_created_by foreign key (created_by) references iam_users (id);

-- ---------------------------------------------------------------- v2.9 · índices
create index ix_platform_site_templates_status on platform_site_templates (status, category);
create index ix_platform_site_templates_current_version_id on platform_site_templates (current_version_id);
create index ix_platform_site_template_versions_approved_by on platform_site_template_versions (approved_by);
create index ix_platform_template_submissions_template_id on platform_template_submissions (template_id);
create index ix_platform_template_submissions_status on platform_template_submissions (status, created_at);
create index ix_platform_template_submissions_submitted_by on platform_template_submissions (submitted_by);
create index ix_platform_template_submissions_reviewer_id on platform_template_submissions (reviewer_id);
create index ix_cms_site_themes_template_id on cms_site_themes (template_id);
create index ix_cms_site_themes_template_version_id on cms_site_themes (template_version_id);
create index ix_cms_site_themes_applied_by on cms_site_themes (applied_by);
create index ix_cms_site_themes_tenant_status on cms_site_themes (tenant_id, status, applied_at desc);
create index ix_cms_ai_content_jobs_status on cms_ai_content_jobs (tenant_id, status, created_at desc);
create index ix_cms_ai_content_jobs_target on cms_ai_content_jobs (tenant_id, target_type, target_id);
create index ix_cms_ai_content_jobs_ai_request_id on cms_ai_content_jobs (ai_request_id);
create index ix_cms_ai_content_jobs_created_by on cms_ai_content_jobs (created_by);
create index ix_cms_ai_images_job_id on cms_ai_images (job_id);
create index ix_cms_ai_images_created_by on cms_ai_images (created_by);
create index ix_cms_ai_images_status on cms_ai_images (tenant_id, status);
create index ix_fin_ai_credit_ledger_kind_time on fin_ai_credit_ledger (tenant_id, kind, occurred_at);
create index ix_fin_ai_credit_ledger_pack_id on fin_ai_credit_ledger (pack_id);
create index ix_fin_ai_credit_ledger_job_id on fin_ai_credit_ledger (job_id);
create index ix_fin_ai_credit_ledger_invoice_id on fin_ai_credit_ledger (invoice_id);
create index ix_fin_ai_credit_ledger_created_by on fin_ai_credit_ledger (created_by);

-- ---------------------------------------------------------------- v2.9 · triggers
create trigger trg_platform_site_templates_updated_at before update on platform_site_templates for each row execute function app_set_updated_at();
create trigger trg_platform_site_template_versions_updated_at before update on platform_site_template_versions for each row execute function app_set_updated_at();
create trigger trg_platform_template_submissions_updated_at before update on platform_template_submissions for each row execute function app_set_updated_at();
create trigger trg_platform_ai_credit_packs_updated_at before update on platform_ai_credit_packs for each row execute function app_set_updated_at();
create trigger trg_cms_site_themes_updated_at before update on cms_site_themes for each row execute function app_set_updated_at();
create trigger trg_cms_ai_content_jobs_updated_at before update on cms_ai_content_jobs for each row execute function app_set_updated_at();
create trigger trg_cms_ai_images_updated_at before update on cms_ai_images for each row execute function app_set_updated_at();
create trigger trg_fin_ai_credit_ledger_append_only before update or delete on fin_ai_credit_ledger for each row execute function app_forbid_update_delete();

-- ---------------------------------------------------------------- v2.9 · comentarios
comment on table platform_site_templates is '[Spec 23 §3.1] [Fase 3] Catálogo de plantillas del sitio público (equipo o partner), incluidas o premium, con plantilla por defecto para nuevas agencias.';
comment on table platform_site_template_versions is '[Spec 23 §3.2] [Fase 3] Versiones semver de una plantilla con manifiesto, paquete firmado por SHA-256 y puntajes Lighthouse mínimos para publicar.';
comment on table platform_template_submissions is '[Spec 23 §3.3] [Fase 3] Envíos de plantillas a revisión con el resultado de las validaciones automáticas y la decisión.';
comment on table platform_ai_credit_packs is '[Spec 23 §3.4] [Fase 3] Paquetes de créditos de IA para contenido e imágenes, de pago único o mensual.';
comment on table cms_site_themes is '[Spec 23 §3.5] [Fase 3] Tema del sitio del tenant: plantilla y versión elegidas, tokens y secciones personalizados; uno activo por tenant.';
comment on table cms_ai_content_jobs is '[Spec 23 §3.6] [Fase 3] Pedidos de contenido con IA (mejorar texto, SEO, traducir, relato, artículo, imagen) con resultado revisable y créditos usados.';
comment on table cms_ai_images is '[Spec 23 §3.7] [Fase 3] Imágenes generadas con IA, con texto alternativo obligatorio, etiqueta IA y créditos cobrados.';
comment on table fin_ai_credit_ledger is '[Spec 23 §3.8] [Fase 3] Libro de créditos de IA del tenant (asignación del plan, compras, consumo, reembolso, vencimiento). Append-only.';

-- ================================================================ v2.10 · Seguimiento, conversiones y visitas de la vitrina (spec 24, plataforma)
-- Etiquetas de medición y publicidad (GA4, GTM, Google Ads, Meta Pixel, TikTok, Clarity, LinkedIn y scripts propios)
-- de la vitrina y su blog en Payload CMS, mapeo de conversiones, envíos del lado del servidor y visitas agregadas.
-- Sin RLS: REVOKE a app_role, como el resto de la plataforma.

create table platform_tracking_tags (
  id uuid not null default app_uuid_v7(),
  code varchar(20) not null,
  site varchar(10) not null default 'vitrina' check (site in ('vitrina', 'blog', 'ambos')),
  provider varchar(16) not null check (provider in ('ga4', 'gtm', 'google_ads', 'meta_pixel', 'tiktok', 'clarity', 'linkedin', 'script')),
  name varchar(80) not null,
  measurement_id varchar(40),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  secret_ref varchar(200),
  consent_category varchar(12) not null check (consent_category in ('necesarias', 'analiticas', 'marketing')),
  placement varchar(12) not null default 'head' check (placement in ('head', 'body_inicio', 'body_fin')),
  page_rules jsonb not null default '{"include":["/*"],"exclude":[]}'::jsonb check (jsonb_typeof(page_rules) = 'object' and page_rules ? 'include'),
  script_body text check (script_body is null or length(script_body) <= 51200),
  script_src varchar(400) check (script_src is null or script_src ~ '^https://'),
  sri_hash varchar(120) check (sri_hash is null or sri_hash ~ '^sha(256|384|512)-[A-Za-z0-9+/=]+$'),
  csp_domains text[] not null default '{}',
  exclude_checkout boolean not null default true,
  status varchar(12) not null default 'borrador' check (status in ('borrador', 'en_revision', 'activo', 'pausado', 'rechazado')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  reject_reason text,
  lock_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_tracking_tags primary key (id),
  constraint ck_platform_tracking_tags_1 check (
    (provider = 'ga4' and measurement_id ~ '^G-[A-Z0-9]{6,12}$') or
    (provider = 'gtm' and measurement_id ~ '^GTM-[A-Z0-9]{4,10}$') or
    (provider = 'google_ads' and measurement_id ~ '^AW-[0-9]{6,12}$') or
    (provider = 'meta_pixel' and measurement_id ~ '^[0-9]{10,20}$') or
    (provider in ('tiktok', 'clarity', 'linkedin') and measurement_id ~ '^[A-Za-z0-9_-]{4,40}$') or
    (provider = 'script' and measurement_id is null and (script_body is not null or script_src is not null))),
  constraint ck_platform_tracking_tags_2 check (script_src is null or sri_hash is not null),
  constraint ck_platform_tracking_tags_3 check (status not in ('activo', 'pausado') or (approved_by is not null and approved_at is not null)),
  constraint ck_platform_tracking_tags_4 check (approved_by is null or created_by is null or approved_by <> created_by),
  constraint ck_platform_tracking_tags_5 check (status <> 'rechazado' or length(coalesce(reject_reason, '')) >= 10),
  constraint ck_platform_tracking_tags_6 check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint ck_platform_tracking_tags_7 check (provider <> 'script' or exclude_checkout)
);

create table platform_conversion_mappings (
  id uuid not null default app_uuid_v7(),
  tag_id uuid not null,
  internal_event varchar(24) not null check (internal_event in ('reserva_vitrina', 'registro_agencia', 'pase_iniciado', 'plan_pagado', 'addon_comprado', 'suscripcion_boletin', 'lectura_articulo', 'clic_whatsapp')),
  provider_event varchar(80) not null,
  conversion_label varchar(60),
  send_value boolean not null default false,
  server_side boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_platform_conversion_mappings primary key (id)
);

create table platform_conversion_dispatches (
  id bigint generated always as identity,
  event_id uuid not null,
  mapping_id uuid not null,
  internal_event varchar(24) not null,
  channel varchar(10) not null check (channel in ('navegador', 'servidor')),
  status varchar(24) not null default 'pendiente' check (status in ('pendiente', 'enviado', 'fallido', 'sin_consentimiento', 'duplicado')),
  attempts smallint not null default 0 check (attempts between 0 and 10),
  http_status smallint,
  error varchar(300),
  value numeric(14,2) check (value is null or value >= 0),
  currency char(3) check (currency is null or currency ~ '^[A-Z]{3}$'),
  agency_id uuid,
  occurred_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint pk_platform_conversion_dispatches primary key (id),
  constraint ck_platform_conversion_dispatches_1 check (status <> 'enviado' or sent_at is not null),
  constraint ck_platform_conversion_dispatches_2 check (status <> 'fallido' or error is not null)
);

create table platform_web_analytics_daily (
  id bigint generated always as identity,
  day date not null,
  site varchar(10) not null check (site in ('vitrina', 'blog')),
  path varchar(300) not null,
  agency_id uuid,
  source varchar(80) not null default '(directo)',
  medium varchar(40) not null default '(ninguno)',
  campaign varchar(120) not null default '',
  device varchar(8) not null check (device in ('movil', 'tablet', 'escritorio', 'otro')),
  country char(2) not null default 'ZZ' check (country ~ '^[A-Z]{2}$'),
  visits integer not null default 0 check (visits >= 0),
  visitors integer not null default 0 check (visitors >= 0),
  pageviews integer not null default 0 check (pageviews >= 0),
  bounces integer not null default 0 check (bounces >= 0),
  engaged_seconds bigint not null default 0 check (engaged_seconds >= 0),
  conversions integer not null default 0 check (conversions >= 0),
  revenue numeric(14,2) not null default 0 check (revenue >= 0),
  computed_at timestamptz not null default now(),
  constraint pk_platform_web_analytics_daily primary key (id),
  constraint ck_platform_web_analytics_daily_1 check (visitors <= visits and bounces <= visits and pageviews >= visits)
);

-- El blog de la vitrina vive en Payload CMS; platform_blog_posts queda como índice sincronizado (VT-13 sigue vigente).
alter table platform_blog_posts add column payload_id varchar(40);
alter table platform_blog_posts add column synced_at timestamptz;
alter table platform_blog_posts add column canonical_url varchar(300) check (canonical_url is null or canonical_url ~ '^https://');
alter table platform_blog_posts add column noindex boolean not null default false;
alter table platform_blog_posts add constraint ck_platform_blog_posts_2 check (payload_id is null or synced_at is not null);

-- ================================================================ v2.10 · Seguimiento, conversiones y visitas del sitio de la agencia (spec 24, tenant)

create table mkt_tracking_tags (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  provider varchar(16) not null check (provider in ('ga4', 'gtm', 'google_ads', 'meta_pixel', 'tiktok', 'clarity', 'linkedin', 'script')),
  name varchar(80) not null,
  measurement_id varchar(40),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  secret_ref varchar(200),
  consent_category varchar(12) not null check (consent_category in ('necesarias', 'analiticas', 'marketing')),
  placement varchar(12) not null default 'head' check (placement in ('head', 'body_inicio', 'body_fin')),
  page_rules jsonb not null default '{"include":["/*"],"exclude":[]}'::jsonb check (jsonb_typeof(page_rules) = 'object' and page_rules ? 'include'),
  script_body text check (script_body is null or length(script_body) <= 51200),
  script_src varchar(400) check (script_src is null or script_src ~ '^https://'),
  sri_hash varchar(120) check (sri_hash is null or sri_hash ~ '^sha(256|384|512)-[A-Za-z0-9+/=]+$'),
  csp_domains text[] not null default '{}',
  exclude_checkout boolean not null default true,
  status varchar(12) not null default 'borrador' check (status in ('borrador', 'en_revision', 'activo', 'pausado', 'rechazado')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  reject_reason text,
  lock_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_mkt_tracking_tags primary key (id),
  constraint ck_mkt_tracking_tags_1 check (
    (provider = 'ga4' and measurement_id ~ '^G-[A-Z0-9]{6,12}$') or
    (provider = 'gtm' and measurement_id ~ '^GTM-[A-Z0-9]{4,10}$') or
    (provider = 'google_ads' and measurement_id ~ '^AW-[0-9]{6,12}$') or
    (provider = 'meta_pixel' and measurement_id ~ '^[0-9]{10,20}$') or
    (provider in ('tiktok', 'clarity', 'linkedin') and measurement_id ~ '^[A-Za-z0-9_-]{4,40}$') or
    (provider = 'script' and measurement_id is null and (script_body is not null or script_src is not null))),
  constraint ck_mkt_tracking_tags_2 check (script_src is null or sri_hash is not null),
  constraint ck_mkt_tracking_tags_3 check (provider <> 'script' or status not in ('activo', 'pausado') or (approved_by is not null and approved_at is not null)),
  constraint ck_mkt_tracking_tags_5 check (status <> 'rechazado' or length(coalesce(reject_reason, '')) >= 10),
  constraint ck_mkt_tracking_tags_6 check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint ck_mkt_tracking_tags_7 check (provider <> 'script' or exclude_checkout)
);

create table mkt_conversion_mappings (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  tag_id uuid not null,
  internal_event varchar(24) not null check (internal_event in ('compra', 'compra_pendiente', 'inicio_pago', 'lead_cotizacion', 'lead_contacto', 'chat_web', 'registro_cliente', 'suscripcion_boletin', 'clic_whatsapp', 'reserva_vitrina')),
  provider_event varchar(80) not null,
  conversion_label varchar(60),
  send_value boolean not null default false,
  server_side boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_mkt_conversion_mappings primary key (id)
);

create table mkt_conversion_dispatches (
  tenant_id uuid not null default app_current_tenant_id(),
  id bigint generated always as identity,
  event_id uuid not null,
  mapping_id uuid not null,
  internal_event varchar(24) not null,
  channel varchar(10) not null check (channel in ('navegador', 'servidor')),
  status varchar(24) not null default 'pendiente' check (status in ('pendiente', 'enviado', 'fallido', 'sin_consentimiento', 'duplicado')),
  attempts smallint not null default 0 check (attempts between 0 and 10),
  http_status smallint,
  error varchar(300),
  value numeric(14,2) check (value is null or value >= 0),
  currency char(3) check (currency is null or currency ~ '^[A-Z]{3}$'),
  order_id uuid,
  occurred_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint pk_mkt_conversion_dispatches primary key (id),
  constraint ck_mkt_conversion_dispatches_1 check (status <> 'enviado' or sent_at is not null),
  constraint ck_mkt_conversion_dispatches_2 check (status <> 'fallido' or error is not null)
);

create table cms_web_analytics_daily (
  tenant_id uuid not null default app_current_tenant_id(),
  id bigint generated always as identity,
  day date not null,
  path varchar(300) not null,
  source varchar(80) not null default '(directo)',
  medium varchar(40) not null default '(ninguno)',
  campaign varchar(120) not null default '',
  device varchar(8) not null check (device in ('movil', 'tablet', 'escritorio', 'otro')),
  country char(2) not null default 'ZZ' check (country ~ '^[A-Z]{2}$'),
  visits integer not null default 0 check (visits >= 0),
  visitors integer not null default 0 check (visitors >= 0),
  pageviews integer not null default 0 check (pageviews >= 0),
  bounces integer not null default 0 check (bounces >= 0),
  engaged_seconds bigint not null default 0 check (engaged_seconds >= 0),
  conversions integer not null default 0 check (conversions >= 0),
  revenue numeric(14,2) not null default 0 check (revenue >= 0),
  computed_at timestamptz not null default now(),
  constraint pk_cms_web_analytics_daily primary key (id),
  constraint ck_cms_web_analytics_daily_1 check (visitors <= visits and bounces <= visits and pageviews >= visits)
);

-- ---------------------------------------------------------------- v2.10 · índices únicos
create unique index uq_platform_tracking_tags_code on platform_tracking_tags (code);
create unique index uq_platform_tracking_tags_provider_id on platform_tracking_tags (site, provider, measurement_id) where measurement_id is not null and status <> 'rechazado';
create unique index uq_platform_conversion_mappings_tag_event on platform_conversion_mappings (tag_id, internal_event);
create unique index uq_platform_conversion_dispatches_event on platform_conversion_dispatches (event_id, mapping_id, channel);
create unique index uq_platform_web_analytics_daily_dims on platform_web_analytics_daily (day, site, path, coalesce(agency_id, '00000000-0000-0000-0000-000000000000'::uuid), source, medium, campaign, device, country);
create unique index uq_platform_blog_posts_payload_id on platform_blog_posts (payload_id) where payload_id is not null;
create unique index uq_mkt_tracking_tags_tenant_id_code on mkt_tracking_tags (tenant_id, code);
create unique index uq_mkt_tracking_tags_provider_id on mkt_tracking_tags (tenant_id, provider, measurement_id) where measurement_id is not null and status <> 'rechazado';
create unique index uq_mkt_conversion_mappings_tag_event on mkt_conversion_mappings (tenant_id, tag_id, internal_event);
create unique index uq_mkt_conversion_dispatches_event on mkt_conversion_dispatches (tenant_id, event_id, mapping_id, channel);
create unique index uq_cms_web_analytics_daily_dims on cms_web_analytics_daily (tenant_id, day, path, source, medium, campaign, device, country);

-- ---------------------------------------------------------------- v2.10 · claves foráneas
alter table platform_tracking_tags add constraint fk_platform_tracking_tags_created_by foreign key (created_by) references platform_users (id);
alter table platform_tracking_tags add constraint fk_platform_tracking_tags_approved_by foreign key (approved_by) references platform_users (id);
alter table platform_conversion_mappings add constraint fk_platform_conversion_mappings_tag_id foreign key (tag_id) references platform_tracking_tags (id);
alter table platform_conversion_dispatches add constraint fk_platform_conversion_dispatches_mapping_id foreign key (mapping_id) references platform_conversion_mappings (id);
alter table platform_conversion_dispatches add constraint fk_platform_conversion_dispatches_agency_id foreign key (agency_id) references platform_showcase_agencies (id);
alter table platform_web_analytics_daily add constraint fk_platform_web_analytics_daily_agency_id foreign key (agency_id) references platform_showcase_agencies (id);
alter table mkt_tracking_tags add constraint fk_mkt_tracking_tags_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_tracking_tags add constraint fk_mkt_tracking_tags_created_by foreign key (created_by) references iam_users (id);
alter table mkt_tracking_tags add constraint fk_mkt_tracking_tags_approved_by foreign key (approved_by) references iam_users (id);
alter table mkt_conversion_mappings add constraint fk_mkt_conversion_mappings_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_conversion_mappings add constraint fk_mkt_conversion_mappings_tag_id foreign key (tag_id) references mkt_tracking_tags (id);
alter table mkt_conversion_dispatches add constraint fk_mkt_conversion_dispatches_tenant_id foreign key (tenant_id) references tenants (id);
alter table mkt_conversion_dispatches add constraint fk_mkt_conversion_dispatches_mapping_id foreign key (mapping_id) references mkt_conversion_mappings (id);
alter table mkt_conversion_dispatches add constraint fk_mkt_conversion_dispatches_order_id foreign key (order_id) references channel_ecom_orders (id);
alter table cms_web_analytics_daily add constraint fk_cms_web_analytics_daily_tenant_id foreign key (tenant_id) references tenants (id);

-- ---------------------------------------------------------------- v2.10 · índices
create index ix_platform_tracking_tags_status on platform_tracking_tags (site, status);
create index ix_platform_tracking_tags_created_by on platform_tracking_tags (created_by);
create index ix_platform_tracking_tags_approved_by on platform_tracking_tags (approved_by);
create index ix_platform_conversion_dispatches_mapping_id on platform_conversion_dispatches (mapping_id);
create index ix_platform_conversion_dispatches_status on platform_conversion_dispatches (status, occurred_at);
create index ix_platform_conversion_dispatches_agency_id on platform_conversion_dispatches (agency_id);
create index ix_platform_web_analytics_daily_day on platform_web_analytics_daily (site, day);
create index ix_platform_web_analytics_daily_agency_id on platform_web_analytics_daily (agency_id, day);
create index ix_mkt_tracking_tags_status on mkt_tracking_tags (tenant_id, status);
create index ix_mkt_tracking_tags_created_by on mkt_tracking_tags (created_by);
create index ix_mkt_tracking_tags_approved_by on mkt_tracking_tags (approved_by);
create index ix_mkt_conversion_mappings_tag_id on mkt_conversion_mappings (tag_id);
create index ix_mkt_conversion_dispatches_mapping_id on mkt_conversion_dispatches (mapping_id);
create index ix_mkt_conversion_dispatches_status on mkt_conversion_dispatches (tenant_id, status, occurred_at);
create index ix_mkt_conversion_dispatches_order_id on mkt_conversion_dispatches (order_id);
create index ix_cms_web_analytics_daily_day on cms_web_analytics_daily (tenant_id, day);

-- ---------------------------------------------------------------- v2.10 · triggers
create trigger trg_platform_tracking_tags_updated_at before update on platform_tracking_tags for each row execute function app_set_updated_at();
create trigger trg_platform_conversion_mappings_updated_at before update on platform_conversion_mappings for each row execute function app_set_updated_at();
create trigger trg_mkt_tracking_tags_updated_at before update on mkt_tracking_tags for each row execute function app_set_updated_at();
create trigger trg_mkt_conversion_mappings_updated_at before update on mkt_conversion_mappings for each row execute function app_set_updated_at();

-- ---------------------------------------------------------------- v2.10 · comentarios
comment on table platform_tracking_tags is '[Spec 24 §3.1] [Fase 3] Etiquetas de medición y publicidad de la vitrina y su blog (GA4, GTM, Google Ads, Meta Pixel, TikTok, Clarity, LinkedIn y scripts propios) con consentimiento, reglas de página y aprobación por otra persona.';
comment on table platform_conversion_mappings is '[Spec 24 §3.2] [Fase 3] Qué evento interno de la vitrina se envía a cada etiqueta, con nombre del proveedor, etiqueta de conversión de Google Ads y envío del lado del servidor.';
comment on table platform_conversion_dispatches is '[Spec 24 §3.3] [Fase 3] Registro de cada conversión enviada (navegador o servidor) con resultado, reintentos y deduplicación por event_id. Retención 90 días.';
comment on table platform_web_analytics_daily is '[Spec 24 §3.4] [Fase 3] Visitas agregadas por día de la vitrina y el blog (página, agencia, fuente, medio, campaña, dispositivo y país), sin datos personales.';
comment on table mkt_tracking_tags is '[Spec 24 §3.5] [Fase 3] Etiquetas de medición y publicidad del sitio de la agencia; los scripts propios exigen aprobación de otra persona y nunca cargan en el pago.';
comment on table mkt_conversion_mappings is '[Spec 24 §3.6] [Fase 3] Mapeo de eventos del sitio de la agencia (compra, lead, chat, boletín, WhatsApp) a eventos de cada proveedor.';
comment on table mkt_conversion_dispatches is '[Spec 24 §3.7] [Fase 3] Registro de conversiones enviadas desde el sitio de la agencia (Meta Conversions API, conversiones mejoradas de Google Ads, GA4 Measurement Protocol). Retención 90 días.';
comment on table cms_web_analytics_daily is '[Spec 24 §3.8] [Fase 3] Visitas agregadas por día del sitio de la agencia, calculadas desde channel_web_events y conteo sin cookies.';
