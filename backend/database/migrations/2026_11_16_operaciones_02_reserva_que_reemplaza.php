<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table booking_reservations
                add column if not exists replaces_reservation_id uuid references booking_reservations(id);

            create unique index if not exists uq_booking_reservations_replaces on booking_reservations (replaces_reservation_id) where replaces_reservation_id is not null;

            comment on column booking_reservations.replaces_reservation_id is '[G7-24 · 16 nov] Reserva cancelada a la que reemplaza: se crea con «Recrear la reserva» cuando el pago de un pedido web llegó después de la cancelación (spec 04: cancelada es terminal).';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            drop index if exists uq_booking_reservations_replaces;
            alter table booking_reservations drop column if exists replaces_reservation_id;
            SQL);
    }
};
