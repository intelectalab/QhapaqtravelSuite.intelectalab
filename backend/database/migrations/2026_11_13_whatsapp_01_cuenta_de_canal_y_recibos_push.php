<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table collab_channel_accounts
                add column if not exists connection_mode varchar(12) not null default 'plataforma' check (connection_mode in ('plataforma', 'propia')),
                add column if not exists waba_id_encrypted text,
                add column if not exists waba_id_hash char(64),
                add column if not exists display_phone varchar(30),
                add column if not exists connected_at timestamptz;

            create index if not exists ix_collab_channel_accounts_waba_id_hash on collab_channel_accounts (waba_id_hash) where waba_id_hash is not null;

            comment on column collab_channel_accounts.connection_mode is '[Decisión 12 nov] plataforma: número conectado con la app de KipuControl en Meta (registro guiado). propia: la agencia usa su propia app de Meta y su URL de aviso.';
            comment on column collab_channel_accounts.waba_id_encrypted is '[Decisión 12 nov] ID de la cuenta de WhatsApp Business (WABA), cifrado. Lo llena el registro guiado.';
            comment on column collab_channel_accounts.waba_id_hash is '[Decisión 12 nov] SHA-256 del ID de la WABA para encontrar la agencia en el aviso de revisión de plantillas.';

            create or replace function app_resolve_whatsapp_waba(p_hash varchar)
            returns table (tenant_id uuid, account_id uuid)
            language sql stable security definer set search_path = public as $q$
              select a.tenant_id, a.id from collab_channel_accounts a
              where a.channel = 'whatsapp' and a.waba_id_hash = p_hash
              limit 1
            $q$;
            alter function app_resolve_whatsapp_waba(varchar) owner to platform_role;
            comment on function app_resolve_whatsapp_waba(varchar) is 'Aviso de plantillas de WhatsApp: hash de la WABA → agencia y cuenta de canal.';

            create table if not exists ops_push_tickets (
                id uuid not null default app_uuid_v7(),
                tenant_id uuid not null default app_current_tenant_id() references tenants(id),
                device_id uuid,
                ticket_id varchar(80) not null,
                status varchar(12) not null default 'pendiente' check (status in ('pendiente', 'entregado', 'error', 'sin_recibo')),
                error varchar(120),
                checked_at timestamptz,
                created_at timestamptz not null default now(),
                constraint pk_ops_push_tickets primary key (id)
            );

            create unique index if not exists uq_ops_push_tickets_ticket on ops_push_tickets (tenant_id, ticket_id);
            create index if not exists ix_ops_push_tickets_pending on ops_push_tickets (tenant_id, status, created_at);
            select app_enable_tenant_rls('ops_push_tickets');

            comment on table ops_push_tickets is '[Decisión 13 nov] Tickets de Expo por cada push enviado. El job de recibos los consulta cada 15 minutos; DeviceNotRegistered desactiva el dispositivo.';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            drop table if exists ops_push_tickets;
            drop function if exists app_resolve_whatsapp_waba(varchar);
            drop index if exists ix_collab_channel_accounts_waba_id_hash;
            alter table collab_channel_accounts
                drop column if exists connection_mode,
                drop column if exists waba_id_encrypted,
                drop column if exists waba_id_hash,
                drop column if exists display_phone,
                drop column if exists connected_at;
            SQL);
    }
};
