<?php

use App\Domain\Operations\Support\EvidenceStore;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

beforeEach(function () {
    config(['access.experience_routes.mobile' => ['mobile.operator.', 'mobile.devices.']]);
    Storage::fake((string) config('filesystems.default'));
});

function operatorAssignment(): object
{
    return withinTenant(tenantA(), function (): object {
        $guide = (string) DB::table('iam_users')->where('code', 'U09')->value('guide_id');
        $assignment = DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')->whereNotIn('o.status', ['completada', 'cancelada'])->whereNull('o.deleted_at')
            ->orderBy('o.code')->orderBy('a.service_date')->first(['a.id', 'a.order_id', 'a.reservation_service_id', 'o.code as order_code', 'o.reservation_id']);
        DB::table('ops_assignments')->where('guide_id', $guide)->where('id', '<>', $assignment->id)->update(['guide_id' => null, 'status' => 'pendiente', 'driver_id' => null, 'vehicle_id' => null]);
        DB::table('ops_assignments')->where('id', $assignment->id)->update(['status' => 'asignada', 'guide_id' => $guide, 'service_date' => BUSINESS_TODAY, 'service_time' => '08:00', 'confirmed_at' => null, 'started_at' => null, 'finished_at' => null]);
        DB::table('ops_assignment_checkins')->where('assignment_id', $assignment->id)->delete();
        DB::table('booking_reservation_services')->where('id', $assignment->reservation_service_id)->update(['status' => 'confirmado']);

        return $assignment;
    });
}

function operatorAction(string $device, string $assignment, string $type, array $payload = [], array $extra = []): array
{
    return ['client_action_id' => (string) Str::uuid7(), 'device_id' => $device, 'assignment_id' => $assignment, 'type' => $type, 'occurred_at' => now()->toIso8601String(), 'offline' => false, 'payload' => $payload, ...$extra];
}

function operatorUpload(object $assignment): array
{
    return withinTenant(tenantA(), function (): array {
        $upload = (string) Str::uuid7();
        $content = 'foto-evidencia-'.$upload;
        $path = EvidenceStore::path((string) tenantA()->getKey(), $upload, 'image/jpeg');
        EvidenceStore::disk()->put($path, $content);
        Cache::put(EvidenceStore::uploadKey((string) tenantA()->getKey(), $upload), ['user_id' => seedUser('U09')->getKey(), 'path' => $path, 'file_name' => 'grupo.jpg', 'mime' => 'image/jpeg', 'size' => strlen($content), 'sha256' => hash('sha256', $content)], now()->addMinutes(30));

        return ['upload_id' => $upload, 'sha256' => hash('sha256', $content)];
    });
}

it('el guía confirma, inicia, hace check-in, sube evidencia y finaliza con no-show', function () {
    $assignment = operatorAssignment();
    actingAsSeed('U09');

    $me = $this->getJson('/api/v1/mobile/operator/me')->assertOk()->json('data');
    expect($me['type'])->toBe('guide');
    $device = $this->postJson('/api/v1/mobile/devices', ['platform' => 'android', 'app_version' => '1.0.0'])->assertCreated()->json('data.id');

    $boot = $this->getJson('/api/v1/mobile/operator/bootstrap')->assertOk()->json('data');
    expect(collect($boot['assignments'])->pluck('id'))->toContain($assignment->id);

    expect($this->postJson('/api/v1/mobile/operator/actions', operatorAction($device, $assignment->id, 'start'))->json('data.result'))->toBe('rejected');
    $confirm = operatorAction($device, $assignment->id, 'confirm');
    expect($this->postJson('/api/v1/mobile/operator/actions', $confirm)->assertOk()->json('data.result'))->toBe('applied')
        ->and($this->postJson('/api/v1/mobile/operator/actions', $confirm)->json('data.result'))->toBe('duplicate')
        ->and($this->postJson('/api/v1/mobile/operator/actions', operatorAction($device, $assignment->id, 'confirm'))->json('data.conflict_rule'))->toBe('MOB-BR-05');

    withinTenant(tenantA(), fn () => DB::table('ops_orders')->where('id', $assignment->order_id)->update(['status' => 'confirmada']));
    expect($this->postJson('/api/v1/mobile/operator/actions', operatorAction($device, $assignment->id, 'start'))->json('data.result'))->toBe('applied');
    expect(rowOf('ops_assignments', $assignment->id, column: 'id')->status)->toBe('en_curso')
        ->and(rowOf('ops_orders', $assignment->order_code)->status)->toBe('en_ejecucion');

    $finishEarly = $this->postJson('/api/v1/mobile/operator/actions', operatorAction($device, $assignment->id, 'finish'))->json('data');
    expect($finishEarly['result'])->toBe('rejected')->and($finishEarly['conflict_rule'])->toBe('OPS-BR-51');

    $passengers = withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', $assignment->reservation_id)->orderBy('seq')->pluck('id')->map(fn ($id) => (string) $id)->all());
    expect($this->postJson('/api/v1/mobile/operator/actions', operatorAction($device, $assignment->id, 'checkin', ['passenger_id' => $passengers[0]]))->json('data.result'))->toBe('applied')
        ->and($this->postJson('/api/v1/mobile/operator/actions', operatorAction($device, $assignment->id, 'checkin', ['passenger_id' => $passengers[0]]))->json('data.conflict_rule'))->toBe('MOB-BR-06');

    $upload = operatorUpload($assignment);
    $evidence = $this->postJson('/api/v1/mobile/operator/actions', operatorAction($device, $assignment->id, 'evidence', $upload))->assertOk()->json('data');
    expect($evidence['result'])->toBe('applied')
        ->and($this->postJson('/api/v1/mobile/operator/actions', operatorAction($device, $assignment->id, 'evidence', ['sha256' => $upload['sha256']]))->json('data.conflict_rule'))->toBe('MOB-BR-09');

    $finish = $this->postJson('/api/v1/mobile/operator/actions', operatorAction($device, $assignment->id, 'finish'))->assertOk()->json('data');
    expect($finish['result'])->toBe('applied')
        ->and(rowOf('ops_assignments', $assignment->id, column: 'id')->status)->toBe('completada')
        ->and(rowOf('booking_reservation_services', $assignment->reservation_service_id, column: 'id')->status)->toBe('completado')
        ->and(count($finish['data']['no_show']))->toBe(count($passengers) - 1)
        ->and(collect($finish['assignment']['passengers'])->where('no_show', true)->count())->toBe(count($passengers) - 1);
    expect(withinTenant(tenantA(), fn () => DB::table('ops_sync_actions')->where('assignment_id', $assignment->id)->count()))->toBeGreaterThanOrEqual(8);
});

