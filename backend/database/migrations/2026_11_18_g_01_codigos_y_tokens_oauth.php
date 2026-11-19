<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            create table if not exists integration_oauth_codes (
                id uuid not null default app_uuid_v7(),
                tenant_id uuid not null default app_current_tenant_id() references tenants (id),
                client_id uuid not null references oauth_clients (id),
                user_id uuid not null,
                code_hash char(64) not null,
                redirect_uri varchar(300) not null,
                scopes text[] not null default '{}',
                code_challenge varchar(128) not null,
                expires_at timestamptz not null,
                used_at timestamptz,
                created_at timestamptz not null default now(),
                constraint pk_integration_oauth_codes primary key (id),
                constraint uq_integration_oauth_codes_hash unique (code_hash),
                constraint fk_integration_oauth_codes_user foreign key (tenant_id, user_id) references iam_users (tenant_id, id)
            );

            create table if not exists integration_oauth_tokens (
                id uuid not null default app_uuid_v7(),
                tenant_id uuid not null default app_current_tenant_id() references tenants (id),
                client_id uuid not null references oauth_clients (id),
                code_id uuid references integration_oauth_codes (id),
                user_id uuid not null,
                access_hash char(64) not null,
                refresh_hash char(64) not null,
                scopes text[] not null default '{}',
                expires_at timestamptz not null,
                refresh_expires_at timestamptz not null,
                revoked_at timestamptz,
                last_used_at timestamptz,
                last_used_ip inet,
                created_at timestamptz not null default now(),
                constraint pk_integration_oauth_tokens primary key (id),
                constraint uq_integration_oauth_tokens_access unique (access_hash),
                constraint uq_integration_oauth_tokens_refresh unique (refresh_hash),
                constraint fk_integration_oauth_tokens_user foreign key (tenant_id, user_id) references iam_users (tenant_id, id)
            );

            create index if not exists ix_integration_oauth_codes_client on integration_oauth_codes (tenant_id, client_id);
            create index if not exists ix_integration_oauth_tokens_client on integration_oauth_tokens (tenant_id, client_id) where revoked_at is null;
            create index if not exists ix_integration_oauth_tokens_code on integration_oauth_tokens (code_id) where code_id is not null;

            select app_enable_tenant_rls('integration_oauth_codes');
            select app_enable_tenant_rls('integration_oauth_tokens');

            comment on table integration_oauth_codes is '[13 §3.14] Códigos de autorización OAuth (Authorization Code + PKCE S256). Se guarda solo el SHA-256 del código; vence a los 10 minutos y se usa una sola vez.';
            comment on table integration_oauth_tokens is '[13 §3.14] Tokens de acceso y de renovación emitidos a las apps OAuth del tenant. Solo se guardan sus SHA-256. Autentican al tenant con los permisos concedidos, como una llave de API.';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            drop table if exists integration_oauth_tokens cascade;
            drop table if exists integration_oauth_codes cascade;
            SQL);
    }
};
