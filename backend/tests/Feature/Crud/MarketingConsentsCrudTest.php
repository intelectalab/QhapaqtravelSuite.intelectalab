<?php

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

function mktContactos(object $test): Collection
{
    return collect($test->getJson('/api/v1/marketing/contacts')->assertOk()->json('data.contacts'));
}

function mktLeadSinConsentimiento(object $test): array
{
    return mktContactos($test)->first(fn (array $row): bool => $row['type'] === 'lead' && $row['email'] && $row['email_consent'] === null);
}

function mktConsentimientoDatos(array $contact, array $extra = []): array
{
    return [
        'subject_type' => $contact['type'],
        'subject_id' => $contact['id'],
        'channel' => 'email',
        'source' => 'Llamada grabada — consentimiento verbal',
        'evidence' => 'Grabación CALL-20260929-101',
        'policy_version' => 'PDP-2026.1',
        ...$extra,
    ];
}

function mktSegmentoEmail(object $test, string $code = 'SEG-001'): int
{
    return collect($test->getJson('/api/v1/marketing/campaigns')->json('data.segments'))->firstWhere('code', $code)['email'];
}

function mktConsentimientoAuditado(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Consentimiento')->where('entity_id', $code)->where('action', $action)->exists());
}

function mktEventos(string $code): int
{
    return withinTenant(tenantA(), fn () => DB::table('mkt_consent_events')->where('consent_id', idOf('mkt_consents', $code))->count());
}

it('lista los contactos con su consentimiento por canal, el origen y el historial', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/marketing/contacts')->assertOk()->json('data');
    $carla = collect($data['contacts'])->firstWhere('code', 'SUB-0001');
    $revoked = collect($data['contacts'])->firstWhere('code', 'CLI-0008');

    expect($carla['email_consent']['status'])->toBe('otorgado')
        ->and($carla['whatsapp_consent']['code'])->toBe('CNS-0020')
        ->and($carla['history'])->not->toBeEmpty()
        ->and($revoked['whatsapp_consent']['status'])->toBe('revocado')
        ->and($revoked['whatsapp_consent']['revoke_campaign'])->toBe('CMP-0010')
        ->and($revoked['href'])->toBe('/crm/clientes/CLI-0008')
        ->and($data['sources']['grant'])->toContain('Ficha física firmada en oficina')
        ->and(collect($this->getJson('/api/v1/marketing/contacts?filter[type]=lead')->json('data.contacts'))->pluck('type')->unique()->all())->toBe(['lead']);
});

it('lista los registros de consentimiento y su historial por código', function () {
    actingAsSeed('U01');

    $revoked = collect($this->getJson('/api/v1/marketing/consents?filter[status]=revocado')->assertOk()->json('data'));
    expect($revoked->pluck('status')->unique()->all())->toBe(['revocado'])
        ->and($revoked->pluck('code'))->toContain('CNS-0012');

    expect($this->getJson('/api/v1/marketing/consents/CNS-0012/events')->assertOk()->json('data'))->not->toBeEmpty();
    $this->getJson('/api/v1/marketing/consents/CNS-9999/events')->assertNotFound();
});

it('Ventas no ve ni registra consentimientos', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/marketing/contacts'))->toBeApiError(403);
    expect($this->postJson('/api/v1/marketing/consents', []))->toBeApiError(403);
});

it('registrar un consentimiento guarda origen, evidencia y política, deja historial y vuelve elegible al contacto', function () {
    actingAsSeed('U01');
    $lead = mktLeadSinConsentimiento($this);
    $eligible = mktSegmentoEmail($this);

    $code = $this->postJson('/api/v1/marketing/consents', mktConsentimientoDatos($lead))->assertCreated()->json('data.code');

    $consent = rowOf('mkt_consents', $code);
    expect($code)->toStartWith('CNS-')
        ->and($consent->status)->toBe('otorgado')
        ->and($consent->evidence)->toBe('Grabación CALL-20260929-101')
        ->and($consent->subject_id)->toBe($lead['id'])
        ->and(mktEventos($code))->toBe(1)
        ->and(mktConsentimientoAuditado($code, 'otorgar_email'))->toBeTrue()
        ->and(mktSegmentoEmail($this))->toBe($eligible + 1);
});