it('iniciar un servicio desde la app no pone en ejecución una orden que aún no está confirmada', function () {
    $assignment = operatorAssignment();
    withinTenant(tenantA(), fn () => DB::table('ops_orders')->where('id', $assignment->order_id)->update(['status' => 'asignada']));
    actingAsSeed('U09');
    $device = $this->postJson('/api/v1/mobile/devices', ['platform' => 'android', 'app_version' => '1.0.0'])->assertCreated()->json('data.id');

    $this->postJson('/api/v1/mobile/operator/actions', operatorAction($device, $assignment->id, 'confirm'))->assertOk();
    expect($this->postJson('/api/v1/mobile/operator/actions', operatorAction($device, $assignment->id, 'start'))->json('data.result'))->toBe('applied')
        ->and(rowOf('ops_assignments', $assignment->id, column: 'id')->status)->toBe('en_curso')
        ->and(rowOf('ops_orders', $assignment->order_code)->status)->not->toBe('en_ejecucion');
});

it('la sincronización del outbox procesa el lote en orden y es idempotente', function () {
    $assignment = operatorAssignment();
    actingAsSeed('U09');
    $device = $this->postJson('/api/v1/mobile/devices', ['platform' => 'ios', 'app_version' => '1.0.0'])->assertCreated()->json('data.id');
    $start = operatorAction($device, $assignment->id, 'start', [], ['occurred_at' => now()->addMinute()->toIso8601String(), 'offline' => true]);
    $confirm = operatorAction($device, $assignment->id, 'confirm', [], ['occurred_at' => now()->toIso8601String(), 'offline' => true]);

    $results = $this->postJson('/api/v1/mobile/operator/sync', ['actions' => [$start, $confirm]])->assertOk()->json('data.results');
    expect(collect($results)->pluck('type')->all())->toBe(['confirm', 'start'])
        ->and(collect($results)->pluck('result')->all())->toBe(['applied', 'applied']);

    $again = $this->postJson('/api/v1/mobile/operator/sync', ['actions' => [$start, $confirm]])->assertOk()->json('data.results');
    expect(collect($again)->pluck('result')->unique()->all())->toBe(['duplicate']);

    $this->postJson('/api/v1/mobile/operator/sync', ['actions' => []])->assertStatus(422);
});

