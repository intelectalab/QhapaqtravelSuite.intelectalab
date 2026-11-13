<?php

use App\Domain\Operations\Support\CheckinPasses;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

function crecAFreeze(string $date): void
{
    $now = CarbonImmutable::parse($date.' 09:00:00', 'America/Lima');
    Carbon::setTestNow($now);
    CarbonImmutable::setTestNow($now);
}

function crecAPassToken(string $serviceCode, int $index = 0): string
{
    return withinTenant(tenantA(), function () use ($serviceCode, $index) {
        $service = DB::table('booking_reservation_services')->where('code', $serviceCode)->value('id');
        $pass = DB::table('ops_checkin_passes as p')->join('booking_passengers as b', 'b.id', '=', 'p.passenger_id')->where('p.service_id', $service)->where('p.status', 'emitido')->orderByDesc('b.is_lead')->orderBy('b.seq')->skip($index)->value('p.id');

        return CheckinPasses::token((string) $pass);
    });
}

function crecAServiceDate(string $serviceCode): string
{
    return (string) rowOf('booking_reservation_services', $serviceCode)->service_date;
}

function crecAWaiverBody(): array
{
    return ['name' => 'Deslinde de actividades de aventura', 'lang' => 'es', 'body' => 'Declaro que conozco los riesgos de la actividad, que sigo las indicaciones del guía y que la agencia no responde por imprudencias propias.', 'requires_guardian_for_minors' => true];
}

it('GET /ops/checkin/manifest emite los pases del servicio y muestra el manifiesto al guía asignado', function () {
    actingAsSeed('U09');

    $manifest = $this->getJson('/api/v1/ops/checkin/manifest/RS-3483')->assertOk()->json('data');
    $passengers = withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', idOf('booking_reservations', 'RES-2026-000348'))->where('is_placeholder', false)->count());

    expect($manifest['service']['code'])->toBe('RS-3483')
        ->and($manifest['counts']['total'])->toBe($passengers)
        ->and($manifest['counts']['checked_in'])->toBe(0)
        ->and(collect($manifest['passengers'])->pluck('pass_status')->unique()->all())->toBe(['emitido']);

    $day = $this->getJson('/api/v1/ops/checkin/manifest/'.crecAServiceDate('RS-3483'))->assertOk()->json('data');
    expect(collect($day['services'])->pluck('code'))->toContain('RS-3483');

    actingAsSeed('U10');
    expect($this->getJson('/api/v1/ops/checkin/manifest/RS-3483'))->toBeApiError(403, 'CHECKIN_NOT_ASSIGNED');
});

