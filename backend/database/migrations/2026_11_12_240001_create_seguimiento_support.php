<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table mkt_tracking_tags
                add column if not exists submitted_at timestamptz,
                add column if not exists verified_at timestamptz,
                add column if not exists verify_result varchar(12) check (verify_result is null or verify_result in ('ok', 'fallo')),
                add column if not exists verify_note varchar(300),
                add column if not exists revision jsonb check (revision is null or jsonb_typeof(revision) = 'object'),
                add column if not exists deleted_at timestamptz;

            alter table platform_tracking_tags
                add column if not exists submitted_at timestamptz,
                add column if not exists verified_at timestamptz,
                add column if not exists verify_result varchar(12) check (verify_result is null or verify_result in ('ok', 'fallo')),
                add column if not exists verify_note varchar(300),
                add column if not exists revision jsonb check (revision is null or jsonb_typeof(revision) = 'object'),
                add column if not exists deleted_at timestamptz;

            drop index if exists uq_mkt_tracking_tags_provider_id;
            create unique index uq_mkt_tracking_tags_provider_id on mkt_tracking_tags (tenant_id, provider, measurement_id) where measurement_id is not null and status <> 'rechazado' and deleted_at is null;
            drop index if exists uq_platform_tracking_tags_provider_id;
            create unique index uq_platform_tracking_tags_provider_id on platform_tracking_tags (site, provider, measurement_id) where measurement_id is not null and status <> 'rechazado' and deleted_at is null;

            create table if not exists cms_cookie_consents (
                tenant_id uuid not null default app_current_tenant_id() references tenants(id),
                id uuid not null default app_uuid_v7(),
                visitor_id uuid not null,
                policy_version varchar(20) not null,
                analytics boolean not null default false,
                marketing boolean not null default false,
                choice varchar(16) not null check (choice in ('aceptar_todo', 'rechazar', 'configurar')),
                ip_hash char(64),
                user_agent varchar(250),
                created_at timestamptz not null default now(),
                constraint pk_cms_cookie_consents primary key (id)
            );

            create index if not exists ix_cms_cookie_consents_visitor on cms_cookie_consents (tenant_id, visitor_id, created_at desc);
            select app_enable_tenant_rls('cms_cookie_consents');

            comment on table cms_cookie_consents is '[Spec 24 §5.2] Elección del banner de cookies del sitio de la agencia por visitante anónimo, con versión de la política. Habilita el envío de conversiones del lado del servidor (SEG-07).';

            create table if not exists platform_cookie_consents (
                id uuid not null default app_uuid_v7(),
                site varchar(12) not null check (site in ('vitrina', 'blog', 'landing')),
                visitor_id uuid not null,
                policy_version varchar(20) not null,
                analytics boolean not null default false,
                marketing boolean not null default false,
                choice varchar(16) not null check (choice in ('aceptar_todo', 'rechazar', 'configurar')),
                ip_hash char(64),
                user_agent varchar(250),
                created_at timestamptz not null default now(),
                constraint pk_platform_cookie_consents primary key (id)
            );

            create index if not exists ix_platform_cookie_consents_visitor on platform_cookie_consents (visitor_id, created_at desc);
            alter table platform_cookie_consents disable row level security;
            revoke all on platform_cookie_consents from app_role;
            grant select, insert on platform_cookie_consents to platform_role;

            comment on table platform_cookie_consents is '[Spec 24 §5.2] Elección del banner de cookies de la vitrina, su blog y la landing de KipuControl, por visitante anónimo y versión de la política.';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            drop table if exists platform_cookie_consents;
            drop table if exists cms_cookie_consents;
            drop index if exists uq_mkt_tracking_tags_provider_id;
            create unique index uq_mkt_tracking_tags_provider_id on mkt_tracking_tags (tenant_id, provider, measurement_id) where measurement_id is not null and status <> 'rechazado';
            drop index if exists uq_platform_tracking_tags_provider_id;
            create unique index uq_platform_tracking_tags_provider_id on platform_tracking_tags (site, provider, measurement_id) where measurement_id is not null and status <> 'rechazado';
            alter table mkt_tracking_tags drop column if exists submitted_at, drop column if exists verified_at, drop column if exists verify_result, drop column if exists verify_note, drop column if exists revision, drop column if exists deleted_at;
            alter table platform_tracking_tags drop column if exists submitted_at, drop column if exists verified_at, drop column if exists verify_result, drop column if exists verify_note, drop column if exists revision, drop column if exists deleted_at;
            SQL);
    }
};
