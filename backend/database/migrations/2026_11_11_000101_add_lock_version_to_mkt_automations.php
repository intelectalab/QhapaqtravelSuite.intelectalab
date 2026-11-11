<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table mkt_automations add column if not exists lock_version integer not null default 0;
            drop trigger if exists trg_mkt_automations_lock_version on mkt_automations;
            create trigger trg_mkt_automations_lock_version before update on mkt_automations for each row execute function app_bump_lock_version();
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            drop trigger if exists trg_mkt_automations_lock_version on mkt_automations;
            alter table mkt_automations drop column if exists lock_version;
            SQL);
    }
};
