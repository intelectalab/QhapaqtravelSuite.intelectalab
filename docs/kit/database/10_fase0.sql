-- =============================================================================
-- Qhapaq Travel Suite · Esquema PostgreSQL 17 · 10_fase0.sql
-- Fase 0 · Fundaciones
-- Generado desde §3 de las especificaciones 00–18 + CONVENCIONES.md (fuente de verdad del kit).
-- Tablas nuevas: 24. Requiere: 00_extensions_and_functions.sql y archivos previos.
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------- tablas
create table iam_sedes (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  name varchar(120) not null,
  city varchar(80),
  address varchar(250) not null,
  phone varchar(30),
  manager_user_id uuid,
  status varchar(20) not null default 'activa' check (status in ('activa', 'inactiva')),
  is_main boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_iam_sedes primary key (id)
);

create table iam_users (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20),
  name varchar(150) not null,
  email varchar(190) not null,
  password varchar(255),
  phone varchar(30),
  sede_id uuid not null,
  status varchar(20) not null default 'pendiente' check (status in ('pendiente', 'activo', 'inactivo')),
  mfa_enabled boolean not null default false,
  mfa_required boolean not null default false,
  last_login_at timestamptz,
  last_login_ip inet,
  avatar_color char(7),
  client_id uuid,
  agency_id uuid,
  provider_id uuid,
  guide_id uuid,
  driver_id uuid,
  reservation_id uuid,
  invited_at timestamptz,
  invited_by uuid,
  deactivated_at timestamptz,
  deactivated_reason text,
  locale varchar(10),
  remember_token varchar(100),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_iam_users primary key (id)
);

create table iam_mfa_factors (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  user_id uuid not null,
  type varchar(10) not null default 'totp' check (type in ('totp')),
  secret text not null,
  confirmed_at timestamptz,
  recovery_codes jsonb not null default '[]',
  last_used_step bigint,
  created_at timestamptz not null default now(),
  constraint pk_iam_mfa_factors primary key (id)
);

create table personal_access_tokens (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid default app_current_tenant_id(),
  tokenable_type varchar(255) not null,
  tokenable_id uuid not null,
  name varchar(255) not null,
  token varchar(64) not null,
  abilities text,
  last_used_at timestamptz,
  expires_at timestamptz,
  experience varchar(20) not null check (experience in ('backoffice', 'portal', 'mobile', 'platform')),
  mfa_verified_at timestamptz,
  device_name varchar(120),
  ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_personal_access_tokens primary key (id)
);

