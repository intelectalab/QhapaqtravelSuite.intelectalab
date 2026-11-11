<?php

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

function mktAutomatizacion(string $code): object
{
    return rowOf('mkt_automations', $code);
}

function mktAutomatizacionAuditada(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Automatización')->where('entity_id', $code)->where('action', $action)->exists());
}

function mktAutomatizacionListada(object $test, string $code): array
{
    return collect($test->getJson('/api/v1/marketing/automations')->assertOk()->json('data.automations'))->firstWhere('code', $code);
}

function mktNuevoSuscriptor(string $name, string $email): string
{
    return withinTenant(tenantA(), function () use ($name, $email): string {
        $id = (string) Str::uuid7();
        DB::table('mkt_contacts_subscribers')->insert(['id' => $id, 'tenant_id' => tenantA()->getKey(), 'code' => 'SUB-'.Str::upper(Str::random(6)), 'full_name' => $name, 'email' => $email, 'source' => 'Newsletter web', 'created_at' => now(), 'updated_at' => now()]);

        return $id;
    });
}

it('lista las seis automatizaciones con su cola calculada y sin repetir disparos ya procesados', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/marketing/automations')->assertOk()->json('data');
    $welcome = collect($data['automations'])->firstWhere('code', 'AUT-01');

    expect(collect($data['automations'])->pluck('key')->all())->toBe(['welcome', 'cart', 'pretrip', 'survey', 'birthday', 'reactivation'])
        ->and($welcome['template']['code'])->toBe('TPL-08')
        ->and($welcome['purpose'])->toBe('comercial')
        ->and($welcome['totals']['sent'])->toBe(212)
        ->and($welcome['queue']['total'])->toBe(2)
        ->and($welcome['queue']['sendable'])->toBe(2)
        ->and(collect($welcome['queue']['items'])->pluck('name')->all())->not->toContain('Camila Herrera Solís')
        ->and(collect($data['templates'])->pluck('code'))->toContain('TPL-05')
        ->and($data['can']['manage'])->toBeTrue();
});

it('Ventas no ve ni gestiona automatizaciones', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/marketing/automations'))->toBeApiError(403);
    expect($this->postJson('/api/v1/marketing/automations/AUT-01/pause', [], critical(0)))->toBeApiError(403);
});

it('pausar y activar cambian el estado con control de versión y quedan auditados', function () {
    actingAsSeed('U01');
    $version = (int) mktAutomatizacion('AUT-01')->lock_version;

    $this->postJson('/api/v1/marketing/automations/AUT-01/pause', [], critical($version))->assertOk();
    expect(mktAutomatizacion('AUT-01')->status)->toBe('pausada')
        ->and((int) mktAutomatizacion('AUT-01')->lock_version)->toBe($version + 1)
        ->and(mktAutomatizacionAuditada('AUT-01', 'pausar'))->toBeTrue();

    expect($this->postJson('/api/v1/marketing/automations/AUT-01/activate', [], critical($version)))->toBeApiError(409, 'STALE_VERSION');
    expect($this->postJson('/api/v1/marketing/automations/AUT-01/pause', [], critical($version + 1)))->toBeApiError(409, 'MKT-AUT-STATE');
    expect($this->postJson('/api/v1/marketing/automations/AUT-01/activate', [], ['Accept' => 'application/json']))->toBeApiError(428, 'IF_MATCH_REQUIRED');

    $this->postJson('/api/v1/marketing/automations/AUT-01/activate', [], critical($version + 1))->assertOk();
    expect(mktAutomatizacion('AUT-01')->status)->toBe('activa')
        ->and(mktAutomatizacionAuditada('AUT-01', 'activar'))->toBeTrue();
});

it('configurar cambia plantilla y espera, valida el canal y deja historial', function () {
    actingAsSeed('U01');
    $version = (int) mktAutomatizacion('AUT-05')->lock_version;

    $this->putJson('/api/v1/marketing/automations/AUT-05', ['template' => 'TPL-02', 'delay' => 'El día, 08:00'], critical($version))->assertOk();

    $automation = mktAutomatizacion('AUT-05');
    expect($automation->delay_desc)->toBe('El día, 08:00')
        ->and($automation->template_id)->toBe(idOf('mkt_templates', 'TPL-02'))
        ->and(mktAutomatizacionAuditada('AUT-05', 'configurar'))->toBeTrue()
        ->and(mktAutomatizacionListada($this, 'AUT-05')['history'][0]['action'])->toBe('configurar');

    $this->putJson('/api/v1/marketing/automations/AUT-05', ['template' => '', 'delay' => ''], critical($version + 1))->assertStatus(422)->assertJsonValidationErrors(['template', 'delay']);
    expect($this->putJson('/api/v1/marketing/automations/AUT-05', ['template' => 'TPL-04', 'delay' => 'El día, 08:00'], critical($version + 1)))->toBeApiError(422, 'VALIDATION_ERROR');
    expect($this->putJson('/api/v1/marketing/automations/AUT-05', ['template' => 'TPL-02', 'delay' => 'El día, 10:00'], critical($version)))->toBeApiError(409, 'STALE_VERSION');
});

