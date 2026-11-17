<?php

use Illuminate\Support\Facades\DB;

function t16opsNoShowService(): object
{
    return withinTenant(tenantA(), function (): object {
        $assignment = DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')->whereNotIn('o.status', ['completada', 'cancelada'])->whereNull('o.deleted_at')
            ->whereRaw('(select count(*) from booking_passengers p where p.reservation_id = o.reservation_id) >= 2')
            ->orderBy('o.code')->orderBy('a.service_date')->first(['a.id', 'a.reservation_service_id', 'o.reservation_id']);
        $product = DB::table('catalog_product_policies')->value('product_id');
        DB::table('catalog_product_policies')->where('product_id', $product)->update(['no_show' => 'No-show se factura al 100 %. No hay reembolso.']);
        DB::table('ops_assignments')->where('id', $assignment->id)->update(['status' => 'en_curso', 'service_date' => BUSINESS_TODAY, 'started_at' => now()]);
        DB::table('ops_assignment_checkins')->where('assignment_id', $assignment->id)->delete();
        DB::table('booking_reservation_services')->where('id', $assignment->reservation_service_id)->update(['status' => 'confirmado', 'service_date' => BUSINESS_TODAY, 'price_amount' => '800.00', 'pax' => 2, 'product_id' => $product]);
        DB::table('ops_no_shows')->where('reservation_id', $assignment->reservation_id)->delete();

        return (object) [
            'code' => DB::table('booking_reservation_services')->where('id', $assignment->reservation_service_id)->value('code'),
            'reservation_id' => $assignment->reservation_id,
            'passengers' => DB::table('booking_passengers')->where('reservation_id', $assignment->reservation_id)->orderBy('seq')->pluck('id')->map(fn ($id) => (string) $id)->all(),
        ];
    });
}

it('duda 6: el no-show ya no genera cargo aunque la política del producto cobre el 100 % y el interruptor ya no existe', function () {
    $service = t16opsNoShowService();
    $penalties = fn () => withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('reservation_id', $service->reservation_id)->where('kind', 'penalidad')->count());
    $before = $penalties();
    actingAsSeed('U01');

    $values = $this->getJson('/api/v1/settings')->assertOk()->json('data.sections.operations.values');
    expect($values)->not->toHaveKey('noshow_charge')->and($values['noshow_notify_advisor'])->toBeTrue()->and($values['noshow_incident'])->toBeFalse();

    $version = (int) withinTenant(tenantA(), fn () => DB::table('sys_settings')->where('section', 'operations')->value('lock_version'));
    $this->patchJson('/api/v1/settings/operations', [...$values, 'noshow_incident' => true, 'noshow_charge' => true], ['If-Match' => (string) $version])->assertOk();
    $stored = (array) json_decode((string) withinTenant(tenantA(), fn () => DB::table('sys_settings')->where('section', 'operations')->value('values')), true);
    expect($stored)->not->toHaveKey('noshow_charge')->and($stored['noshow_incident'])->toBeTrue();

    $created = $this->postJson("/api/v1/ops/reservation-services/{$service->code}/no-shows", ['passenger_ids' => [$service->passengers[1]]])->assertCreated()->json('data');
    expect($created['effects'])->toHaveKeys(['notified', 'incident'])->not->toHaveKey('charge')
        ->and($created['effects']['incident'])->toStartWith('INC-')
        ->and($penalties())->toBe($before)
        ->and(withinTenant(tenantA(), fn () => DB::getSchemaBuilder()->hasColumn('ops_no_shows', 'receivable_id')))->toBeFalse();

    $listed = $this->getJson("/api/v1/ops/reservation-services/{$service->code}/no-shows")->assertOk()->json('data.0');
    expect($listed)->not->toHaveKey('charge')->and($listed['incident'])->toBe($created['effects']['incident']);

    $this->deleteJson("/api/v1/ops/no-shows/{$created['ids'][0]}", ['reason' => 'Llegó tarde y sí tomó el servicio'])->assertOk()->assertJsonMissingPath('data.charge_cancelled');
});

it('OPS-BR-51: al completar desde la web quedan como no-show solo quienes no tienen check-in, y sin check-in nadie', function () {
    $service = t16opsNoShowService();
    actingAsSeed('U01');
    $complete = fn () => $this->postJson("/api/v1/ops/reservation-services/{$service->code}/complete", ['note' => 'Servicio realizado'], critical((int) serviceRow($service->code)->lock_version));

    $order = withinTenant(tenantA(), fn () => DB::table('ops_orders')->where('reservation_id', $service->reservation_id)->whereNull('deleted_at')->value('code'));
    $detail = $this->getJson("/api/v1/ops/orders/{$order}")->assertOk()->json('data');
    $assignment = collect($detail['assignments'])->firstWhere('service_code', $service->code);
    expect($assignment['checked_in'])->toBe([]);

    $complete()->assertOk()->assertJsonPath('data.no_shows', 0);
    expect(withinTenant(tenantA(), fn () => DB::table('ops_no_shows')->where('reservation_id', $service->reservation_id)->count()))->toBe(0);
});
