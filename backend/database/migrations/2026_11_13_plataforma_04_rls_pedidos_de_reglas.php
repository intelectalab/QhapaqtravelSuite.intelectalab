<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            select app_enable_tenant_rls('platform_rule_requests');
            revoke all on platform_rule_requests from app_role;
            grant select, insert, update on platform_rule_requests to platform_role;
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            drop policy if exists tenant_isolation on platform_rule_requests;
            drop policy if exists platform_access on platform_rule_requests;
            alter table platform_rule_requests no force row level security;
            alter table platform_rule_requests disable row level security;
            SQL);
    }
};