it('el guía reporta una incidencia desde la app y solo opera sus propias asignaciones', function () {
    $assignment = operatorAssignment();
    actingAsSeed('U09');
    $device = $this->postJson('/api/v1/mobile/devices', ['platform' => 'android', 'app_version' => '1.0.0'])->assertCreated()->json('data.id');

    $incident = $this->postJson('/api/v1/mobile/operator/incidents', [...operatorAction($device, $assignment->id, 'incident'), 'type' => 'Transporte', 'severity' => 'alta', 'title' => 'Bus con falla mecánica'])->assertCreated()->json('data');
    $code = $incident['data']['incident'];
    expect(rowOf('ops_incidents', $code)->source)->toBe('app_operador')
        ->and(rowOf('ops_incidents', $code)->description)->toBe('Bus con falla mecánica')
        ->and(collect($this->getJson('/api/v1/mobile/operator/incidents')->assertOk()->json('data.rows'))->pluck('code'))->toContain($code);

    $other = withinTenant(tenantA(), fn () => (string) DB::table('ops_assignments')->where('id', '<>', $assignment->id)->whereNull('guide_id')->value('id'));
    $rejected = $this->postJson('/api/v1/mobile/operator/actions', operatorAction($device, $other, 'confirm'))->assertOk()->json('data');
    expect($rejected['result'])->toBe('rejected')->and($rejected['conflict_rule'])->toBe('MOB-BR-10');
    $this->getJson("/api/v1/mobile/operator/assignments/{$other}")->assertNotFound();

    $this->deleteJson("/api/v1/mobile/devices/{$device}")->assertOk();
    expect($this->postJson('/api/v1/mobile/operator/actions', operatorAction($device, $assignment->id, 'confirm')))->toBeApiError(403, 'MOB-BR-01');
});

it('un usuario sin recurso vinculado recibe MOB-BR-13', function () {
    withinTenant(tenantA(), fn () => DB::table('iam_users')->where('code', 'U10')->update(['guide_id' => null, 'driver_id' => null]));
    actingAsSeed('U10');

    expect($this->getJson('/api/v1/mobile/operator/me'))->toBeApiError(403, 'MOB-BR-13');
});

it('05 §6.6: el guía pide la URL firmada para subir la foto de evidencia desde la app', function () {
    Storage::fake(EvidenceStore::diskName());
    Storage::disk(EvidenceStore::diskName())->buildTemporaryUploadUrlsUsing(fn (string $path) => ['url' => "https://storage.test/{$path}?signature=x", 'headers' => []]);
    actingAsSeed('U09');

    $signed = $this->postJson('/api/v1/ops/evidences/presign', ['file_name' => 'grupo.jpg', 'mime' => 'image/jpeg', 'size' => 2048, 'sha256' => str_repeat('b', 64)])->assertOk()->json('data');

    expect($signed)->toHaveKeys(['upload_id', 'method', 'url', 'expires_at'])
        ->and($signed['url'])->toStartWith('https://storage.test/');
});

it('05 §2.1: el detalle trae el punto de encuentro (salida, recojo elegido o el del producto)', function () {
    $assignment = operatorAssignment();
    actingAsSeed('U09');

    $point = $this->getJson("/api/v1/mobile/operator/assignments/{$assignment->id}")->assertOk()->json('data.meeting_point');
    expect($point)->toHaveKeys(['text', 'source'])->and($point['source'])->toBeIn(['salida', 'cliente', 'producto'])->and($point['text'])->not->toBe('');

    withinTenant(tenantA(), function () use ($assignment): void {
        $departure = DB::table('catalog_product_departures')->value('id');
        DB::table('catalog_product_departures')->where('id', $departure)->update(['meeting_point' => 'Plaza de Armas, frente a la Catedral']);
        DB::table('booking_reservation_services')->where('id', $assignment->reservation_service_id)->update(['departure_id' => $departure]);
    });

    expect($this->getJson("/api/v1/mobile/operator/assignments/{$assignment->id}")->json('data.meeting_point'))->toBe(['text' => 'Plaza de Armas, frente a la Catedral', 'source' => 'salida']);
});

it('la URL firmada usa AWS_PRESIGN_ENDPOINT cuando el teléfono no ve el host interno del almacenamiento', function () {
    config([
        'filesystems.default' => 's3',
        'filesystems.disks.s3' => ['driver' => 's3', 'key' => 'k', 'secret' => 's', 'region' => 'us-east-1', 'bucket' => 'evidencias', 'endpoint' => 'http://storage:9000', 'use_path_style_endpoint' => true, 'presign_endpoint' => 'http://192.168.1.50:9000'],
    ]);

    $signed = EvidenceStore::signingDisk()->temporaryUploadUrl('ops/foto.jpg', now()->addMinutes(5), ['ContentType' => 'image/jpeg']);

    expect($signed['url'])->toStartWith('http://192.168.1.50:9000/evidencias/ops/foto.jpg')
        ->and(EvidenceStore::disk()->temporaryUploadUrl('ops/foto.jpg', now()->addMinutes(5))['url'])->toStartWith('http://storage:9000/');
});
