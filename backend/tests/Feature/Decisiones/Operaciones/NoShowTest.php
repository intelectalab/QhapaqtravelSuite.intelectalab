<?php

use App\Domain\Operations\Support\NoShowEffects;
use Illuminate\Support\Facades\DB;

function opsNoShowSetup(): object
{
    return withinTenant(tenantA(), function (): object {
        $assignment = DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')->whereNotIn('o.status', ['completada', 'cancelada'])->whereNull('o.deleted_at')
            ->whereRaw('(select count(*) from booking_passengers p where p.reservation_id = o.reservation_id) >= 2')
            ->orderBy('o.code')->orderBy('a.service_date')->first(['a.id', 'a.order_id', 'a.reservation_service_id', 'o.code as order_code', 'o.reservation_id']);
        DB::table('ops_assignments')->where('id', $assignment->id)->update(['status' => 'en_curso', 'service_date' => BUSINESS_TODAY, 'started_at' => now()]);
        DB::table('ops_assignment_checkins')->where('assignment_id', $assignment->id)->delete();
        DB::table('booking_reservation_services')->where('id', $assignment->reservation_service_id)->update(['status' => 'confirmado', 'service_date' => BUSINESS_TODAY, 'price_amount' => '800.00', 'pax' => 2]);
        DB::table('ops_no_shows')->where('reservation_id', $assignment->reservation_id)->delete();
        $service = DB::table('booking_reservation_services')->where('id', $assignment->reservation_service_id)->first(['code', 'currency']);
        $passengers = DB::table('booking_passengers')->where('reservation_id', $assignment->reservation_id)->orderBy('seq')->pluck('id')->map(fn ($id) => (string) $id)->all();

        return (object) [...(array) $assignment, 'service_code' => $service->code, 'currency' => $service->currency, 'passengers' => $passengers];
    });
}

function opsNoShowSettings(array $changes): void
{
    $version = (int) withinTenant(tenantA(), fn () => DB::table('sys_settings')->where('section', 'operations')->value('lock_version'));
    $values = test()->getJson('/api/v1/settings')->assertOk()->json('data.sections.operations.values');
    test()->patchJson('/api/v1/settings/operations', [...$values, ...$changes], ['If-Match' => (string) $version])->assertOk();
}

function opsNoShowAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

it('G3-28: registra el no-show por pasajero desde la orden, avisa al asesor y permite corregir la nota y anularlo', function () {
    $setup = opsNoShowSetup();
    [$present, $absent] = $setup->passengers;
    withinTenant(tenantA(), fn () => DB::table('ops_assignment_checkins')->insert(['assignment_id' => $setup->id, 'passenger_id' => $present, 'checked_at' => now(), 'source' => 'web']));
    $owner = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('id', $setup->reservation_id)->value('owner_id'));
    actingAsSeed('U01');

    $defaults = $this->getJson('/api/v1/settings')->assertOk()->json('data.sections.operations.values');
    expect($defaults['noshow_notify_advisor'])->toBeTrue()
        ->and($defaults['noshow_incident'])->toBeFalse()
        ->and($defaults['noshow_charge'])->toBeFalse();

    expect($this->postJson("/api/v1/ops/reservation-services/{$setup->service_code}/no-shows", ['passenger_ids' => [$present]]))->toBeApiError(422, 'OPS-BR-52');

    $created = $this->postJson("/api/v1/ops/reservation-services/{$setup->service_code}/no-shows", ['passenger_ids' => [$absent], 'note' => 'No llegó al punto de encuentro.'])->assertCreated()->json('data');
    expect($created['registered'])->toBe(1)
        ->and($created['effects']['notified'])->toBe($owner !== null)
        ->and($created['effects']['incident'])->toBeNull()
        ->and($created['effects']['charge'])->toBeNull();

    $id = $created['ids'][0];
    $row = rowOf('ops_no_shows', $id, column: 'id');
    expect($row->source)->toBe('web')
        ->and((string) $row->passenger_id)->toBe($absent)
        ->and(opsNoShowAudit(['entity' => 'No-show', 'action' => 'registrar']))->toBeTrue();

    if ($owner !== null) {
        expect(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', NoShowEffects::EVENT)->where('recipient_user_id', $owner)->exists()))->toBeTrue();
    }

    expect($this->postJson("/api/v1/ops/reservation-services/{$setup->service_code}/no-shows", ['passenger_ids' => [$absent]]))->toBeApiError(409, 'OPS-BR-52');

    $order = $this->getJson("/api/v1/ops/orders/{$setup->order_code}")->assertOk()->json('data');
    expect(collect($order['no_shows'])->pluck('passenger.id')->all())->toBe([$absent])
        ->and($this->getJson("/api/v1/ops/reservation-services/{$setup->service_code}/no-shows")->assertOk()->json('data.0.note'))->toBe('No llegó al punto de encuentro.')
        ->and(collect($this->getJson('/api/v1/ops/no-shows?filter[reservation]='.urlencode((string) rowOf('booking_reservations', $setup->reservation_id, column: 'id')->code))->assertOk()->json('data'))->pluck('id')->all())->toContain($id);

    $this->patchJson("/api/v1/ops/no-shows/{$id}", ['note' => 'Avisó por WhatsApp que perdió el vuelo.'])->assertOk()->assertJsonPath('data.note', 'Avisó por WhatsApp que perdió el vuelo.');
    expect(opsNoShowAudit(['entity' => 'No-show', 'action' => 'modificar_nota']))->toBeTrue();

    $this->deleteJson("/api/v1/ops/no-shows/{$id}", ['reason' => 'Se registró por error'])->assertOk()->assertJsonPath('data.voided', true);
    expect(rowOf('ops_no_shows', $id, column: 'id')->voided_at)->not->toBeNull()
        ->and(opsNoShowAudit(['entity' => 'No-show', 'action' => 'anular']))->toBeTrue()
        ->and($this->deleteJson("/api/v1/ops/no-shows/{$id}", ['reason' => 'Otra vez']))->toBeApiError(409, 'OPS-BR-52')
        ->and($this->patchJson("/api/v1/ops/no-shows/{$id}", ['note' => 'x']))->toBeApiError(409, 'OPS-BR-52');

    $this->postJson("/api/v1/ops/reservation-services/{$setup->service_code}/no-shows", ['passenger_ids' => [$absent]])->assertCreated();
});

