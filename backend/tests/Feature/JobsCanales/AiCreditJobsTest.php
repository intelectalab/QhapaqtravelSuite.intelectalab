<?php

use App\Domain\Shared\Jobs\JobCatalog;
use App\Jobs\AiCreditsLow;
use App\Jobs\GrantMonthlyAiCredits;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

require_once __DIR__.'/JobsCanalesHelpers.php';

beforeEach(function () {
    lockScheduledJobs();
    Queue::fake(canalesSideJobs());
});

function aiJobBalance(string $kind): int
{
    return withinTenant(tenantA(), fn () => (int) DB::table('fin_ai_credit_ledger')->where('kind', $kind)->orderByDesc('occurred_at')->orderByDesc('id')->value('balance_after'));
}

it('JOB-IA-1 el día 1 asigna los créditos del plan, vence los no usados del mes anterior y no repite', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-01 00:20:00', 'America/Lima'));
    $monthStart = Carbon::parse('2026-10-01 00:00:00', 'America/Lima')->utc();

    $first = canalesJobRun(new GrantMonthlyAiCredits);
    $movements = withinTenant(tenantA(), fn () => DB::table('fin_ai_credit_ledger')->where('occurred_at', '>=', $monthStart)->pluck('movement')->unique()->values()->all());
    $second = canalesJobRun(new GrantMonthlyAiCredits);

    expect($first->status)->toBe('ok')
        ->and($first->result)->toContain('créditos de IA asignados')
        ->and($movements)->toContain('asignacion_plan')
        ->and($second->result)->toBe('Sin créditos de IA por asignar este mes')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_ai_credit_ledger')->where('occurred_at', '>=', $monthStart)->where('movement', 'asignacion_plan')->where('note', 'like', 'Incluido en el plan%')->count()))->toBe(1);
});

it('JOB-IA-2 avisa una vez al mes cuando se consumió el 80 % de los créditos', function () {
    $balance = aiJobBalance('contenido');
    withinTenant(tenantA(), fn () => DB::table('fin_ai_credit_ledger')->insert(['kind' => 'contenido', 'movement' => 'consumo', 'credits' => -($balance - 2), 'balance_after' => 2, 'job_id' => DB::table('cms_ai_content_jobs')->orderBy('code')->value('id'), 'note' => 'Prueba', 'occurred_at' => now()->addMinute()]));

    $run = canalesJobRun(new AiCreditsLow);
    $notices = canalesNotices('ia.creditos_bajos', null, 'ai_credits_contenido');
    canalesJobRun(new AiCreditsLow);

    expect($run->status)->toBe('advertencia')
        ->and($run->result)->toContain('contenido')
        ->and($notices)->toBeGreaterThan(0)
        ->and(canalesNotices('ia.creditos_bajos', null, 'ai_credits_contenido'))->toBe($notices)
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'ia.creditos_bajos')->value('body_rendered')))->toContain('Te quedan 2 créditos');
});

it('los jobs de créditos de IA quedan en el catálogo', function () {
    expect(JobCatalog::TENANT['JOB-IA-1'])->toMatchArray(['class' => GrantMonthlyAiCredits::class, 'cron' => '5 0 1 * *'])
        ->and(JobCatalog::TENANT['JOB-IA-2'])->toMatchArray(['class' => AiCreditsLow::class, 'queue' => 'notifications']);
});
