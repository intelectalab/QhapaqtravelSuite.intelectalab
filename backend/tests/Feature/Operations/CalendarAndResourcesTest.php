<?php

use Illuminate\Support\Facades\DB;

function calendarDeparture(array $values = []): object
{
    return withinTenant(tenantA(), function () use ($values): object {
        $departure = DB::table('catalog_product_departures')->where('status', '<>', 'cancelada')->orderBy('ref')->first();
        DB::table('catalog_product_departures')->where('id', $departure->id)->update(['departure_date' => BUSINESS_TODAY, 'departure_time' => '07:30', ...$values]);

        return DB::table('catalog_product_departures')->where('id', $departure->id)->first();
    });
}

function calendarAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

it('el calendario operativo incluye las salidas programadas con su KPI y el detalle de la asignación', function () {
    $guide = withinTenant(tenantA(), fn () => (string) DB::table('ops_guides')->whereNull('deleted_at')->orderBy('code')->value('id'));
    $departure = calendarDeparture(['guide_id' => $guide, 'vehicle_id' => null]);
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/ops/calendar?month='.substr(BUSINESS_TODAY, 0, 7))->assertOk()->json('data');
    $event = collect($data['events'])->firstWhere('id', 'dep-'.$departure->id);

    expect($event)->not->toBeNull()
        ->and($event['source'])->toBe('departure')
        ->and($event['departure']['ref'])->toBe($departure->ref)
        ->and($event['pending'])->toBeTrue()
        ->and($event['pending_reason'])->toBe('Sin vehículo')
        ->and($data['kpis']['departures'])->toBe(collect($data['events'])->where('source', 'departure')->filter(fn ($row) => str_starts_with($row['date'], substr(BUSINESS_TODAY, 0, 7)))->count())
        ->and($data['options'])->not->toBeNull();

    $service = collect($data['events'])->first(fn ($row) => $row['source'] === 'service' && $row['assignment'] !== null);
    expect($service['assignment'])->toHaveKeys(['id', 'lock_version', 'status', 'guide', 'driver', 'vehicle'])
        ->and($service['client'])->toHaveKey('name');
});

it('la matriz de disponibilidad muestra 7 días con órdenes, salidas y documentos vencidos', function () {
    $guide = withinTenant(tenantA(), fn () => (string) DB::table('ops_guides')->whereNull('deleted_at')->orderBy('code')->value('id'));
    calendarDeparture(['guide_id' => $guide]);
    $driver = withinTenant(tenantA(), function (): string {
        $driver = (string) DB::table('ops_drivers')->whereNull('deleted_at')->orderBy('code')->value('id');
        DB::table('ops_drivers')->where('id', $driver)->update(['license_expires_on' => BUSINESS_TODAY, 'status' => 'disponible']);

        return $driver;
    });
    actingAsSeed('U05');

    $data = $this->getJson('/api/v1/ops/resources/availability?from='.BUSINESS_TODAY)->assertOk()->json('data');
    expect($data['days'])->toHaveCount(7)->and($data['days'][0])->toBe(BUSINESS_TODAY);

    $guideRow = collect($data['groups'][0]['rows'])->firstWhere('id', $guide);
    expect(collect($guideRow['days'][0]['items'])->pluck('source'))->toContain('departure')
        ->and($guideRow['days'][0]['state'])->toBe('ocupado');

    $driverRow = collect($data['groups'][1]['rows'])->firstWhere('id', $driver);
    expect($driverRow['days'][0]['document'])->toBe('vence_hoy')
        ->and($driverRow['days'][1]['state'])->toBe('documento_vencido');

    $this->getJson('/api/v1/ops/resources/availability?from=ayer')->assertStatus(422)->assertJsonValidationErrors('from');
});

it('vincula y desvincula un guía con un usuario del rol Guía y lo audita', function () {
    $free = withinTenant(tenantA(), function (): object {
        $guide = DB::table('ops_guides')->whereNull('deleted_at')->whereNull('user_id')->orderBy('code')->first();
        $user = DB::table('iam_users')->where('code', 'U10')->first();
        DB::table('iam_users')->where('id', $user->id)->update(['guide_id' => null]);
        DB::table('ops_guides')->where('user_id', $user->id)->update(['user_id' => null]);

        return (object) ['guide' => $guide, 'user' => $user];
    });
    actingAsSeed('U01');
    $payload = ['full_name' => $free->guide->full_name, 'languages' => ['ES'], 'license_number' => $free->guide->license_number, 'status' => 'disponible'];

    $this->patchJson("/api/v1/ops/resources/guias/{$free->guide->id}", [...$payload, 'user_id' => $free->user->id])->assertOk();
    expect(rowOf('ops_guides', $free->guide->id, column: 'id')->user_id)->toBe($free->user->id)
        ->and(rowOf('iam_users', 'U10')->guide_id)->toBe($free->guide->id)
        ->and(calendarAudit(['entity' => 'Guía', 'entity_id' => $free->guide->code, 'action' => 'vincular_usuario']))->toBeTrue();

    $overview = $this->getJson('/api/v1/ops/resources')->assertOk()->json('data');
    expect(collect($overview['guides'])->firstWhere('id', $free->guide->id)['user']['id'])->toBe($free->user->id)
        ->and(collect($overview['users']['guide'])->pluck('value'))->toContain($free->user->id);

    $other = withinTenant(tenantA(), fn () => DB::table('ops_guides')->whereNull('deleted_at')->where('id', '<>', $free->guide->id)->orderBy('code')->first());
    $this->patchJson("/api/v1/ops/resources/guias/{$other->id}", ['full_name' => $other->full_name, 'languages' => ['ES'], 'license_number' => $other->license_number, 'status' => 'disponible', 'user_id' => $free->user->id])->assertStatus(409);

    $driverUser = seedUser('U11')->getKey();
    $this->patchJson("/api/v1/ops/resources/guias/{$free->guide->id}", [...$payload, 'user_id' => $driverUser])->assertStatus(422);

    $this->patchJson("/api/v1/ops/resources/guias/{$free->guide->id}", [...$payload, 'user_id' => null])->assertOk();
    expect(rowOf('ops_guides', $free->guide->id, column: 'id')->user_id)->toBeNull()
        ->and(rowOf('iam_users', 'U10')->guide_id)->toBeNull()
        ->and(calendarAudit(['entity' => 'Guía', 'entity_id' => $free->guide->code, 'action' => 'desvincular_usuario']))->toBeTrue();
});
