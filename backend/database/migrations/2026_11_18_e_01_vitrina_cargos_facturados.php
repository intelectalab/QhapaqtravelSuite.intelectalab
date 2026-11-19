<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table platform_showcase_bookings
                add column if not exists invoice_id uuid references platform_invoices(id);

            create index if not exists ix_platform_showcase_bookings_invoice_id on platform_showcase_bookings (invoice_id);

            comment on column platform_showcase_bookings.invoice_id is '[Ampliación v3.0] Factura de la plataforma que cobró el cargo de esta reserva (VT-03, ShowcaseMonthlyFees). Nula mientras el cargo está por facturar.';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            drop index if exists ix_platform_showcase_bookings_invoice_id;
            alter table platform_showcase_bookings drop column if exists invoice_id;
            SQL);
    }
};
