<?php

use App\Domain\Reports\Support\WeeklyManagementReport;
use App\Jobs\SendReportMail;
use App\Jobs\SendScheduledReports;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    lockScheduledJobs();
    Storage::fake('local');
});

function runWeeklyReport(string $trigger = 'schedule'): void
{
    $job = (new SendScheduledReports)->forTenant((string) tenantA()->getKey());
    $job->trigger = $trigger;
    dispatch_sync($job);
}

it('el reporte semanal compara la semana cerrada con la anterior y suma las ventas en decimal exacto', function () {
    $report = withinTenant(tenantA(), fn () => app(WeeklyManagementReport::class)->build(CarbonImmutable::parse('2026-09-28', 'America/Lima')));
    $sales = collect($report['kpis'])->firstWhere('label', 'Ventas');
    $days = collect($report['days'])->reduce(fn (string $sum, array $day): string => bcadd($sum, $day['sales'], 2), '0.00');

    expect($report['period']['from'])->toBe('2026-09-21')
        ->and($report['period']['to'])->toBe('2026-09-27')
        ->and($report['agency']['brand'])->toMatch('/^#[0-9a-f]{6}$/i')
        ->and($report['days'])->toHaveCount(7)
        ->and($sales['value'])->toBe($days)
        ->and($report['collection']['aging'])->toHaveCount(4);
});

it('JOB-08 genera el PDF y el Excel, los deja en report_exports y los envía a gerencia una vez por semana', function () {
    Queue::fake([SendReportMail::class]);

    runWeeklyReport();
    runWeeklyReport();

    $exports = withinTenant(tenantA(), fn () => DB::table('report_exports')->where('report_key', SendScheduledReports::REPORT_KEY)->orderBy('format')->get());
    $pdf = $exports->firstWhere('format', 'PDF');
    $xlsx = $exports->firstWhere('format', 'XLSX');
    $alerts = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'reporte.programado')->count());

    expect($exports)->toHaveCount(2)
        ->and($pdf->status)->toBe('disponible')
        ->and(str_starts_with((string) Storage::disk('local')->get($pdf->file_path), '%PDF'))->toBeTrue()
        ->and(str_starts_with((string) Storage::disk('local')->get($xlsx->file_path), 'PK'))->toBeTrue()
        ->and($alerts)->toBeGreaterThan(0);

    Queue::assertPushed(SendReportMail::class, fn (SendReportMail $mail): bool => count($mail->files) === 2 && str_contains($mail->subject, 'Reporte semanal de gerencia'));
    Queue::assertPushed(SendReportMail::class, $alerts);
});

it('Ejecutar ahora reenvía el reporte aunque ya se haya enviado esa semana', function () {
    Queue::fake([SendReportMail::class]);

    runWeeklyReport();
    runWeeklyReport('manual');

    expect(withinTenant(tenantA(), fn () => DB::table('report_exports')->where('report_key', SendScheduledReports::REPORT_KEY)->count()))->toBe(4);
});
