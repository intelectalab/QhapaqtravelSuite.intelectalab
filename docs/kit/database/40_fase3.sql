-- =============================================================================
-- Qhapaq Travel Suite · Esquema PostgreSQL 17 · 40_fase3.sql
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

