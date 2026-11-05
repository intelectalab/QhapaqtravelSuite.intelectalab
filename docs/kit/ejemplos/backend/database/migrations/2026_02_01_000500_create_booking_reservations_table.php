<?php

declare(strict_types=1);

/*
| GENERADO por kit-ia/ejemplos/tools/generar_migracion.py desde kit-ia/database/20_fase1.sql — NO editar a mano.
| Tabla: booking_reservations. Reproduce el SQL validado (columnas, CHECK, UNIQUE, FK, índices, triggers, comentarios) y su RLS.
| Se usa DB::statement porque el Schema Builder no expresa CHECK con listas, UNIQUE parciales, defaults con
| funciones (app_uuid_v7(), app_current_tenant_id()) ni triggers (database/README.md §6).
| Ejecutar con la conexión dueña del esquema: php artisan migrate --database=pgsql_owner
*/

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            create table booking_reservations (
              id uuid not null default app_uuid_v7(),
              tenant_id uuid not null default app_current_tenant_id(),
              code varchar(30) not null,
              quote_id uuid,
              quote_version_id uuid,
              quote_version_no smallint,
              client_id uuid not null,
              agency_id uuid,
              owner_id uuid not null,
              sede_id uuid not null,
              title varchar(200) not null,
              status varchar(30) not null default 'borrador' check (status in ('borrador', 'pendiente_disponibilidad', 'confirmada', 'pendiente_pago', 'pendiente_proveedor', 'reprogramada', 'parcial', 'incidencia', 'en_operacion', 'completada', 'cancelada')),
              channel varchar(15) not null default 'Directo' check (channel in ('Directo', 'Corporativo', 'B2B', 'E-commerce')),
              travel_from date not null,
              travel_to date not null,
              currency char(3) not null check (currency in ('PEN','USD')),
              fx_rate numeric(12,6) not null,
              total_amount numeric(14,2) not null default 0,
              snapshot_label varchar(300) not null,
              catalog_snapshot jsonb,
              policies_snapshot jsonb not null default '{}',
              notes text,
              rescheduled_at timestamptz,
              cancelled_at timestamptz,
              cancel_reason text,
              penalty_amount numeric(14,2),
              refund_amount numeric(14,2),
              lock_version integer not null default 0,
              created_by uuid,
              updated_by uuid,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now(),
              deleted_at timestamptz,
              constraint pk_booking_reservations primary key (id),
              constraint ck_booking_reservations_1 check (travel_to >= travel_from),
              constraint ck_booking_reservations_2 check (status <> 'cancelada' or cancelled_at is not null)
            );
            SQL);

        DB::statement(<<<'SQL'
            create unique index uq_booking_reservations_tenant_id_code on booking_reservations (tenant_id, code);
            SQL);

        DB::statement(<<<'SQL'
            create unique index uq_booking_reservations_tenant_id_quote_id_p on booking_reservations (tenant_id, quote_id) where quote_id is not null;
            SQL);

        DB::statement(<<<'SQL'
            alter table booking_reservations add constraint fk_booking_reservations_tenant_id foreign key (tenant_id) references tenants (id);
            SQL);

        DB::statement(<<<'SQL'
            alter table booking_reservations add constraint fk_booking_reservations_quote_id foreign key (quote_id) references quote_quotes (id);
            SQL);

        DB::statement(<<<'SQL'
            alter table booking_reservations add constraint fk_booking_reservations_quote_version_id foreign key (quote_version_id) references quote_versions (id);
            SQL);

        DB::statement(<<<'SQL'
            alter table booking_reservations add constraint fk_booking_reservations_client_id foreign key (client_id) references crm_clients (id);
            SQL);

        DB::statement(<<<'SQL'
            alter table booking_reservations add constraint fk_booking_reservations_owner_id foreign key (owner_id) references iam_users (id);
            SQL);

        DB::statement(<<<'SQL'
            alter table booking_reservations add constraint fk_booking_reservations_sede_id foreign key (sede_id) references iam_sedes (id);
            SQL);

        DB::statement(<<<'SQL'
            create index ix_booking_reservations_tenant_id_status on booking_reservations (tenant_id, status);
            SQL);

        DB::statement(<<<'SQL'
            create index ix_booking_reservations_tenant_id_owner_id on booking_reservations (tenant_id, owner_id);
            SQL);

        DB::statement(<<<'SQL'
            create index ix_booking_reservations_tenant_id_client_id on booking_reservations (tenant_id, client_id);
            SQL);

        DB::statement(<<<'SQL'
            create index ix_booking_reservations_tenant_id_travel_from on booking_reservations (tenant_id, travel_from);
            SQL);

        DB::statement(<<<'SQL'
            create index ix_booking_reservations_tenant_id_created_at_desc on booking_reservations (tenant_id, created_at desc);
            SQL);

        DB::statement(<<<'SQL'
            create index ix_booking_reservations_quote_id on booking_reservations (quote_id);
            SQL);

        DB::statement(<<<'SQL'
            create index ix_booking_reservations_quote_version_id on booking_reservations (quote_version_id);
            SQL);

        DB::statement(<<<'SQL'
            create index ix_booking_reservations_client_id on booking_reservations (client_id);
            SQL);

        DB::statement(<<<'SQL'
            create index ix_booking_reservations_owner_id on booking_reservations (owner_id);
            SQL);

        DB::statement(<<<'SQL'
            create index ix_booking_reservations_sede_id on booking_reservations (sede_id);
            SQL);

        DB::statement(<<<'SQL'
            create trigger trg_booking_reservations_updated_at before update on booking_reservations for each row execute function app_set_updated_at();
            SQL);

        DB::statement(<<<'SQL'
            create trigger trg_booking_reservations_lock_version before update on booking_reservations for each row execute function app_bump_lock_version();
            SQL);

        DB::statement(<<<'SQL'
            comment on table booking_reservations is '[Spec 04 §3] [Fase 1] Reserva.';
            SQL);

        // RLS en la MISMA migración (02-ARQUITECTURA §8): ENABLE + FORCE + tenant_isolation (strict) + platform_access.
        DB::statement("select app_enable_tenant_rls('booking_reservations', 'strict')");
    }

    public function down(): void
    {
        // Las FKs de otras tablas hacia esta se crean (y se borran) en sus propias migraciones posteriores.
        DB::statement('drop table if exists booking_reservations');
    }
};
