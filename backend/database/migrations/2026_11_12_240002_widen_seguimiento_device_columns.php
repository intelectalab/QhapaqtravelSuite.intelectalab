<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table cms_web_analytics_daily alter column device type varchar(12);
            alter table platform_web_analytics_daily alter column device type varchar(12);
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            alter table cms_web_analytics_daily alter column device type varchar(8);
            alter table platform_web_analytics_daily alter column device type varchar(8);
            SQL);
    }
};
