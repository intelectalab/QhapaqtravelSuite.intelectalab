<?php

use App\Jobs\SendReportExport;
use App\Jobs\SendReportMail;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
    Storage::fake('local');
});

dataset('formatos', ['CSV', 'XLSX', 'PDF']);

it('exporta un reporte en cada formato, lo deja en el historial y se descarga (T-23)', function (string $format) {
    actingAsSeed('U01');

    $result = $this->postJson('/api/v1/reports/exports', ['report_key' => 'reservas', 'format' => $format, 'filters' => ['period' => 'all']], critical())->assertStatus(202)->json('data');
    expect($result)->toMatchArray(['status' => 'disponible', 'format' => $format])->and($result['code'])->toStartWith('EXP-');

    $history = $this->getJson('/api/v1/reports/exports')->assertOk()->json();
    expect(collect($history['data'])->pluck('code'))->toContain($result['code'])->and($history['meta']['can_export'])->toBeTrue();

    $download = $this->get("/api/v1/reports/exports/{$result['id']}/download")->assertOk();
    expect($download->headers->get('content-disposition'))->toContain("{$result['code']}-reservas");
    expect(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Exportación')->where('action', 'descargar')->where('entity_id', $result['code'])->exists()))->toBeTrue();
})->with('formatos');

it('sin reports.export no se exporta ni se programa y queda auditado (REP-BR-05)', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/reports/exports', ['report_key' => 'comercial', 'format' => 'CSV'], critical()))->toBeApiError(403, 'REP-BR-05');
    expect($this->postJson('/api/v1/reports/schedules', ['report_key' => 'comercial', 'frequency' => 'weekly', 'time' => '07:00', 'format' => 'PDF', 'recipients' => ['gerencia@andeshorizonte.pe']]))->toBeApiError(403, 'REP-BR-05');
    expect(auditExists(['action' => 'exportar_denegado']))->toBeTrue();
});

it('una exportación vencida responde 410 y la de otra persona no se ve', function () {
    actingAsSeed('U01');
    $result = $this->postJson('/api/v1/reports/exports', ['report_key' => 'clientes', 'format' => 'CSV'], critical())->json('data');

    actingAsSeed('U02');
    expect($this->get("/api/v1/reports/exports/{$result['id']}/download"))->toBeApiError(404);

    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('report_exports')->where('id', $result['id'])->update(['expires_at' => now()->subDay()]));
    expect($this->get("/api/v1/reports/exports/{$result['id']}/download"))->toBeApiError(410, 'EXPORT_EXPIRED');
    expect(collect($this->getJson('/api/v1/reports/exports')->json('data'))->firstWhere('id', $result['id'])['status'])->toBe('expirado');
});

it('editar un envío programado cambia frecuencia, hora, formato y destinatarios (EXP-BR-03)', function () {
    actingAsSeed('U01');
    $schedule = $this->postJson('/api/v1/reports/schedules', ['report_key' => 'finanzas', 'frequency' => 'weekly', 'time' => '07:30', 'format' => 'XLSX', 'recipients' => ['gerencia@andeshorizonte.pe']])->assertCreated()->json('data');

    $updated = $this->patchJson("/api/v1/reports/schedules/{$schedule['code']}", ['frequency' => 'monthly', 'time' => '08:15', 'format' => 'PDF', 'recipients' => ['finanzas@andeshorizonte.pe', 'gerencia@andeshorizonte.pe']])->assertOk()->json('data');

    $job = withinTenant(tenantA(), fn () => DB::table('sys_scheduled_jobs')->where('code', $schedule['code'])->first(['cron', 'report_format', 'recipients']));
    expect($updated['cron'])->toBe('15 8 1 * *')
        ->and($job->report_format)->toBe('PDF')
        ->and(json_decode((string) $job->recipients, true)['emails'])->toHaveCount(2);
    expect($this->patchJson('/api/v1/reports/schedules/JOB-01', ['frequency' => 'daily', 'time' => '08:00', 'format' => 'PDF', 'recipients' => ['a@b.pe']]))->toBeApiError(404);

    $this->postJson("/api/v1/reports/schedules/{$schedule['code']}/pause")->assertOk()->assertJsonPath('data.paused', true);
    $paused = withinTenant(tenantA(), fn () => DB::table('sys_scheduled_jobs')->where('code', $schedule['code'])->value('paused'));
    $this->postJson("/api/v1/reports/schedules/{$schedule['code']}/resume")->assertOk()->assertJsonPath('data.paused', false);
    expect($paused)->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('sys_scheduled_jobs')->where('code', $schedule['code'])->value('paused')))->toBeFalse()
        ->and($this->postJson('/api/v1/reports/schedules/JOB-01/pause'))->toBeApiError(409, 'JOB-BR-03');
});

it('programar un envío crea el proceso y el job genera el archivo y lo envía a los destinatarios', function () {
    actingAsSeed('U01');

    $schedule = $this->postJson('/api/v1/reports/schedules', ['report_key' => 'finanzas', 'frequency' => 'weekly', 'time' => '07:30', 'format' => 'XLSX', 'recipients' => ['gerencia@andeshorizonte.pe', 'finanzas@andeshorizonte.pe'], 'period' => 'month'])->assertCreated()->json('data');
    expect($schedule['cron'])->toBe('30 7 * * 1');
    expect(collect($this->getJson('/api/v1/reports/exports')->json('meta.schedules'))->pluck('code'))->toContain($schedule['code']);
    expect($this->postJson('/api/v1/reports/schedules', ['report_key' => 'finanzas', 'frequency' => 'weekly', 'time' => '25:00', 'format' => 'XLSX', 'recipients' => ['x']]))->toBeApiError(422);

    $job = withinTenant(tenantA(), fn () => DB::table('sys_scheduled_jobs')->where('code', $schedule['code'])->first(['id', 'job_class']));
    expect($job->job_class)->toBe(SendReportExport::class);

    $result = withinTenant(tenantA(), fn () => (new SendReportExport)->forTenant(tenantA()->getKey())->scheduled($job->id));
    $result->handle();
    expect($result->runResult)->toContain('2 destinatarios');
    Queue::assertPushed(SendReportMail::class, 2);
    expect(withinTenant(tenantA(), fn () => DB::table('report_exports')->where('scheduled_job_id', $job->id)->where('format', 'XLSX')->exists()))->toBeTrue();
});
