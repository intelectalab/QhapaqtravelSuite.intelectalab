<?php

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

function mktCampanaDatos(array $extra = []): array
{
    return [
        'name' => 'Escapada de verano a Paracas',
        'channel' => 'email',
        'segment' => 'SEG-001',
        'template' => 'TPL-01',
        'subject' => 'Tu verano empieza en Paracas',
        'body' => "Hola {{nombre}}:\nTe esperan las islas Ballestas.\n{{enlace_baja}}",
        'promo_code' => 'paracas26',
        ...$extra,
    ];
}

function mktCampanaVersion(string $code): int
{
    return (int) rowOf('mkt_campaigns', $code)->lock_version;
}

function mktPruebasVigentes(string $code): int
{
    $id = rowOf('mkt_campaigns', $code)->id;

    return withinTenant(tenantA(), fn () => DB::table('mkt_campaign_tests')->where('campaign_id', $id)->whereNull('invalidated_at')->count());
}

function mktCampanaAuditada(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Campaña')->where('entity_id', $code)->where('action', $action)->exists());
}

it('crear una campaña de correo la deja en borrador con UTM y código promocional, y aparece en el listado', function () {
    $actor = actingAsSeed('U01');

    $code = $this->postJson('/api/v1/marketing/campaigns', mktCampanaDatos())->assertCreated()->json('data.code');

    $campaign = rowOf('mkt_campaigns', $code);
    expect($campaign->status)->toBe('borrador')
        ->and($campaign->owner_id)->toBe($actor->id)
        ->and($campaign->promo_code)->toBe('PARACAS26')
        ->and($campaign->utm)->toContain('utm_campaign='.strtolower($code))
        ->and($campaign->segment_id)->toBe(rowOf('mkt_segments', 'SEG-001')->id)
        ->and(mktCampanaAuditada($code, 'crear'))->toBeTrue()
        ->and(collect($this->getJson('/api/v1/marketing/campaigns')->assertOk()->json('data.campaigns'))->pluck('code'))->toContain($code);
});

it('una campaña de WhatsApp usa el texto de la plantilla y no lleva asunto', function () {
    actingAsSeed('U01');

    $code = $this->postJson('/api/v1/marketing/campaigns', mktCampanaDatos(['channel' => 'whatsapp', 'segment' => 'SEG-002', 'template' => 'TPL-04', 'subject' => null, 'body' => 'Texto que no debe usarse']))
        ->assertCreated()->json('data.code');

    $campaign = rowOf('mkt_campaigns', $code);
    expect($campaign->subject)->toBeNull()
        ->and($campaign->body)->toBe(rowOf('mkt_templates', 'TPL-04')->body);
});

it('crear una campaña valida nombre, canal, asunto, plantilla y enlace de baja', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/marketing/campaigns', mktCampanaDatos(['name' => 'No', 'channel' => 'sms', 'subject' => null, 'promo_code' => 'x']))
        ->assertStatus(422)->assertJsonValidationErrors(['name', 'channel', 'promo_code']);
    $this->postJson('/api/v1/marketing/campaigns', mktCampanaDatos(['subject' => null]))->assertStatus(422)->assertJsonValidationErrors('subject');
    expect($this->postJson('/api/v1/marketing/campaigns', mktCampanaDatos(['template' => 'TPL-04'])))->toBeApiError(422, 'VALIDATION_ERROR');
    expect($this->postJson('/api/v1/marketing/campaigns', mktCampanaDatos(['segment' => 'SEG-999'])))->toBeApiError(422, 'VALIDATION_ERROR');
    expect($this->postJson('/api/v1/marketing/campaigns', mktCampanaDatos(['body' => 'Hola {{nombre}}, sin enlace de baja.'])))->toBeApiError(422, 'MKT-BR-02');
});

it('Ventas no gestiona campañas', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/marketing/campaigns', mktCampanaDatos()))->toBeApiError(403);
});

