<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            create table if not exists integration_vault_secrets (
                id uuid not null default app_uuid_v7(),
                tenant_id uuid not null default app_current_tenant_id() references tenants (id),
                reference varchar(300) not null,
                kind varchar(16) not null check (kind in ('pasarela', 'seguimiento')),
                payload text not null,
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                constraint pk_integration_vault_secrets primary key (id),
                constraint uq_integration_vault_secrets_reference unique (tenant_id, reference)
            );

            select app_enable_tenant_rls('integration_vault_secrets');

            comment on table integration_vault_secrets is 'Bóveda de secretos de la agencia: credenciales de pasarelas de pago y tokens de seguimiento del lado del servidor. El contenido se guarda cifrado con la clave de la aplicación y nunca se devuelve por la API.';

            create table if not exists platform_vault_secrets (
                id uuid not null default app_uuid_v7(),
                reference varchar(300) not null,
                kind varchar(16) not null check (kind in ('seguimiento')),
                payload text not null,
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                constraint pk_platform_vault_secrets primary key (id),
                constraint uq_platform_vault_secrets_reference unique (reference)
            );

            alter table platform_vault_secrets disable row level security;
            revoke all on platform_vault_secrets from app_role;
            grant select, insert, update on platform_vault_secrets to platform_role;

            comment on table platform_vault_secrets is 'Bóveda de secretos de la plataforma: tokens de seguimiento del lado del servidor de la vitrina, su blog y la landing. Cifrados con la clave de la aplicación.';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            drop table if exists platform_vault_secrets;
            drop table if exists integration_vault_secrets;
            SQL);
    }
};
