<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table mkt_segments add column if not exists lock_version integer not null default 0;
            drop trigger if exists trg_mkt_segments_lock_version on mkt_segments;
            create trigger trg_mkt_segments_lock_version before update on mkt_segments for each row execute function app_bump_lock_version();
            alter table mkt_templates add column if not exists lock_version integer not null default 0;
            drop trigger if exists trg_mkt_templates_lock_version on mkt_templates;
            create trigger trg_mkt_templates_lock_version before update on mkt_templates for each row execute function app_bump_lock_version();
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            drop trigger if exists trg_mkt_segments_lock_version on mkt_segments;
            alter table mkt_segments drop column if exists lock_version;
            drop trigger if exists trg_mkt_templates_lock_version on mkt_templates;
            alter table mkt_templates drop column if exists lock_version;
            SQL);
    }
};