it('editar una campaña en borrador guarda el contenido e invalida las pruebas enviadas', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/marketing/campaigns/CMP-0012/test-send', [], critical())->assertCreated();
    expect(mktPruebasVigentes('CMP-0012'))->toBe(1);

    $this->patchJson('/api/v1/marketing/campaigns/CMP-0012', mktCampanaDatos(['name' => 'Te extrañamos: vuelve a viajar', 'segment' => 'SEG-005', 'template' => 'TPL-03']))->assertOk();

    $campaign = rowOf('mkt_campaigns', 'CMP-0012');
    expect($campaign->name)->toBe('Te extrañamos: vuelve a viajar')
        ->and($campaign->subject)->toBe('Tu verano empieza en Paracas')
        ->and(mktPruebasVigentes('CMP-0012'))->toBe(0)
        ->and(mktCampanaAuditada('CMP-0012', 'editar'))->toBeTrue();
    expect($this->postJson('/api/v1/marketing/campaigns/CMP-0012/schedule', ['scheduled_at' => '2026-10-02 10:00'], critical(mktCampanaVersion('CMP-0012'))))->toBeApiError(422, 'MKT-BR-04');
});

it('solo se editan campañas en borrador', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/marketing/campaigns/CMP-0011', mktCampanaDatos()))->toBeApiError(409, 'MKT-BR-08');
    expect($this->patchJson('/api/v1/marketing/campaigns/CMP-0008', mktCampanaDatos()))->toBeApiError(409, 'MKT-BR-08');
});

it('el envío de prueba queda registrado para el usuario interno', function () {
    $actor = actingAsSeed('U01');

    $this->postJson('/api/v1/marketing/campaigns/CMP-0012/test-send', [], critical())->assertCreated();

    $test = withinTenant(tenantA(), fn () => DB::table('mkt_campaign_tests')->where('campaign_id', rowOf('mkt_campaigns', 'CMP-0012')->id)->first());
    expect($test->to_user_id)->toBe($actor->id)
        ->and($test->to_address)->toBe($actor->email)
        ->and(mktCampanaAuditada('CMP-0012', 'envio_prueba'))->toBeTrue();
});

it('no se prueba una campaña con plantilla de WhatsApp sin aprobar ni una campaña ya enviada', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/marketing/campaigns/CMP-0013/test-send', [], critical()))->toBeApiError(422, 'MKT-BR-03');
    expect($this->postJson('/api/v1/marketing/campaigns/CMP-0008/test-send', [], critical()))->toBeApiError(409, 'MKT-BR-08');
    expect(mktPruebasVigentes('CMP-0013'))->toBe(0);
});

it('programar una campaña probada la deja programada en la fecha elegida', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/marketing/campaigns/CMP-0012/test-send', [], critical())->assertCreated();
    $version = mktCampanaVersion('CMP-0012');

    $this->postJson('/api/v1/marketing/campaigns/CMP-0012/schedule', ['scheduled_at' => '2026-10-02 10:00'], critical($version))->assertOk();

    $campaign = rowOf('mkt_campaigns', 'CMP-0012');
    expect($campaign->status)->toBe('programada')
        ->and(Carbon::parse($campaign->scheduled_at)->setTimezone('America/Lima')->format('Y-m-d H:i'))->toBe('2026-10-02 10:00')
        ->and((int) $campaign->lock_version)->toBe($version + 1)
        ->and(mktCampanaAuditada('CMP-0012', 'programar'))->toBeTrue();
    expect($this->postJson('/api/v1/marketing/campaigns/CMP-0012/schedule', ['scheduled_at' => '2026-10-03 10:00'], critical($version)))->toBeApiError(409, 'STALE_VERSION');
});

it('programar exige prueba previa, 15 minutos de anticipación y fecha válida', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/marketing/campaigns/CMP-0012/schedule', [], critical(mktCampanaVersion('CMP-0012')))->assertStatus(422)->assertJsonValidationErrors('scheduled_at');
    expect($this->postJson('/api/v1/marketing/campaigns/CMP-0012/schedule', ['scheduled_at' => '2026-10-02 10:00'], critical(mktCampanaVersion('CMP-0012'))))->toBeApiError(422, 'MKT-BR-04');

    $this->postJson('/api/v1/marketing/campaigns/CMP-0012/test-send', [], critical())->assertCreated();
    expect($this->postJson('/api/v1/marketing/campaigns/CMP-0012/schedule', ['scheduled_at' => '2026-09-29 10:05'], critical(mktCampanaVersion('CMP-0012'))))->toBeApiError(422, 'MKT-BR-05');
    expect($this->postJson('/api/v1/marketing/campaigns/CMP-0011/schedule', ['scheduled_at' => '2026-10-02 10:00'], critical(mktCampanaVersion('CMP-0011'))))->toBeApiError(409, 'MKT-BR-08');
    expect(rowOf('mkt_campaigns', 'CMP-0012')->status)->toBe('borrador');
});

