<?php

declare(strict_types=1);

/*
| GENERADO por kit-ia/ejemplos/tools/generar_migracion.py desde kit-ia/database/30_fase2.sql — NO editar a mano.
| Tabla: booking_reservations. Reproduce el SQL validado (columnas, CHECK, UNIQUE, FK, índices, triggers, comentarios).
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
            alter table booking_reservations add column ecom_order_id uuid;
            SQL);

        DB::statement(<<<'SQL'
            alter table booking_reservations add column b2b_terms jsonb;
            SQL);

        DB::statement(<<<'SQL'
            alter table booking_reservations add column cancel_request_id uuid;
            SQL);

        DB::statement(<<<'SQL'
            alter table booking_reservations add constraint fk_booking_reservations_agency_id foreign key (agency_id) references channel_b2b_agencies (id);
            SQL);

        DB::statement(<<<'SQL'
            alter table booking_reservations add constraint fk_booking_reservations_ecom_order_id foreign key (ecom_order_id) references channel_ecom_orders (id);
            SQL);

        DB::statement(<<<'SQL'
            alter table booking_reservations add constraint fk_booking_reservations_cancel_request_id foreign key (cancel_request_id) references booking_cancel_requests (id);
            SQL);

        DB::statement(<<<'SQL'
            create index ix_booking_reservations_agency_id on booking_reservations (agency_id);
            SQL);

        DB::statement(<<<'SQL'
            create index ix_booking_reservations_ecom_order_id on booking_reservations (ecom_order_id);
            SQL);

        DB::statement(<<<'SQL'
            create index ix_booking_reservations_cancel_request_id on booking_reservations (cancel_request_id);
            SQL);

        DB::statement(<<<'SQL'
            comment on column booking_reservations.ecom_order_id is 'Columnas agregadas en Fase 2 por spec 08 §3.15 + 10 §3.11';
            SQL);

        DB::statement(<<<'SQL'
            comment on column booking_reservations.b2b_terms is 'Columnas agregadas en Fase 2 por spec 08 §3.15 + 10 §3.11';
            SQL);

        DB::statement(<<<'SQL'
            comment on column booking_reservations.cancel_request_id is 'Columnas agregadas en Fase 2 por spec 08 §3.15 + 10 §3.11';
            SQL);
    }

    public function down(): void
    {
        // Las FKs de otras tablas hacia esta se crean (y se borran) en sus propias migraciones posteriores.
        DB::statement('alter table booking_reservations drop column if exists ecom_order_id');
        DB::statement('alter table booking_reservations drop column if exists b2b_terms');
        DB::statement('alter table booking_reservations drop column if exists cancel_request_id');
    }
};