it('un consentimiento exige origen del catálogo, evidencia, política y dato de contacto', function () {
    actingAsSeed('U01');
    $lead = mktLeadSinConsentimiento($this);

    $this->postJson('/api/v1/marketing/consents', mktConsentimientoDatos($lead, ['source' => 'Casilla pre-marcada', 'evidence' => '', 'policy_version' => '']))
        ->assertStatus(422)->assertJsonValidationErrors(['source', 'evidence', 'policy_version']);
    expect($this->postJson('/api/v1/marketing/consents', mktConsentimientoDatos(mktContactos($this)->firstWhere('code', 'SUB-0001'))))->toBeApiError(409, 'MKT-BR-11');

    $sinMovil = mktContactos($this)->first(fn (array $row): bool => $row['mobile'] === null && $row['whatsapp_consent'] === null);
    expect($this->postJson('/api/v1/marketing/consents', mktConsentimientoDatos($sinMovil, ['channel' => 'whatsapp'])))->toBeApiError(422, 'MKT-BR-06');
});

it('registrar la baja revoca el consentimiento, suprime al contacto y es idempotente', function () {
    actingAsSeed('U01');
    $eligible = mktSegmentoEmail($this);
    $version = (int) rowOf('mkt_consents', 'CNS-0019')->lock_version;
    $events = mktEventos('CNS-0019');

    $this->postJson('/api/v1/marketing/consents/CNS-0019/revoke', ['source' => 'Solicitud ARCO (derecho de oposición)', 'lock_version' => $version])->assertOk();

    $consent = rowOf('mkt_consents', 'CNS-0019');
    expect($consent->status)->toBe('revocado')
        ->and($consent->revoke_source)->toBe('Solicitud ARCO (derecho de oposición)')
        ->and($consent->revoked_at)->not->toBeNull()
        ->and(mktEventos('CNS-0019'))->toBe($events + 1)
        ->and(mktConsentimientoAuditado('CNS-0019', 'baja_email'))->toBeTrue()
        ->and(mktSegmentoEmail($this))->toBe($eligible - 1)
        ->and(mktContactos($this)->firstWhere('code', 'SUB-0001')['email_consent']['status'])->toBe('revocado');

    $this->postJson('/api/v1/marketing/consents/CNS-0019/revoke', ['source' => 'Enlace de baja en correo'])->assertOk();
    expect(mktEventos('CNS-0019'))->toBe($events + 1);

    $this->postJson('/api/v1/marketing/consents/CNS-0019/revoke', ['source' => 'Origen inventado'])->assertStatus(422)->assertJsonValidationErrors('source');
});

it('la baja con una versión desactualizada no se aplica', function () {
    actingAsSeed('U01');
    $version = (int) rowOf('mkt_consents', 'CNS-0022')->lock_version;

    expect($this->postJson('/api/v1/marketing/consents/CNS-0022/revoke', ['source' => 'Enlace de baja en correo', 'lock_version' => $version + 5]))->toBeApiError(409, 'STALE_VERSION');
    expect(rowOf('mkt_consents', 'CNS-0022')->status)->toBe('otorgado');
});

it('una baja solo se revierte con un nuevo consentimiento expreso', function () {
    actingAsSeed('U01');
    $revoked = mktContactos($this)->firstWhere('code', 'CLI-0004');
    $events = mktEventos('CNS-0006');

    $code = $this->postJson('/api/v1/marketing/consents', mktConsentimientoDatos($revoked, ['source' => 'Ficha física firmada en oficina', 'evidence' => 'Ficha F-0450 firmada', 'lock_version' => (int) rowOf('mkt_consents', 'CNS-0006')->lock_version]))
        ->assertCreated()->json('data.code');

    $consent = rowOf('mkt_consents', 'CNS-0006');
    expect($code)->toBe('CNS-0006')
        ->and($consent->status)->toBe('otorgado')
        ->and($consent->revoked_at)->toBeNull()
        ->and($consent->evidence)->toBe('Ficha F-0450 firmada')
        ->and(mktEventos('CNS-0006'))->toBe($events + 1);
});
