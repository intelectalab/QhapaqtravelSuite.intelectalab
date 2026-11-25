<?php

use App\Domain\Shared\Jobs\JobCatalog;
use App\Jobs\MarkB2bAgreementsExpired;
use App\Jobs\RecalculateB2bCredit;
use Brick\Math\BigDecimal;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

require_once __DIR__.'/JobsCanalesHelpers.php';

beforeEach(function () {
    lockScheduledJobs();
    Queue::fake(canalesSideJobs());
});

function b2bJobAgency(array $values = []): string
{
    $agencyId = (string) seedUser('U13')->agency_id;

    if ($values !== []) {
        withinTenant(tenantA(), fn () => DB::table('channel_b2b_agencies')->where('id', $agencyId)->update($values));
    }

    return $agencyId;
}

function b2bValidTo(int $days): string
{
    return Carbon::parse(BUSINESS_TODAY)->addDays($days)->toDateString();
}

it('JOB-B2B-1 avisa al ejecutivo y a la agencia a 30 y a 7 días del vencimiento, una vez por tramo', function () {
    $agencyId = b2bJobAgency(['valid_to' => b2bValidTo(20), 'status' => 'activa']);
    $agencyUser = (string) seedUser('U13')->getKey();

    $first = canalesJobRun(new MarkB2bAgreementsExpired);
    $thirty = canalesNotices('b2b.convenio_por_vencer_30', $agencyId);

    expect($first->status)->toBe('ok')
        ->and($first->result)->toContain('1 convenio por vencer')
        ->and($thirty)->toBeGreaterThan(1)
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'b2b.convenio_por_vencer_30')->where('recipient_user_id', $agencyUser)->value('audience')))->toBe('agency');

    expect(canalesJobRun(new MarkB2bAgreementsExpired)->result)->toBe('Convenios B2B ya avisados')
        ->and(canalesNotices('b2b.convenio_por_vencer_30', $agencyId))->toBe($thirty);

    b2bJobAgency(['valid_to' => b2bValidTo(5)]);
    canalesJobRun(new MarkB2bAgreementsExpired);

    expect(canalesNotices('b2b.convenio_por_vencer_7', $agencyId))->toBe($thirty)
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'b2b.convenio_por_vencer_7')->where('source_id', $agencyId)->value('subject')))->toContain('vence en 5 días');
});

it('JOB-B2B-1 avisa el convenio vencido una sola vez, lo audita y no toca el estado guardado', function () {
    $agencyId = b2bJobAgency(['valid_to' => b2bValidTo(-2), 'status' => 'activa']);

    expect(canalesJobRun(new MarkB2bAgreementsExpired)->result)->toContain('1 convenio vencido');
    $expired = canalesNotices('b2b.convenio_vencido', $agencyId);
    canalesJobRun(new MarkB2bAgreementsExpired);

    $code = withinTenant(tenantA(), fn () => DB::table('channel_b2b_agencies')->where('id', $agencyId)->value('code'));

    expect($expired)->toBeGreaterThan(0)
        ->and(canalesNotices('b2b.convenio_vencido', $agencyId))->toBe($expired)
        ->and(withinTenant(tenantA(), fn () => DB::table('channel_b2b_agencies')->where('id', $agencyId)->value('status')))->toBe('activa')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Agencia B2B')->where('entity_id', $code)->where('action', 'vencer_convenio')->count()))->toBe(1);
});

it('JOB-B2B-1 ignora la agencia inactiva y el convenio con vigencia lejana', function () {
    $agencyId = b2bJobAgency(['valid_to' => b2bValidTo(3), 'status' => 'inactiva']);
    canalesJobRun(new MarkB2bAgreementsExpired);
    expect(canalesNotices('b2b.convenio_por_vencer_7', $agencyId))->toBe(0);

    b2bJobAgency(['valid_to' => b2bValidTo(45), 'status' => 'activa']);
    canalesJobRun(new MarkB2bAgreementsExpired);
    expect(canalesNotices('b2b.convenio_por_vencer_30', $agencyId))->toBe(0);
});

it('JOB-B2B-2 alerta cuando el crédito usado no cuadra con la suma de movimientos, sin corregirlo', function () {
    $agencyId = b2bJobAgency();
    [$code, $sum] = withinTenant(tenantA(), fn () => [
        DB::table('channel_b2b_agencies')->where('id', $agencyId)->value('code'),
        (string) DB::table('channel_b2b_credit_movements')->where('agency_id', $agencyId)->sum('amount'),
    ]);
    $balanced = number_format((float) $sum, 2, '.', '');

    b2bJobAgency(['credit_used' => $balanced]);
    expect((string) canalesJobRun(new RecalculateB2bCredit)->result)->not->toContain($code)
        ->and(canalesNotices('b2b.credito_descuadrado', $agencyId))->toBe(0);

    $wrong = (string) BigDecimal::of($balanced)->plus('125.50')->toScale(2);
    b2bJobAgency(['credit_used' => $wrong]);
    $run = canalesJobRun(new RecalculateB2bCredit);
    $notices = canalesNotices('b2b.credito_descuadrado', $agencyId);
    canalesJobRun(new RecalculateB2bCredit);

    expect($run->status)->toBe('advertencia')
        ->and($run->result)->toContain($code)
        ->and($notices)->toBeGreaterThan(0)
        ->and(canalesNotices('b2b.credito_descuadrado', $agencyId))->toBe($notices)
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'b2b.credito_descuadrado')->where('source_id', $agencyId)->value('body_rendered')))->toContain('125.50')
        ->and(withinTenant(tenantA(), fn () => (string) DB::table('channel_b2b_agencies')->where('id', $agencyId)->value('credit_used')))->toBe($wrong);
});

it('los jobs B2B quedan en el catálogo con su cola y horario', function () {
    expect(JobCatalog::TENANT['JOB-B2B-1'])->toMatchArray(['class' => MarkB2bAgreementsExpired::class, 'cron' => '10 0 * * *', 'queue' => 'low'])
        ->and(JobCatalog::TENANT['JOB-B2B-2'])->toMatchArray(['class' => RecalculateB2bCredit::class, 'queue' => 'low']);
});
