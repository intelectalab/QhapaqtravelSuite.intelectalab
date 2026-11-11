<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table fin_treasury_settings add column if not exists payment_routing jsonb not null default '[]';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            alter table fin_treasury_settings drop column if exists payment_routing;
            SQL);
    }
};
