<?php

use App\Domain\Finance\Support\DerivedTokens;
use App\Domain\Operations\Support\CheckinPasses;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

function scanAppFreeze(string $serviceCode): void
{
    $now = CarbonImmutable::parse(rowOf('booking_reservation_services', $serviceCode)->service_date.' 09:00:00', 'America/Lima');
    Carbon::setTestNow($now);
    CarbonImmutable::setTestNow($now);
}

function scanAppPass(string $serviceCode, int $index = 0): array
{
    return withinTenant(tenantA(), function () use ($serviceCode, $index) {
        $service = DB::table('booking_reservation_services')->where('code', $serviceCode)->value('id');
        $pass = DB::table('ops_checkin_passes as p')->join('booking_passengers as b', 'b.id', '=', 'p.passenger_id')->where('p.service_id', $service)->where('p.status', 'emitido')
            ->orderByDesc('b.is_lead')->orderBy('b.seq')->skip($index)->first(['p.id', 'p.passenger_id']);

        return ['token' => CheckinPasses::token((string) $pass->id), 'passenger_id' => (string) $pass->passenger_id];
    });
}

function scanAppStartService(string $serviceCode): string
{
    return withinTenant(tenantA(), function () use ($serviceCode) {
        $service = DB::table('booking_reservation_services')->where('code', $serviceCode)->value('id');
        DB::table('ops_assignments')->where('reservation_service_id', $service)->update(['status' => 'en_curso', 'first_checkin_at' => null]);
        DB::table('ops_assignment_checkins')->whereIn('assignment_id', DB::table('ops_assignments')->where('reservation_service_id', $service)->pluck('id'))->delete();

        return (string) DB::table('ops_assignments')->where('reservation_service_id', $service)->value('id');
    });
}

beforeEach(function () {
    withinTenant(tenantA(), fn () => DB::table('ops_waiver_templates')->update(['active' => false]));
});

it('POST /api/v1/ops/checkin/scan desde la app marca el ingreso en el servicio y en la lista de pasajeros de la asignación', function () {
    actingAsSeed('U09');
    $this->getJson('/api/v1/ops/checkin/manifest/RS-3483')->assertOk();
    $pass = scanAppPass('RS-3483');
    $assignment = scanAppStartService('RS-3483');
    scanAppFreeze('RS-3483');

    $key = idem();
    $scan = $this->postJson('/api/v1/ops/checkin/scan', ['token' => $pass['token'], 'service_id' => 'RS-3483', 'device_id' => 'android-guia-01'], critical(key: $key))->assertOk()->json('data');

    expect($scan['result'])->toBe('ingreso')
        ->and($scan['passenger_id'])->toBe($pass['passenger_id'])
        ->and($scan['service']['code'])->toBe('RS-3483')
        ->and($scan['counts']['checked_in'])->toBe(1);

    $checkin = withinTenant(tenantA(), fn () => DB::table('ops_assignment_checkins')->where('assignment_id', $assignment)->where('passenger_id', $pass['passenger_id'])->whereNull('undone_at')->first());
    expect($checkin)->not->toBeNull()
        ->and($checkin->source)->toBe('app')
        ->and(rowOf('ops_assignments', $assignment, column: 'id')->first_checkin_at)->not->toBeNull();

    $replay = $this->postJson('/api/v1/ops/checkin/scan', ['token' => $pass['token'], 'service_id' => 'RS-3483', 'device_id' => 'android-guia-01'], critical(key: $key))->assertOk()->json('data');
    expect($replay['passenger_id'])->toBe($pass['passenger_id']);

    expect($this->postJson('/api/v1/ops/checkin/scan', ['token' => $pass['token'], 'service_id' => 'RS-3483'], critical()))->toBeApiError(409, 'PASS_ALREADY_USED');
    expect(withinTenant(tenantA(), fn () => DB::table('ops_assignment_checkins')->where('assignment_id', $assignment)->whereNull('undone_at')->count()))->toBe(1);
});

it('POST /api/v1/ops/checkin/scan rechaza el pase de otro servicio sin usarlo', function () {
    actingAsSeed('U05');
    $this->getJson('/api/v1/ops/checkin/manifest/RS-3476')->assertOk();
    $this->getJson('/api/v1/ops/checkin/manifest/RS-3483')->assertOk();
    $foreign = scanAppPass('RS-3476');
    scanAppFreeze('RS-3476');

    expect($this->postJson('/api/v1/ops/checkin/scan', ['token' => $foreign['token'], 'service_id' => 'RS-3483'], critical()))->toBeApiError(422, 'PASS_OTHER_SERVICE');
    expect($this->postJson('/api/v1/ops/checkin/scan', ['token' => $foreign['token'], 'service_id' => 'RS-0000'], critical()))->toBeApiError(404);

    $status = withinTenant(tenantA(), fn () => DB::table('ops_checkin_passes')->where('token_hash', DerivedTokens::hash($foreign['token']))->value('status'));
    expect($status)->toBe('emitido');

    $this->postJson('/api/v1/ops/checkin/scan', ['token' => $foreign['token'], 'service_id' => 'RS-3476'], critical())->assertOk()->assertJsonPath('data.result', 'ingreso');
});

it('POST /api/v1/ops/checkin/scan no deja al guía registrar un servicio que no tiene asignado aunque indique el servicio', function () {
    actingAsSeed('U05');
    $this->getJson('/api/v1/ops/checkin/manifest/RS-3476')->assertOk();
    $foreign = scanAppPass('RS-3476');
    scanAppFreeze('RS-3476');

    actingAsSeed('U09');
    expect($this->postJson('/api/v1/ops/checkin/scan', ['token' => $foreign['token'], 'service_id' => 'RS-3476', 'device_id' => 'android-guia-01'], critical()))->toBeApiError(403, 'CHECKIN_NOT_ASSIGNED');
});
