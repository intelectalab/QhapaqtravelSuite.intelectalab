<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            drop index if exists ix_ops_no_shows_receivable;

            alter table ops_no_shows
                drop column if exists receivable_id,
                drop column if exists charge_pct,
                drop column if exists charge_amount,
                drop column if exists charge_currency;

            update sys_settings set "values" = "values" - 'noshow_charge' where section = 'operations' and "values" ? 'noshow_charge';

            comment on table ops_no_shows is '[G3-28] Pasajero que no se presentó a un servicio, registrado desde la orden de operación o desde la app del operador al finalizar. Guarda los efectos que disparó: aviso al asesor e incidencia. Sin cargo automático (spec 05 §12 punto 5): la política de no-show solo impide el reembolso.';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            alter table ops_no_shows
                add column if not exists receivable_id uuid references fin_receivables(id),
                add column if not exists charge_pct smallint check (charge_pct is null or charge_pct between 0 and 100),
                add column if not exists charge_amount numeric(14, 2) check (charge_amount is null or charge_amount >= 0),
                add column if not exists charge_currency char(3);

            create index if not exists ix_ops_no_shows_receivable on ops_no_shows (receivable_id);
            SQL);
    }
};