create table roles (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid default app_current_tenant_id(),
  name varchar(125) not null,
  guard_name varchar(125) not null default 'api',
  display_name varchar(120) not null,
  description varchar(250),
  scope varchar(10) not null check (scope in ('tenant', 'mobile', 'canal')),
  is_custom boolean not null default false,
  experience varchar(20) not null check (experience in ('backoffice', 'portal', 'mobile')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_roles primary key (id)
);

create table role_has_permissions (
  permission_id uuid not null,
  role_id uuid not null,
  constraint pk_role_has_permissions primary key (permission_id, role_id)
);

create table model_has_roles (
  tenant_id uuid not null default app_current_tenant_id(),
  role_id uuid not null,
  model_type varchar(255) not null,
  model_id uuid not null,
  constraint pk_model_has_roles primary key (tenant_id, role_id, model_id, model_type)
);

create table model_has_permissions (
  tenant_id uuid not null default app_current_tenant_id(),
  permission_id uuid not null,
  model_type varchar(255) not null,
  model_id uuid not null,
  constraint pk_model_has_permissions primary key (tenant_id, permission_id, model_id, model_type)
);

create table audit_events (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid default app_current_tenant_id(),
  code bigint not null,
  actor_type varchar(20) not null check (actor_type in ('user', 'platform_user', 'system', 'api_client')),
  actor_id uuid,
  actor_role varchar(60),
  entity varchar(40) not null,
  entity_id varchar(80) not null,
  action varchar(40) not null,
  is_critical boolean not null default false,
  before_value text,
  after_value text,
  diff jsonb,
  ip inet,
  user_agent varchar(250),
  correlation_id varchar(40) not null,
  evidence jsonb,
  occurred_at timestamptz not null default now(),
  constraint pk_audit_events primary key (id, occurred_at)
) partition by range (occurred_at);

do $$ begin perform app_create_monthly_partitions('audit_events', date '2026-01-01', 24); end $$;

create table sys_sequences (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  doc_type varchar(60) not null,
  label varchar(60) not null,
  series varchar(10) not null default 'default',
  prefix varchar(30) not null,
  pad_width smallint not null default 5,
  next_number bigint not null default 1 check (next_number > 0),
  year_reset boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint pk_sys_sequences primary key (id)
);

create table sys_idempotency_keys (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid default app_current_tenant_id(),
  key varchar(80) not null,
  user_id uuid,
  method varchar(10) not null,
  path varchar(250) not null,
  request_hash char(64) not null,
  status varchar(20) not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  response_code smallint,
  response_body jsonb,
  locked_until timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint pk_sys_idempotency_keys primary key (id)
);

create table sys_outbox (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid default app_current_tenant_id(),
  aggregate_type varchar(40) not null,
  aggregate_id uuid not null,
  event varchar(80) not null,
  payload jsonb not null,
  status varchar(20) not null default 'pending' check (status in ('pending', 'dispatched', 'failed')),
  attempts smallint not null default 0,
  available_at timestamptz not null default now(),
  dispatched_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pk_sys_outbox primary key (id)
);

create table iam_access_requests (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  user_id uuid not null,
  path varchar(250) not null,
  required_permissions text[] not null default '{}',
  status varchar(20) not null default 'pendiente' check (status in ('pendiente', 'atendida', 'rechazada')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_iam_access_requests primary key (id)
);

create table iam_user_invitations (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  user_id uuid not null,
  token_hash char(64) not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  require_mfa boolean not null default true,
  invited_by uuid not null,
  resent_count smallint not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_iam_user_invitations primary key (id)
);

create table sys_settings (
  tenant_id uuid not null default app_current_tenant_id(),
  section varchar(30) not null check (section in ('general', 'currency', 'policies', 'operations', 'channels', 'notifications', 'travel_docs', 'ecommerce', 'own_reviews', 'rules')),
  values jsonb not null default '{}',
  updated_by uuid,
  updated_at timestamptz not null default now(),
  lock_version integer not null default 0,
  constraint pk_sys_settings primary key (tenant_id, section)
);

create table notif_event_rules (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  event_code varchar(50) not null,
  label varchar(80) not null,
  ch_email boolean not null default false,
  ch_whatsapp boolean not null default false,
  ch_push boolean not null default false,
  ch_portal boolean not null default false,
  recipients varchar(200) not null,
  timing varchar(20) not null default 'immediate' check (timing in ('immediate', 'batch_15m', 'business_hours')),
  condition varchar(30) not null default 'always' check (condition in ('always', 'marketing_consent', 'amount_gt_5000')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_notif_event_rules primary key (id),
  constraint ck_notif_event_rules_1 check (event_code <> 'incidencia.critica' or (ch_email or ch_whatsapp or ch_push or ch_portal))
);

create table notif_templates (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid default app_current_tenant_id(),
  event_code varchar(50) not null,
  channel varchar(20) not null check (channel in ('email', 'whatsapp', 'push')),
  version integer not null default 1 check (version >= 1),
  subject varchar(200) not null,
  body text not null,
  is_current boolean not null default true,
  provider_template_id varchar(120),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_notif_templates primary key (id),
  constraint ck_notif_templates_1 check (channel <> 'push' or char_length(body) <= 140)
);

create table notif_messages (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30),
  event_code varchar(50) not null,
  channel varchar(20) not null check (channel in ('email', 'whatsapp', 'push', 'portal')),
  recipient_user_id uuid,
  recipient_address varchar(190),
  subject varchar(200) not null,
  body_rendered text,
  template_id uuid,
  source_type varchar(40),
  source_id uuid,
  client_id uuid,
  reservation_id uuid,
  audience varchar(20) not null default 'internal' check (audience in ('internal', 'client', 'passenger', 'agency', 'provider')),
  status varchar(20) not null default 'pendiente' check (status in ('pendiente', 'enviado', 'fallido')),
  retries smallint not null default 0,
  last_error text,
  is_fallback boolean not null default false,
  fallback_of_id uuid,
  read_at timestamptz,
  provider_message_id varchar(120),
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_notif_messages primary key (id)
);

create table notif_reads (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  notification_id uuid not null,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  constraint pk_notif_reads primary key (id)
);

create table sys_documents (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  doc_type varchar(40) not null,
  entity_type varchar(40),
  entity_id uuid,
  version integer not null default 1,
  storage_disk varchar(20) not null default 's3',
  storage_path varchar(400) not null,
  file_name varchar(200) not null,
  mime_type varchar(100) not null,
  size_bytes bigint not null default 0,
  sha256 char(64) not null,
  generated_by_job varchar(150),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_sys_documents primary key (id)
);

create table integration_adapters (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid default app_current_tenant_id(),
  code varchar(20) not null,
  name varchar(120) not null,
  kind varchar(30) not null check (kind in ('fiscal', 'payments', 'email', 'messaging', 'maps', 'suppliers', 'distribution')),
  status varchar(20) not null default 'por_validar' check (status in ('activo', 'por_validar', 'sandbox', 'parcial', 'futuro')),
  environment varchar(20) not null default 'sandbox' check (environment in ('sandbox', 'production')),
  owner_user_id uuid,
  max_retries smallint not null default 5 check (max_retries between 0 and 10),
  backoff_base_s integer not null default 60 check (backoff_base_s >= 5),
  timeout_s integer not null default 30 check (timeout_s between 5 and 120),
  secret_ref varchar(200),
  secret_rotated_at timestamptz,
  note text,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_result varchar(250),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_integration_adapters primary key (id)
);

create table sys_scheduled_jobs (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid default app_current_tenant_id(),
  code varchar(20) not null,
  name varchar(150) not null,
  job_class varchar(150) not null,
  cron varchar(60) not null,
  cron_label varchar(60) not null,
  queue varchar(20) not null default 'default' check (queue in ('critical', 'default', 'notifications', 'documents', 'integrations', 'reports', 'low')),
  paused boolean not null default false,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_status varchar(20) check (last_status is null or last_status in ('ok', 'advertencia', 'error', 'en_curso')),
  last_result varchar(250),
  report_key varchar(60),
  report_format varchar(10) check (report_format is null or report_format in ('PDF', 'XLSX', 'CSV')),
  recipients text,
  owner_user_id uuid,
  is_system boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_sys_scheduled_jobs primary key (id)
);

create table sys_job_runs (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid default app_current_tenant_id(),
  scheduled_job_id uuid,
  job_class varchar(150),
  trigger varchar(20) not null check (trigger in ('schedule', 'manual', 'retry')),
  triggered_by uuid,
  status varchar(20) not null default 'en_curso' check (status in ('en_curso', 'ok', 'advertencia', 'error')),
  result varchar(250),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  attempt smallint not null default 1,
  correlation_id varchar(40),
  constraint pk_sys_job_runs primary key (id)
);

create table integration_errors (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid default app_current_tenant_id(),
  code varchar(20),
  source varchar(20) not null check (source in ('job', 'notification', 'integration')),
  ref_code varchar(30) not null,
  target varchar(150) not null,
  error text not null,
  error_class varchar(20) not null check (error_class in ('transitorio', 'permanente')),
  attempt smallint not null default 0,
  max_attempts smallint not null default 5,
  next_retry_at timestamptz,
  status varchar(20) not null default 'reintentando' check (status in ('reintentando', 'fallo_definitivo', 'resuelto')),
  resolution text,
  resolved_by uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_integration_errors primary key (id)
);


-- ---------------------------------------------------------------- unicidad (índices únicos, incluidos parciales)
create unique index uq_iam_sedes_tenant_id_code on iam_sedes (tenant_id, code);
create unique index uq_iam_sedes_tenant_id_lower_name on iam_sedes (tenant_id, lower(name));
create unique index uq_iam_sedes_tenant_id_p on iam_sedes (tenant_id) where is_main;
create unique index uq_iam_users_tenant_id_code_p on iam_users (tenant_id, code) where code is not null;
create unique index uq_iam_users_tenant_id_lower_email on iam_users (tenant_id, lower(email));
create unique index uq_iam_mfa_factors_user_id on iam_mfa_factors (user_id);
create unique index uq_personal_access_tokens_token on personal_access_tokens (token);
create unique index uq_roles_tenant_id_name_guard_name_p on roles (tenant_id, name, guard_name) nulls not distinct;
create unique index uq_sys_sequences_tenant_id_doc_type_series on sys_sequences (tenant_id, doc_type, series);
create unique index uq_sys_idempotency_keys_tenant_id_key_p on sys_idempotency_keys (tenant_id, key) nulls not distinct;
create unique index uq_iam_user_invitations_token_hash on iam_user_invitations (token_hash);
create unique index uq_notif_event_rules_tenant_id_event_code on notif_event_rules (tenant_id, event_code);
create unique index uq_notif_templates_tenant_id_event_code_channel_p on notif_templates (tenant_id, event_code, channel) nulls not distinct where is_current;
create unique index uq_notif_templates_tenant_id_event_code_channel_version_p on notif_templates (tenant_id, event_code, channel, version) nulls not distinct;
create unique index uq_notif_reads_notification_id_user_id on notif_reads (notification_id, user_id);
create unique index uq_integration_adapters_tenant_id_code_p on integration_adapters (tenant_id, code) nulls not distinct;
create unique index uq_sys_scheduled_jobs_tenant_id_code_p on sys_scheduled_jobs (tenant_id, code) nulls not distinct;

-- ---------------------------------------------------------------- claves foráneas
alter table iam_sedes add constraint fk_iam_sedes_tenant_id foreign key (tenant_id) references tenants (id);
alter table iam_sedes add constraint fk_iam_sedes_manager_user_id foreign key (manager_user_id) references iam_users (id);
alter table iam_users add constraint fk_iam_users_tenant_id foreign key (tenant_id) references tenants (id);
alter table iam_users add constraint fk_iam_users_sede_id foreign key (sede_id) references iam_sedes (id);
alter table iam_users add constraint fk_iam_users_invited_by foreign key (invited_by) references iam_users (id);
alter table iam_mfa_factors add constraint fk_iam_mfa_factors_tenant_id foreign key (tenant_id) references tenants (id);
alter table iam_mfa_factors add constraint fk_iam_mfa_factors_user_id foreign key (user_id) references iam_users (id);
alter table personal_access_tokens add constraint fk_personal_access_tokens_tenant_id foreign key (tenant_id) references tenants (id);
alter table roles add constraint fk_roles_tenant_id foreign key (tenant_id) references tenants (id);
alter table role_has_permissions add constraint fk_role_has_permissions_permission_id foreign key (permission_id) references permissions (id) on delete cascade;
alter table role_has_permissions add constraint fk_role_has_permissions_role_id foreign key (role_id) references roles (id) on delete cascade;
alter table model_has_roles add constraint fk_model_has_roles_tenant_id foreign key (tenant_id) references tenants (id);
alter table model_has_roles add constraint fk_model_has_roles_role_id foreign key (role_id) references roles (id) on delete cascade;
alter table model_has_permissions add constraint fk_model_has_permissions_tenant_id foreign key (tenant_id) references tenants (id);
alter table model_has_permissions add constraint fk_model_has_permissions_permission_id foreign key (permission_id) references permissions (id) on delete cascade;
alter table audit_events add constraint fk_audit_events_tenant_id foreign key (tenant_id) references tenants (id);
alter table sys_sequences add constraint fk_sys_sequences_tenant_id foreign key (tenant_id) references tenants (id);
alter table sys_idempotency_keys add constraint fk_sys_idempotency_keys_tenant_id foreign key (tenant_id) references tenants (id);
alter table sys_idempotency_keys add constraint fk_sys_idempotency_keys_user_id foreign key (user_id) references iam_users (id);
alter table sys_outbox add constraint fk_sys_outbox_tenant_id foreign key (tenant_id) references tenants (id);
alter table iam_access_requests add constraint fk_iam_access_requests_tenant_id foreign key (tenant_id) references tenants (id);
alter table iam_access_requests add constraint fk_iam_access_requests_user_id foreign key (user_id) references iam_users (id);
alter table iam_access_requests add constraint fk_iam_access_requests_resolved_by foreign key (resolved_by) references iam_users (id);
alter table iam_user_invitations add constraint fk_iam_user_invitations_tenant_id foreign key (tenant_id) references tenants (id);
alter table iam_user_invitations add constraint fk_iam_user_invitations_user_id foreign key (user_id) references iam_users (id);
alter table iam_user_invitations add constraint fk_iam_user_invitations_invited_by foreign key (invited_by) references iam_users (id);
alter table sys_settings add constraint fk_sys_settings_tenant_id foreign key (tenant_id) references tenants (id);
alter table notif_event_rules add constraint fk_notif_event_rules_tenant_id foreign key (tenant_id) references tenants (id);
alter table notif_templates add constraint fk_notif_templates_tenant_id foreign key (tenant_id) references tenants (id);
alter table notif_messages add constraint fk_notif_messages_tenant_id foreign key (tenant_id) references tenants (id);
alter table notif_messages add constraint fk_notif_messages_recipient_user_id foreign key (recipient_user_id) references iam_users (id);
alter table notif_messages add constraint fk_notif_messages_template_id foreign key (template_id) references notif_templates (id);
alter table notif_messages add constraint fk_notif_messages_fallback_of_id foreign key (fallback_of_id) references notif_messages (id);
alter table notif_reads add constraint fk_notif_reads_tenant_id foreign key (tenant_id) references tenants (id);
alter table notif_reads add constraint fk_notif_reads_notification_id foreign key (notification_id) references notif_messages (id) on delete cascade;
alter table notif_reads add constraint fk_notif_reads_user_id foreign key (user_id) references iam_users (id);
alter table sys_documents add constraint fk_sys_documents_tenant_id foreign key (tenant_id) references tenants (id);
alter table integration_adapters add constraint fk_integration_adapters_tenant_id foreign key (tenant_id) references tenants (id);
alter table integration_adapters add constraint fk_integration_adapters_owner_user_id foreign key (owner_user_id) references iam_users (id);
alter table sys_scheduled_jobs add constraint fk_sys_scheduled_jobs_tenant_id foreign key (tenant_id) references tenants (id);
alter table sys_scheduled_jobs add constraint fk_sys_scheduled_jobs_owner_user_id foreign key (owner_user_id) references iam_users (id);
alter table sys_job_runs add constraint fk_sys_job_runs_tenant_id foreign key (tenant_id) references tenants (id);
alter table sys_job_runs add constraint fk_sys_job_runs_scheduled_job_id foreign key (scheduled_job_id) references sys_scheduled_jobs (id);
alter table sys_job_runs add constraint fk_sys_job_runs_triggered_by foreign key (triggered_by) references iam_users (id);
alter table integration_errors add constraint fk_integration_errors_tenant_id foreign key (tenant_id) references tenants (id);
alter table integration_errors add constraint fk_integration_errors_resolved_by foreign key (resolved_by) references iam_users (id);

-- ---------------------------------------------------------------- índices (FK, listados, búsquedas)
create index ix_iam_sedes_tenant_id_status on iam_sedes (tenant_id, status);
create index ix_iam_users_tenant_id_status on iam_users (tenant_id, status);
create index ix_iam_users_tenant_id_sede_id on iam_users (tenant_id, sede_id);
create index ix_personal_access_tokens_tokenable_type_tokenable_id on personal_access_tokens (tokenable_type, tokenable_id);
create index ix_personal_access_tokens_tenant_id on personal_access_tokens (tenant_id);
create index ix_role_has_permissions_role_id on role_has_permissions (role_id);
create index ix_model_has_roles_model_id_model_type on model_has_roles (model_id, model_type);
create index ix_model_has_permissions_model_id_model_type on model_has_permissions (model_id, model_type);
create index ix_audit_events_tenant_id_occurred_at_desc on audit_events (tenant_id, occurred_at desc);
create index ix_audit_events_tenant_id_entity_entity_id on audit_events (tenant_id, entity, entity_id);
create index ix_audit_events_tenant_id_actor_id on audit_events (tenant_id, actor_id);
create index ix_audit_events_correlation_id on audit_events (correlation_id);
create index ix_audit_events_tenant_id_action on audit_events (tenant_id, action);
create index ix_sys_idempotency_keys_expires_at on sys_idempotency_keys (expires_at);
create index ix_sys_outbox_status_available_at_p on sys_outbox (status, available_at) where status = 'pending';
create index ix_sys_outbox_aggregate_type_aggregate_id on sys_outbox (aggregate_type, aggregate_id);
create index ix_iam_access_requests_tenant_id_status on iam_access_requests (tenant_id, status);
create index ix_notif_messages_tenant_id_status on notif_messages (tenant_id, status);
create index ix_notif_messages_tenant_id_created_at_desc on notif_messages (tenant_id, created_at desc);
create index ix_notif_messages_tenant_id_recipient_user_id_read_at on notif_messages (tenant_id, recipient_user_id, read_at);
create index ix_notif_messages_tenant_id_source_type_source_id on notif_messages (tenant_id, source_type, source_id);
create index ix_sys_documents_tenant_id_entity_type_entity_id on sys_documents (tenant_id, entity_type, entity_id);
create index ix_sys_documents_tenant_id_sha256 on sys_documents (tenant_id, sha256);
create index ix_sys_job_runs_scheduled_job_id_started_at_desc on sys_job_runs (scheduled_job_id, started_at desc);
create index ix_sys_job_runs_tenant_id_status on sys_job_runs (tenant_id, status);
create index ix_integration_errors_tenant_id_status on integration_errors (tenant_id, status);
create index ix_iam_sedes_tenant_id_created_at_desc on iam_sedes (tenant_id, created_at desc);
create index ix_iam_users_tenant_id_created_at_desc on iam_users (tenant_id, created_at desc);
create index ix_sys_idempotency_keys_tenant_id_status on sys_idempotency_keys (tenant_id, status);
create index ix_sys_outbox_tenant_id_status on sys_outbox (tenant_id, status);
create index ix_integration_adapters_tenant_id_status on integration_adapters (tenant_id, status);
create index ix_integration_adapters_tenant_id_created_at_desc on integration_adapters (tenant_id, created_at desc);
create index ix_sys_scheduled_jobs_tenant_id_created_at_desc on sys_scheduled_jobs (tenant_id, created_at desc);
create index ix_integration_errors_tenant_id_created_at_desc on integration_errors (tenant_id, created_at desc);
create index ix_iam_sedes_manager_user_id on iam_sedes (manager_user_id);
create index ix_iam_users_sede_id on iam_users (sede_id);
create index ix_iam_users_invited_by on iam_users (invited_by);
create index ix_model_has_roles_role_id on model_has_roles (role_id);
create index ix_model_has_permissions_permission_id on model_has_permissions (permission_id);
create index ix_sys_idempotency_keys_user_id on sys_idempotency_keys (user_id);
create index ix_iam_access_requests_user_id on iam_access_requests (user_id);
create index ix_iam_access_requests_resolved_by on iam_access_requests (resolved_by);
create index ix_iam_user_invitations_user_id on iam_user_invitations (user_id);
create index ix_iam_user_invitations_invited_by on iam_user_invitations (invited_by);
create index ix_notif_messages_recipient_user_id on notif_messages (recipient_user_id);
create index ix_notif_messages_template_id on notif_messages (template_id);
create index ix_notif_messages_fallback_of_id on notif_messages (fallback_of_id);
create index ix_notif_reads_user_id on notif_reads (user_id);
create index ix_integration_adapters_owner_user_id on integration_adapters (owner_user_id);
create index ix_sys_scheduled_jobs_owner_user_id on sys_scheduled_jobs (owner_user_id);
create index ix_sys_job_runs_triggered_by on sys_job_runs (triggered_by);
create index ix_integration_errors_resolved_by on integration_errors (resolved_by);
create index ix_iam_mfa_factors_tenant_id on iam_mfa_factors (tenant_id);
create index ix_iam_user_invitations_tenant_id on iam_user_invitations (tenant_id);
create index ix_notif_reads_tenant_id on notif_reads (tenant_id);

-- ---------------------------------------------------------------- restricciones de exclusión y triggers específicos
create trigger trg_audit_events_append_only before update or delete on audit_events for each row execute function app_forbid_update_delete();
create trigger trg_sys_sequences_no_decrease before update on sys_sequences for each row execute function app_sequence_no_decrease();

-- ---------------------------------------------------------------- triggers de updated_at / lock_version
create trigger trg_iam_sedes_updated_at before update on iam_sedes for each row execute function app_set_updated_at();
create trigger trg_iam_users_updated_at before update on iam_users for each row execute function app_set_updated_at();
create trigger trg_personal_access_tokens_updated_at before update on personal_access_tokens for each row execute function app_set_updated_at();
create trigger trg_roles_updated_at before update on roles for each row execute function app_set_updated_at();
create trigger trg_sys_sequences_updated_at before update on sys_sequences for each row execute function app_set_updated_at();
create trigger trg_sys_settings_updated_at before update on sys_settings for each row execute function app_set_updated_at();
create trigger trg_sys_settings_lock_version before update on sys_settings for each row execute function app_bump_lock_version();
create trigger trg_notif_event_rules_updated_at before update on notif_event_rules for each row execute function app_set_updated_at();
create trigger trg_integration_adapters_updated_at before update on integration_adapters for each row execute function app_set_updated_at();
create trigger trg_sys_scheduled_jobs_updated_at before update on sys_scheduled_jobs for each row execute function app_set_updated_at();
create trigger trg_integration_errors_updated_at before update on integration_errors for each row execute function app_set_updated_at();

-- ---------------------------------------------------------------- comentarios (spec de origen)
comment on table iam_sedes is '[Spec 09 §3.6] [Fase 0] Sedes (sucursales) del tenant.';
comment on table iam_users is '[Spec 00 §3.2] [Fase 0] Usuarios del tenant (internos y externos: cliente, pasajero, B2B, proveedor, guía, conductor).';
comment on table iam_mfa_factors is '[Spec 00 §3.3] [Fase 0] Factor TOTP por usuario (secreto cifrado).';
comment on table personal_access_tokens is '[Spec 00 §3.4] [Fase 0] Tokens Sanctum extendidos. Sin RLS: se consultan antes de conocer el tenant (son la fuente del tenant).';
comment on table roles is '[Spec 00 §3.5] [Fase 0] Roles spatie con teams (tenant_id NULL = plantilla de sistema).';
comment on table role_has_permissions is '[Spec 00 §3.5] [Fase 0] Pivote rol-permiso (spatie). Sin tenant_id propio: se filtra vía `roles`.';
comment on table model_has_roles is '[Spec 00 §3.5] [Fase 0] Asignación de rol a usuario (un rol por usuario).';
comment on table model_has_permissions is '[Spec 00 §3.5] [Fase 0] Tabla del paquete spatie. NO se usa: prohibidos permisos directos a usuario (se crea por compatibilidad con la migración del paquete).';
comment on table audit_events is '[Spec 00 §3.6] [Fase 0] Bitácora append-only (PROC-063), particionada por mes.';
comment on table sys_sequences is '[Spec 00 §3.7] [Fase 0] Correlativos por tenant, tipo y serie (SELECT … FOR UPDATE).';
comment on table sys_idempotency_keys is '[Spec 00 §3.8] [Fase 0] Claves Idempotency-Key (TTL 24 h).';
comment on table sys_outbox is '[Spec 00 §3.9] [Fase 0] Outbox transaccional (fuente de webhooks e integraciones).';
comment on table iam_access_requests is '[Spec 00 §3.10] [Fase 0] Solicitudes de acceso desde la pantalla 403.';
comment on table iam_user_invitations is '[Spec 09 §3.7] [Fase 0] Invitaciones de usuario (token de un solo uso, 72 h).';
comment on table sys_settings is '[Spec 09 §3.8] [Fase 0] Configuración del tenant por sección (JSONB validado por FormRequest).';
comment on table notif_event_rules is '[Spec 09 §3.10] [Fase 0] Matriz evento × canal de notificaciones (PROC-059).';
comment on table notif_templates is '[Spec 09 §3.11] [Fase 0] Plantillas de notificación versionadas (tenant NULL = predeterminada del sistema).';
comment on table notif_messages is '[Spec 09 §3.12 + 05 §3.14 + 01 §3.12] [Fase 0] Log de notificaciones enviadas (campana, email, WhatsApp, push).';
comment on table notif_reads is '[Spec 05 §3.14] [Fase 0] Lecturas de notificación por usuario (app pasajero, campana).';
comment on table sys_documents is '[Spec CONVENCIONES §5 (supuesto)] [Fase 0] Documentos generados/subidos (PDF, XML, CDR, evidencias) versionados con hash. Referenciada por 03-12; ninguna spec la define: columnas supuestas.';
comment on table integration_adapters is '[Spec 09 §3.13] [Fase 0] Adaptadores de integración INT-01…07 (tenant NULL = compartido de plataforma).';
comment on table sys_scheduled_jobs is '[Spec 09 §3.14] [Fase 0] Jobs programados (JOB-01…) y reportes programados.';
comment on table sys_job_runs is '[Spec 09 §3.14 + CONVENCIONES §4] [Fase 0] Ejecuciones de jobs.';
comment on table integration_errors is '[Spec 09 §3.15] [Fase 0] Errores de jobs/notificaciones/integraciones (jobLog).';

