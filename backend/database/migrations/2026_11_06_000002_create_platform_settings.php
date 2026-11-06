<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            create table platform_settings (
                key varchar(40) not null,
                value jsonb not null default '{}'::jsonb,
                updated_by uuid references platform_users(id),
                lock_version integer not null default 0,
                updated_at timestamptz not null default now(),
                constraint pk_platform_settings primary key (key)
            );

            create index ix_platform_settings_updated_by on platform_settings (updated_by);

            alter table platform_settings disable row level security;
            revoke all on platform_settings from app_role;
            grant select, insert, update on platform_settings to platform_role;
            SQL);
    }

    public function down(): void
    {
        DB::statement('drop table if exists platform_settings cascade');
    }
};
