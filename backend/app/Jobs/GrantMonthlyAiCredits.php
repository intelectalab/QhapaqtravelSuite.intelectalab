<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\SiteTemplates\Support\AiCredits;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class GrantMonthlyAiCredits extends TenantJob
{
    protected function run(): string
    {
        $monthStart = Carbon::now(app(TenantContext::class)->timezone())->startOfMonth()->utc();
        $before = DB::table('fin_ai_credit_ledger')->where('occurred_at', '>=', $monthStart)->pluck('id')->all();

        app(AiCredits::class)->grantMonthly();

        $rows = DB::table('fin_ai_credit_ledger')->where('occurred_at', '>=', $monthStart)->whereNotIn('id', $before)->whereIn('movement', ['asignacion_plan', 'vencimiento'])->get(['kind', 'movement', 'credits']);
        $granted = (int) $rows->where('movement', 'asignacion_plan')->sum('credits');
        $expired = -(int) $rows->where('movement', 'vencimiento')->sum('credits');

        return self::summary([
            $granted > 0 ? self::plural($granted, 'crédito de IA asignado', 'créditos de IA asignados') : null,
            $expired > 0 ? self::plural($expired, 'crédito del mes anterior vencido', 'créditos del mes anterior vencidos') : null,
        ], 'Sin créditos de IA por asignar este mes');
    }
}