it('una plantilla de WhatsApp sin aprobar no se usa en una automatización activa ni permite activarla', function () {
    actingAsSeed('U01');
    $version = (int) mktAutomatizacion('AUT-03')->lock_version;

    expect($this->putJson('/api/v1/marketing/automations/AUT-03', ['template' => 'TPL-05', 'delay' => '72 h antes del inicio'], critical($version)))->toBeApiError(422, 'MKT-BR-03');

    $this->postJson('/api/v1/marketing/automations/AUT-03/pause', [], critical($version))->assertOk();
    $this->putJson('/api/v1/marketing/automations/AUT-03', ['template' => 'TPL-05', 'delay' => '72 h antes del inicio'], critical($version + 1))->assertOk();

    expect($this->postJson('/api/v1/marketing/automations/AUT-03/activate', [], critical($version + 2)))->toBeApiError(422, 'MKT-BR-03');
    expect(mktAutomatizacion('AUT-03')->status)->toBe('pausada');
});

it('ejecutar ahora envía a quien tiene consentimiento, suprime al resto y no repite el mismo disparo', function () {
    actingAsSeed('U01');
    $sinPermiso = mktNuevoSuscriptor('Teresa Valdivia', 'tvaldivia@correo.pe');
    $before = mktAutomatizacion('AUT-01');

    $result = $this->postJson('/api/v1/marketing/automations/AUT-01/run', [], critical())->assertOk()->json('data');

    $enrollments = withinTenant(tenantA(), fn () => DB::table('mkt_automation_enrollments')->where('automation_id', $before->id)->where('processed_at', '>=', Carbon::now()->subMinute())->get());
    $after = mktAutomatizacion('AUT-01');
    expect($result)->toMatchArray(['queued' => 3, 'sent' => 2, 'suppressed' => 1])
        ->and($enrollments)->toHaveCount(3)
        ->and($enrollments->firstWhere('subject_id', $sinPermiso)->status)->toBe('suprimido')
        ->and($enrollments->firstWhere('subject_id', $sinPermiso)->reason)->toBe('Sin consentimiento')
        ->and((int) $after->sent_total)->toBe((int) $before->sent_total + 2)
        ->and((int) $after->suppressed_total)->toBe((int) $before->suppressed_total + 1)
        ->and(withinTenant(tenantA(), fn () => DB::table('mkt_automation_runs')->where('automation_id', $before->id)->value('sent')))->toBe(2)
        ->and(withinTenant(tenantA(), fn () => DB::table('sys_outbox')->where('event', 'marketing.automation.messages')->exists()))->toBeTrue()
        ->and(mktAutomatizacionAuditada('AUT-01', 'ejecutar'))->toBeTrue()
        ->and(mktAutomatizacionListada($this, 'AUT-01')['last_run']['sent'])->toBe(2);

    expect($this->postJson('/api/v1/marketing/automations/AUT-01/run', [], critical()))->toBeApiError(422, 'MKT-AUT-EMPTY');
});

it('una automatización pausada no se ejecuta', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/marketing/automations/AUT-06/run', [], critical()))->toBeApiError(409, 'MKT-AUT-STATE');
    expect(withinTenant(tenantA(), fn () => DB::table('mkt_automation_runs')->where('automation_id', idOf('mkt_automations', 'AUT-06'))->count()))->toBe(0);
});

it('el recordatorio pre-viaje es de servicio: llega sin consentimiento pero respeta la baja', function () {
    actingAsSeed('U01');
    [$conBaja, $sinRegistro] = withinTenant(tenantA(), function (): array {
        $revoked = DB::table('mkt_consents')->where('code', 'CNS-0012')->value('subject_id');
        $plain = DB::table('crm_clients')->whereNull('deleted_at')->whereNotIn('id', DB::table('mkt_consents')->where('channel', 'whatsapp')->select('subject_id'))->where('phone', 'like', '9%')->value('id');
        foreach ([$revoked, $plain] as $index => $client) {
            DB::table('booking_reservations')->where('id', DB::table('booking_reservations')->whereNull('deleted_at')->where('status', '<>', 'cancelada')->orderBy('code')->skip($index)->value('id'))
                ->update(['client_id' => $client, 'status' => 'confirmada', 'travel_from' => Carbon::today()->addDay()->toDateString(), 'travel_to' => Carbon::today()->addDays(4)->toDateString()]);
        }

        return [DB::table('crm_clients')->where('id', $revoked)->value('name'), DB::table('crm_clients')->where('id', $plain)->value('name')];
    });

    $items = collect(mktAutomatizacionListada($this, 'AUT-03')['queue']['items']);

    expect($items->firstWhere('name', $conBaja)['block'])->toBe('Baja registrada')
        ->and($items->firstWhere('name', $sinRegistro)['block'])->toBeNull()
        ->and($items->pluck('block')->all())->not->toContain('Sin consentimiento');
});
