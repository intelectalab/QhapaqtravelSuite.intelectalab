<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table sys_booking_rules drop constraint if exists ck_sys_booking_rules_1;
            alter table sys_booking_rules add constraint ck_sys_booking_rules_1 check (is_custom or rule_group in ('Disponibilidad','Pasajeros','Alojamiento','Adicionales','Precios','Monedas y pagos','Checkout','Comunicación','Funciones del plan'));
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            alter table sys_booking_rules drop constraint if exists ck_sys_booking_rules_1;
            alter table sys_booking_rules add constraint ck_sys_booking_rules_1 check (is_custom or rule_group in ('Disponibilidad','Pasajeros','Alojamiento','Adicionales','Precios','Monedas y pagos','Checkout','Comunicación'));
            SQL);
    }
};
