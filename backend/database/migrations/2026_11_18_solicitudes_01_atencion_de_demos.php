<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table platform_demo_requests
                add column if not exists notes text,
                add column if not exists handled_by uuid references platform_users(id),
                add column if not exists handled_at timestamptz;

            comment on column platform_demo_requests.notes is '[Ampliación v3.0] Nota interna del Super Admin al atender la solicitud (qué se conversó, por qué se descartó).';
            comment on column platform_demo_requests.handled_by is '[Ampliación v3.0] Usuario de plataforma que cambió el estado por última vez.';
            comment on column platform_demo_requests.handled_at is '[Ampliación v3.0] Cuándo se cambió el estado por última vez.';
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            alter table platform_demo_requests drop column if exists notes, drop column if exists handled_by, drop column if exists handled_at;
            SQL);
    }
};
