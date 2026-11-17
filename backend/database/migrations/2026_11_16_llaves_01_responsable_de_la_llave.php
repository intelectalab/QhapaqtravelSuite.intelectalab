<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table integration_api_keys
                add column if not exists owner_mode varchar(20) not null default 'round_robin',
                add column if not exists owner_id uuid,
                add column if not exists owner_cursor uuid;

            alter table integration_api_keys drop constraint if exists integration_api_keys_owner_mode_check;
            alter table integration_api_keys add constraint integration_api_keys_owner_mode_check
                check (owner_mode in ('fixed', 'round_robin') and (owner_mode <> 'fixed' or owner_id is not null));

            alter table integration_api_keys drop constraint if exists fk_integration_api_keys_owner_id;
            alter table integration_api_keys add constraint fk_integration_api_keys_owner_id
                foreign key (tenant_id, owner_id) references iam_users (tenant_id, id);

            create index if not exists ix_integration_api_keys_owner_id on integration_api_keys (owner_id) where owner_id is not null;

            comment on column integration_api_keys.owner_mode is '[G6-02 · 16 nov] Responsable de lo que se crea por API sin asesor (clientes, cotizaciones y reservas): fixed = asesor fijo (owner_id), round_robin = reparto por turno entre asesores activos.';
            comment on column integration_api_keys.owner_id is '[G6-02 · 16 nov] Asesor fijo cuando owner_mode = fixed.';
            comment on column integration_api_keys.owner_cursor is '[G6-02 · 16 nov] Último asesor asignado en el reparto por turno.';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            drop index if exists ix_integration_api_keys_owner_id;
            alter table integration_api_keys drop constraint if exists fk_integration_api_keys_owner_id;
            alter table integration_api_keys drop constraint if exists integration_api_keys_owner_mode_check;
            alter table integration_api_keys
                drop column if exists owner_cursor,
                drop column if exists owner_id,
                drop column if exists owner_mode;
            SQL);
    }
};
