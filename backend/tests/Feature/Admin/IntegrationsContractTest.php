<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(function () {
    lockScheduledJobs();
    Queue::fake();
});

it('integrations, jobs e integration-errors responden listas con cursor', function () {
    actingAsSeed('U01');

    $adapters = $this->getJson('/api/v1/integrations')->assertOk();
    $jobs = $this->getJson('/api/v1/jobs?page[size]=5')->assertOk();
    $errors = $this->getJson('/api/v1/integration-errors?filter[status]=fallo_definitivo')->assertOk();

    expect($adapters->json('data.0'))->toHaveKeys(['id', 'code', 'name', 'kind', 'status', 'environment', 'max_retries', 'backoff_base_s', 'timeout_s'])
        ->and(collect($adapters->json('data'))->pluck('secret_ref')->filter()->reject(fn (string $ref): bool => $ref === 'vault://***')->all())->toBe([])
        ->and($jobs->json('data'))->toHaveCount(5)
        ->and($jobs->json('meta.next_cursor'))->not->toBeNull()
        ->and(collect($errors->json('data'))->pluck('status')->unique()->all())->toBe(['fallo_definitivo']);
});

it('T-21: una integración por validar no pasa a producción', function () {
    actingAsSeed('U01');
    $body = ['environment' => 'production', 'max_retries' => 5, 'backoff_base_s' => 60, 'timeout_s' => 30];

    expect($this->patchJson('/api/v1/integrations/INT-01/config', $body))->toBeApiError(422, 'INT-BR-02');

    $this->patchJson('/api/v1/integrations/INT-05/config', [...$body, 'max_retries' => 3])->assertOk()->assertJsonPath('data.max_retries', 3);
});

it('integrations/{id}/test persiste el resultado de la prueba', function () {
    actingAsSeed('U01');
    $id = withinTenant(tenantA(), fn () => DB::table('integration_adapters')->where('code', 'INT-01')->value('id'));

    $this->postJson("/api/v1/integrations/{$id}/test")->assertOk()->assertJsonPath('data.last_test_ok', false);
});

it('jobs: pausar, reanudar y ejecutar con Idempotency-Key', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/jobs/JOB-02/pause')->assertOk()->assertJsonPath('data.paused', true)->assertJsonPath('data.next_run_at', null);
    expect($this->postJson('/api/v1/jobs/JOB-02/pause'))->toBeApiError(409, 'JOB-BR-02');
    expect($this->postJson('/api/v1/jobs/JOB-02/run', [], critical()))->toBeApiError(409, 'JOB-BR-02');
    $this->postJson('/api/v1/jobs/JOB-02/resume')->assertOk()->assertJsonPath('data.paused', false);

    expect($this->postJson('/api/v1/jobs/JOB-02/run'))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');
    $key = idem();
    $first = $this->postJson('/api/v1/jobs/JOB-02/run', [], critical(null, $key))->assertStatus(202)->json();
    $again = $this->postJson('/api/v1/jobs/JOB-02/run', [], critical(null, $key))->assertStatus(202);

    expect($again->json())->toBe($first)
        ->and(withinTenant(tenantA(), fn () => DB::table('sys_job_runs')->where('id', $first['data']['id'])->where('trigger', 'manual')->exists()))->toBeTrue();
});

it('JOB-BR-01: no se ejecuta un proceso que ya está en curso', function () {
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('sys_scheduled_jobs')->where('code', 'JOB-04')->update(['last_status' => 'en_curso']));

    expect($this->postJson('/api/v1/jobs/JOB-04/run', [], critical()))->toBeApiError(409, 'JOB-BR-01');
});

it('JOB-BR-03: solo se eliminan envíos programados de reportes', function () {
    $owner = actingAsSeed('U07');
    $id = (string) Str::uuid7();
    withinTenant(tenantA(), fn () => DB::table('sys_scheduled_jobs')->insert(['id' => $id, 'code' => 'JOB-90', 'name' => 'Reporte de finanzas semanal', 'job_class' => 'App\\Jobs\\SendScheduledReports', 'cron' => '0 7 * * 1', 'cron_label' => 'lunes 07:00', 'queue' => 'reports', 'report_key' => 'finanzas', 'report_format' => 'PDF', 'owner_user_id' => $owner->id, 'is_system' => false]));

    $this->deleteJson("/api/v1/jobs/{$id}")->assertNoContent();
    expect(withinTenant(tenantA(), fn () => DB::table('sys_scheduled_jobs')->where('id', $id)->exists()))->toBeFalse();

    actingAsSeed('U01');
    expect($this->deleteJson('/api/v1/jobs/JOB-01'))->toBeApiError(409, 'JOB-BR-03');
});

it('INT-BR-05 / INT-BR-06: el error permanente no se reintenta y resolver exige descripción', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/integration-errors/ERR-0416/retry'))->toBeApiError(409, 'INT-BR-05');
    $this->postJson('/api/v1/integration-errors/ERR-0418/retry')->assertOk()->assertJsonPath('data.attempt', 0);
    expect($this->postJson('/api/v1/integration-errors/ERR-0416/resolve', []))->toBeApiError(422);
    $this->postJson('/api/v1/integration-errors/ERR-0416/resolve', ['resolution' => 'Se corrigió el dato del proveedor.'])->assertOk()->assertJsonPath('data.status', 'resuelto');
});

it('Gerencia con reports.export solo ve los errores de sus envíos programados', function () {
    actingAsSeed('U02');

    $this->getJson('/api/v1/integration-errors')->assertOk()->assertJsonCount(0, 'data');
    expect($this->postJson('/api/v1/integration-errors/ERR-0418/retry'))->toBeApiError(404);
    expect($this->getJson('/api/v1/jobs'))->toBeApiError(403);
    expect($this->getJson('/api/v1/integrations'))->toBeApiError(403);
});