it('G3-28: con incidencia y cargo encendidos abre la incidencia, cobra según la política del producto y libera el cargo al anular', function () {
    $setup = opsNoShowSetup();
    $absent = $setup->passengers[1];
    withinTenant(tenantA(), function () use ($setup): void {
        $product = DB::table('catalog_product_policies')->value('product_id');
        DB::table('catalog_product_policies')->where('product_id', $product)->update(['no_show' => 'Si el pasajero no se presenta se cobra el 50 % del servicio.']);
        DB::table('booking_reservation_services')->where('id', $setup->reservation_service_id)->update(['product_id' => $product]);
    });
    actingAsSeed('U01');
    opsNoShowSettings(['noshow_notify_advisor' => false, 'noshow_incident' => true, 'noshow_charge' => true]);
    expect(opsNoShowAudit(['entity' => 'Configuración', 'entity_id' => 'operations.noshow_charge']))->toBeTrue();

    $created = $this->postJson("/api/v1/ops/reservation-services/{$setup->service_code}/no-shows", ['passenger_ids' => [$absent]])->assertCreated()->json('data');
    expect($created['effects']['notified'])->toBeFalse()
        ->and($created['effects']['incident'])->toStartWith('INC-')
        ->and($created['effects']['charge'])->toMatchArray(['amount' => '200.00', 'pct' => 50, 'currency' => $setup->currency]);

    $incident = rowOf('ops_incidents', $created['effects']['incident']);
    $receivable = rowOf('fin_receivables', $created['effects']['charge']['receivable']);
    expect($incident->type)->toBe('Pasajero')
        ->and($receivable->kind)->toBe('penalidad')
        ->and((string) $receivable->amount)->toBe('200.00')
        ->and($receivable->status)->toBe('abierta')
        ->and((string) rowOf('ops_no_shows', $created['ids'][0], column: 'id')->charge_amount)->toBe('200.00');

    $this->deleteJson("/api/v1/ops/no-shows/{$created['ids'][0]}", ['reason' => 'El pasajero sí llegó tarde'])->assertOk()->assertJsonPath('data.charge_cancelled', true);
    expect(rowOf('fin_receivables', $created['effects']['charge']['receivable'])->status)->toBe('cancelada');
});

it('G3-28: al completar el servicio desde la orden, quien no tiene check-in queda como no-show', function () {
    $setup = opsNoShowSetup();
    withinTenant(tenantA(), fn () => DB::table('ops_assignment_checkins')->insert(['assignment_id' => $setup->id, 'passenger_id' => $setup->passengers[0], 'checked_at' => now(), 'source' => 'web']));
    actingAsSeed('U01');

    $this->postJson("/api/v1/ops/reservation-services/{$setup->service_code}/complete", ['note' => 'Servicio realizado'], critical((int) serviceRow($setup->service_code)->lock_version))->assertOk()->assertJsonPath('data.no_shows', count($setup->passengers) - 1);

    $rows = withinTenant(tenantA(), fn () => DB::table('ops_no_shows')->where('reservation_service_id', $setup->reservation_service_id)->whereNull('voided_at')->get());
    expect($rows)->toHaveCount(count($setup->passengers) - 1)
        ->and($rows->pluck('source')->unique()->all())->toBe(['web'])
        ->and($rows->pluck('passenger_id')->map(fn ($id) => (string) $id)->all())->not->toContain($setup->passengers[0]);
});

it('G3-28: no se registra antes de la fecha del servicio ni sin permiso de asignar', function () {
    $setup = opsNoShowSetup();
    withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('id', $setup->reservation_service_id)->update(['service_date' => '2027-01-15']));
    actingAsSeed('U01');
    expect($this->postJson("/api/v1/ops/reservation-services/{$setup->service_code}/no-shows", ['passenger_ids' => [$setup->passengers[0]]]))->toBeApiError(422, 'OPS-BR-52')
        ->and($this->postJson("/api/v1/ops/reservation-services/{$setup->service_code}/no-shows", ['passenger_ids' => []]))->toBeApiError(422);

    actingAsSeed('U17');
    $denied = $this->postJson("/api/v1/ops/reservation-services/{$setup->service_code}/no-shows", ['passenger_ids' => [$setup->passengers[0]]]);
    expect($denied->status())->toBeIn([403, 404]);
});

it('G3-28: el cargo toma el porcentaje de la política del producto', function () {
    expect(NoShowEffects::chargePct('No-show se factura al 100 %.'))->toBe(100)
        ->and(NoShowEffects::chargePct('Se cobra el 50% del servicio'))->toBe(50)
        ->and(NoShowEffects::chargePct('No presentación sin cargo.'))->toBe(0)
        ->and(NoShowEffects::chargePct('Consultar con la agencia.'))->toBeNull()
        ->and(NoShowEffects::chargePct(null))->toBeNull()
        ->and((string) NoShowEffects::chargeAmount('1000.00', 3, 100))->toBe('333.33')
        ->and((string) NoShowEffects::chargeAmount('800.00', 2, 50))->toBe('200.00');
});