it('WhatsApp promocional solo se programa entre las 08:00 y las 20:00', function () {
    actingAsSeed('U01');
    $code = $this->postJson('/api/v1/marketing/campaigns', mktCampanaDatos(['channel' => 'whatsapp', 'segment' => 'SEG-002', 'template' => 'TPL-04', 'subject' => null]))->assertCreated()->json('data.code');
    $this->postJson("/api/v1/marketing/campaigns/{$code}/test-send", [], critical())->assertCreated();

    expect($this->postJson("/api/v1/marketing/campaigns/{$code}/schedule", ['scheduled_at' => '2026-10-02 21:00'], critical(mktCampanaVersion($code))))->toBeApiError(422, 'MKT-BR-05');
});

it('no se programa una campaña sin destinatarios con consentimiento', function () {
    actingAsSeed('U01');
    $segment = collect($this->getJson('/api/v1/marketing/campaigns')->json('data.segments'))->firstWhere('email', 0);
    expect($segment)->not->toBeNull();

    $code = $this->postJson('/api/v1/marketing/campaigns', mktCampanaDatos(['segment' => $segment['code']]))->assertCreated()->json('data.code');
    $this->postJson("/api/v1/marketing/campaigns/{$code}/test-send", [], critical())->assertCreated();

    expect($this->postJson("/api/v1/marketing/campaigns/{$code}/schedule", ['scheduled_at' => '2026-10-02 10:00'], critical(mktCampanaVersion($code))))->toBeApiError(422, 'MKT-BR-07');
});

it('desprogramar devuelve la campaña a borrador y la deja editable', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/marketing/campaigns/CMP-0011/unschedule', [], critical(mktCampanaVersion('CMP-0011')))->assertOk();

    $campaign = rowOf('mkt_campaigns', 'CMP-0011');
    expect($campaign->status)->toBe('borrador')
        ->and($campaign->scheduled_at)->toBeNull()
        ->and(mktCampanaAuditada('CMP-0011', 'desprogramar'))->toBeTrue();
    $this->patchJson('/api/v1/marketing/campaigns/CMP-0011', mktCampanaDatos(['segment' => 'SEG-003', 'template' => 'TPL-02']))->assertOk();
    expect($this->postJson('/api/v1/marketing/campaigns/CMP-0011/unschedule', [], critical(mktCampanaVersion('CMP-0011'))))->toBeApiError(409, 'MKT-BR-08');
});

it('cancelar exige motivo, deja la campaña inmutable y no aplica a campañas enviadas', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/marketing/campaigns/CMP-0011/cancel', [], critical(mktCampanaVersion('CMP-0011')))->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->postJson('/api/v1/marketing/campaigns/CMP-0011/cancel', ['reason' => 'Se pospone la preventa'], critical(mktCampanaVersion('CMP-0011')))->assertOk();

    $campaign = rowOf('mkt_campaigns', 'CMP-0011');
    expect($campaign->status)->toBe('cancelada')
        ->and($campaign->cancel_reason)->toBe('Se pospone la preventa')
        ->and(mktCampanaAuditada('CMP-0011', 'cancelar'))->toBeTrue();
    expect($this->patchJson('/api/v1/marketing/campaigns/CMP-0011', mktCampanaDatos()))->toBeApiError(409, 'MKT-BR-08');
    expect($this->postJson('/api/v1/marketing/campaigns/CMP-0008/cancel', ['reason' => 'Ya se envió'], critical(mktCampanaVersion('CMP-0008'))))->toBeApiError(409, 'MKT-BR-08');
});