it('SC-14: el pase se usa una sola vez, solo el día del servicio y por el guía asignado', function () {
    withinTenant(tenantA(), fn () => DB::table('ops_waiver_templates')->update(['active' => false]));
    actingAsSeed('U09');
    $this->getJson('/api/v1/ops/checkin/manifest/RS-3483')->assertOk();
    $token = crecAPassToken('RS-3483');

    expect($this->postJson('/api/v1/ops/checkin/scan', ['token' => $token], critical()))->toBeApiError(422, 'SERVICE_NOT_TODAY');

    crecAFreeze(crecAServiceDate('RS-3483'));
    actingAsSeed('U10');
    expect($this->postJson('/api/v1/ops/checkin/scan', ['token' => $token], critical()))->toBeApiError(403, 'CHECKIN_NOT_ASSIGNED');

    actingAsSeed('U09');
    $scan = $this->postJson('/api/v1/ops/checkin/scan', ['token' => $token, 'device_id' => 'android-guia-01'], critical())->assertOk()->json('data');
    expect($scan['result'])->toBe('ingreso')->and($scan['counts']['checked_in'])->toBe(1);

    expect($this->postJson('/api/v1/ops/checkin/scan', ['token' => $token], critical()))->toBeApiError(409, 'PASS_ALREADY_USED');
    expect($this->postJson('/api/v1/ops/checkin/scan', ['token' => 'KPQ-token-que-no-existe-0000'], critical()))->toBeApiError(404);
    expect(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Check-in', 'entity_id' => 'RS-3483', 'action' => 'checkin'])->exists()))->toBeTrue();
});

it('POST /ops/waiver-templates crea versiones y GET las lista agrupadas', function () {
    actingAsSeed('U05');

    $first = $this->postJson('/api/v1/ops/waiver-templates', crecAWaiverBody())->assertOk()->json('data');
    expect($first['code'])->toStartWith('DES-')->and($first['current_version'])->toBe(1);

    $second = $this->postJson('/api/v1/ops/waiver-templates', [...crecAWaiverBody(), 'code' => $first['code'], 'name' => 'Deslinde de aventura v2'])->assertOk()->json('data');
    expect($second['current_version'])->toBe(2)->and($second['versions'])->toHaveCount(2)->and($second['versions'][1]['active'])->toBeFalse();

    $list = $this->getJson('/api/v1/ops/waiver-templates')->assertOk()->json('data');
    expect(collect($list['templates'])->pluck('code'))->toContain($first['code']);
    expect($this->postJson('/api/v1/ops/waiver-templates', ['name' => 'X', 'body' => 'corto']))->toBeApiError(422);
});

it('SC-14: sin deslinde firmado no hay check-in; el pasajero firma en su portal y luego ingresa', function () {
    actingAsSeed('U05');
    $template = $this->postJson('/api/v1/ops/waiver-templates', crecAWaiverBody())->assertOk()->json('data');

    actingAsSeed('U15');
    $portal = $this->getJson('/api/v1/portal/passenger/passes')->assertOk()->json('data');
    expect($portal['trip']['code'])->toBe('RES-2026-000347')
        ->and($portal['waiver']['code'])->toBe($template['code'])
        ->and(collect($portal['passes'])->pluck('service.code'))->toContain('RS-3476')
        ->and(collect($portal['passengers'])->pluck('waiver')->unique()->all())->toBe(['pendiente']);

    $lead = $portal['passengers'][0];
    $token = collect(collect($portal['passes'])->firstWhere('service.code', 'RS-3476')['passengers'])->firstWhere('passenger_id', $lead['id'])['token'];

    crecAFreeze(crecAServiceDate('RS-3476'));
    actingAsSeed('U05');
    expect($this->postJson('/api/v1/ops/checkin/scan', ['token' => $token], critical()))->toBeApiError(422, 'WAIVER_REQUIRED');

    actingAsSeed('U15');
    $signature = UploadedFile::fake()->image('firma.png', 300, 120);
    $signed = $this->post('/api/v1/portal/passenger/waivers', ['passenger_id' => $lead['id'], 'template_code' => $template['code'], 'signed_name' => $lead['name'], 'file' => $signature], critical())->assertOk()->json('data');
    expect($signed['waiver'])->toBe('firmado');
    expect($this->post('/api/v1/portal/passenger/waivers', ['passenger_id' => $lead['id'], 'template_code' => $template['code'], 'signed_name' => $lead['name'], 'file' => UploadedFile::fake()->image('firma.png')], critical()))->toBeApiError(409, 'WAIVER_ALREADY_SIGNED');

    $row = withinTenant(tenantA(), fn () => DB::table('ops_waiver_signatures')->where('passenger_id', $lead['id'])->first());
    expect($row->body_sha256)->toBe(hash('sha256', crecAWaiverBody()['body']));

    actingAsSeed('U05');
    $this->postJson('/api/v1/ops/checkin/scan', ['token' => $token], critical())->assertOk()->assertJsonPath('data.result', 'ingreso');
});

it('el portal no deja firmar por un pasajero de otro viaje', function () {
    actingAsSeed('U05');
    $template = $this->postJson('/api/v1/ops/waiver-templates', crecAWaiverBody())->assertOk()->json('data');
    $foreign = withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', idOf('booking_reservations', 'RES-2026-000348'))->value('id'));

    actingAsSeed('U15');
    expect($this->post('/api/v1/portal/passenger/waivers', ['passenger_id' => $foreign, 'template_code' => $template['code'], 'signed_name' => 'Otra Persona', 'file' => UploadedFile::fake()->image('firma.png')], critical()))->toBeApiError(404);
});
