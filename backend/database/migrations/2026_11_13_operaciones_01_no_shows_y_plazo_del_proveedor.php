<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table catalog_providers
                add column if not exists response_sla_hours smallint check (response_sla_hours is null or response_sla_hours between 1 and 240);

            comment on column catalog_providers.response_sla_hours is '[G3-34] Plazo de respuesta del proveedor en horas. Si es nulo se usa el de Configuración › Operaciones (24 h por defecto).';

            create table if not exists ops_no_shows (
                tenant_id uuid not null default app_current_tenant_id() references tenants(id),
                id uuid not null default app_uuid_v7(),
                reservation_id uuid not null references booking_reservations(id),
                reservation_service_id uuid not null references booking_reservation_services(id),
                assignment_id uuid references ops_assignments(id),
                passenger_id uuid not null references booking_passengers(id),
                source varchar(16) not null check (source in ('web', 'app_operador')),
                recorded_at timestamptz not null default now(),
                note varchar(300),
                advisor_notified_at timestamptz,
                incident_id uuid references ops_incidents(id),
                receivable_id uuid references fin_receivables(id),
                charge_pct smallint check (charge_pct is null or charge_pct between 0 and 100),
                charge_amount numeric(14, 2) check (charge_amount is null or charge_amount >= 0),
                charge_currency char(3),
                voided_at timestamptz,
                voided_by uuid references iam_users(id),
                void_reason varchar(300),
                lock_version integer not null default 0,
                created_by uuid references iam_users(id),
                updated_by uuid references iam_users(id),
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                constraint pk_ops_no_shows primary key (id)
            );

            create unique index if not exists uq_ops_no_shows_service_passenger on ops_no_shows (tenant_id, reservation_service_id, passenger_id) where voided_at is null;
            create index if not exists ix_ops_no_shows_reservation on ops_no_shows (tenant_id, reservation_id);
            create index if not exists ix_ops_no_shows_recorded on ops_no_shows (tenant_id, recorded_at desc);
            create index if not exists ix_ops_no_shows_assignment on ops_no_shows (assignment_id);
            create index if not exists ix_ops_no_shows_passenger on ops_no_shows (passenger_id);
            create index if not exists ix_ops_no_shows_service on ops_no_shows (reservation_service_id);
            create index if not exists ix_ops_no_shows_incident on ops_no_shows (incident_id);
            create index if not exists ix_ops_no_shows_receivable on ops_no_shows (receivable_id);
            create index if not exists ix_ops_no_shows_voided_by on ops_no_shows (voided_by);
            create index if not exists ix_ops_no_shows_created_by on ops_no_shows (created_by);
            create index if not exists ix_ops_no_shows_updated_by on ops_no_shows (updated_by);
            select app_enable_tenant_rls('ops_no_shows');

            comment on table ops_no_shows is '[G3-28] Pasajero que no se presentó a un servicio, registrado desde la orden de operación o desde la app del operador al finalizar. Guarda los efectos que disparó: aviso al asesor, incidencia y cargo según la política del producto.';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            drop table if exists ops_no_shows;
            alter table catalog_providers drop column if exists response_sla_hours;
            SQL);
    }
};
