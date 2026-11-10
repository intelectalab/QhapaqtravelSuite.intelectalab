<?php

use Illuminate\Support\Facades\DB;

function jobRow(string $code): object
{
    return DB::connection('pgsql_platform')->table('sys_scheduled_jobs')->whereNull('tenant_id')->where('code', $code)->first();
}

it('pausar una tarea de plataforma impide ejecutarla y reanudarla lo vuelve a permitir', function () {
    actingAsPlatform();

    $this->postJson('/api/v1/platform/jobs/PLT-08/pause', ['paused' => true])->assertOk()->assertJsonPath('data.paused', true);

    expect((bool) jobRow('PLT-08')->paused)->toBeTrue()
        ->and(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Job', 'action' => 'pausar', 'after_value' => 'pausada'])->exists())->toBeTrue();
    $runs = DB::connection('pgsql_platform')->table('sys_job_runs')->where('scheduled_job_id', jobRow('PLT-08')->id)->count();
    expect($this->postJson('/api/v1/platform/jobs/PLT-08/run'))->toBeApiError(409, 'JOB_PAUSED');
    expect(DB::connection('pgsql_platform')->table('sys_job_runs')->where('scheduled_job_id', jobRow('PLT-08')->id)->count())->toBe($runs);

    $this->postJson('/api/v1/platform/jobs/PLT-08/pause', ['paused' => false])->assertOk()->assertJsonPath('data.paused', false);

    expect((bool) jobRow('PLT-08')->paused)->toBeFalse();
    $this->postJson('/api/v1/platform/jobs/PLT-08/run')->assertOk();
    expect(DB::connection('pgsql_platform')->table('sys_job_runs')->where('scheduled_job_id', jobRow('PLT-08')->id)->count())->toBe($runs + 1);
});

it('no repite el mismo estado de pausa, valida el cuerpo y responde 404 a una tarea inexistente', function () {
    actingAsPlatform();

    expect($this->postJson('/api/v1/platform/jobs/PLT-08/pause', ['paused' => false]))->toBeApiError(409, 'JOB_STATUS');
    $this->postJson('/api/v1/platform/jobs/PLT-08/pause', [])->assertStatus(422)->assertJsonValidationErrors('paused');
    expect($this->postJson('/api/v1/platform/jobs/PLT-99/pause', ['paused' => true]))->toBeApiError(404);
});

it('el Tenant Admin no pausa tareas de la plataforma', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/platform/jobs/PLT-08/pause', ['paused' => true])->status())->toBeIn([401, 403]);
    expect((bool) jobRow('PLT-08')->paused)->toBeFalse();
});
