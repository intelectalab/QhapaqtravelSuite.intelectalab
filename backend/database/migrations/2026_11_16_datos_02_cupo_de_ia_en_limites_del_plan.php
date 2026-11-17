<?php

declare(strict_types=1);

use App\Domain\Platform\Support\PlanCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const BASE = "'users', 'sedes', 'storage_gb', 'reservations_month', 'whatsapp_month', 'email_month', 'api_calls_month', 'api_rate_per_min', 'webhooks', 'api_keys'";

    public function up(): void
    {
        $this->check(self::BASE.", 'ai_requests'");

        foreach (DB::table('plans')->get(['id', 'name']) as $plan) {
            if (DB::table('plan_limits')->where('plan_id', $plan->id)->where('metric', 'ai_requests')->exists()) {
                continue;
            }

            DB::table('plan_limits')->insert(['plan_id' => $plan->id, 'metric' => 'ai_requests', 'value' => PlanCatalog::AI_REQUESTS[$plan->name] ?? PlanCatalog::AI_REQUESTS['Starter'], 'hard' => true]);
        }
    }

    public function down(): void
    {
        DB::table('plan_limits')->where('metric', 'ai_requests')->delete();
        DB::table('usage_counters')->where('metric', 'ai_requests')->delete();
        $this->check(self::BASE);
    }

    private function check(string $metrics): void
    {
        foreach (['plan_limits', 'usage_counters'] as $table) {
            DB::statement("alter table {$table} drop constraint if exists {$table}_metric_check");
            DB::statement("alter table {$table} add constraint {$table}_metric_check check (metric in ({$metrics}))");
        }
    }
};
