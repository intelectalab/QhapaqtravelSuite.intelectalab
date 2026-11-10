<?php

use App\Domain\Finance\Actions\SyncServicePayables;
use App\Domain\Finance\Support\SupplierPaymentTerms;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Queue::fake();
    freezeBusinessToday();
});

function cxpReserva(bool $confirm = true): string
{
    return (string) test()->postJson('/api/v1/reservations', [
        'client_id' => 'CLI-0003',
        'product_id' => 'CUS-HUM-FD',
        'departure_id' => departureRow('SAL-0403')->id,
        'adt' => 2,
        'confirm' => $confirm,
    ], critical())->assertCreated()->json('data.code');
}

function cxpServicios(string $code): array
{
    return withinTenant(tenantA(), function () use ($code): array {
        $id = reservationRow($code)->id;

        return [
            'services' => DB::table('booking_reservation_services as s')->leftJoin('catalog_providers as p', 'p.id', '=', 's.provider_id')->where('s.reservation_id', $id)->orderBy('s.code')
                ->get(['s.id', 's.code', 's.status', 's.provider_id', 's.service_date', 's.currency', 's.cost_amount', 'p.payment_terms']),
            'payables' => DB::table('fin_payables')->where('reservation_id', $id)->where('kind', 'servicio')->orderBy('code')->get()->keyBy('reservation_service_id'),
        ];
    });
}

function cxpSincronizar(string $code): array
{
    return withinTenant(tenantA(), fn (): array => app(SyncServicePayables::class)->handle((string) reservationRow($code)->id));
}

it('la condición de pago del proveedor define el vencimiento', function () {
    $service = CarbonImmutable::parse('2026-10-20');
    $today = CarbonImmutable::parse(BUSINESS_TODAY);
    $due = fn (?string $terms): string => SupplierPaymentTerms::dueDate($terms, $service, $today)->toDateString();

    expect($due('Crédito 30 días'))->toBe('2026-11-19')
        ->and($due('Crédito 7 días'))->toBe('2026-10-27')
        ->and($due('Prepago'))->toBe('2026-10-13')
        ->and($due('Prepago 50%'))->toBe('2026-10-13')
        ->and($due('Semanal'))->toBe('2026-10-26')
        ->and($due('Mensual'))->toBe('2026-10-31')
        ->and($due(null))->toBe('2026-11-04')
        ->and(SupplierPaymentTerms::dueDate('Prepago', CarbonImmutable::parse('2026-10-02'), $today)->toDateString())->toBe(BUSINESS_TODAY);
});

it('al confirmar la reserva genera una cuenta por pagar exacta por cada servicio con proveedor', function () {
    actingAsSeed('U01');
    $code = cxpReserva();
    ['services' => $services, 'payables' => $payables] = cxpServicios($code);
    $billable = $services->filter(fn (object $service): bool => $service->provider_id !== null && bccomp((string) $service->cost_amount, '0', 2) === 1);

    expect($billable)->not->toBeEmpty()
        ->and($payables)->toHaveCount($billable->count());

    foreach ($billable as $service) {
        $payable = $payables->get($service->id);
        expect($payable)->not->toBeNull()
            ->and($payable->code)->toStartWith('CXP-')
            ->and($payable->provider_id)->toBe($service->provider_id)
            ->and((string) $payable->amount)->toBe(bcadd((string) $service->cost_amount, '0', 2))
            ->and($payable->currency)->toBe($service->currency)
            ->and($payable->due_date)->toBe(SupplierPaymentTerms::dueDate($service->payment_terms, CarbonImmutable::parse($service->service_date), CarbonImmutable::parse(BUSINESS_TODAY))->toDateString())
            ->and($payable->status)->toBe('abierta')
            ->and($payable->approved_at)->toBeNull();
    }

    expect(withinTenant(tenantA(), fn (): bool => DB::table('audit_events')->where(['entity' => 'Cuenta por pagar', 'entity_id' => $payables->first()->code, 'action' => 'generar'])->exists()))->toBeTrue();
});

it('volver a correr la generación no duplica ni cambia nada', function () {
    actingAsSeed('U01');
    $code = cxpReserva();
    $before = cxpServicios($code)['payables'];

    expect(cxpSincronizar($code))->toBe(['created' => [], 'adjusted' => [], 'cancelled' => []])
        ->and(cxpSincronizar($code))->toBe(['created' => [], 'adjusted' => [], 'cancelled' => []]);

    $after = cxpServicios($code)['payables'];
    expect($after->pluck('code')->all())->toBe($before->pluck('code')->all())
        ->and($after->pluck('lock_version')->all())->toBe($before->pluck('lock_version')->all());
});

it('una reserva en borrador no genera obligaciones hasta que se confirma', function () {
    actingAsSeed('U01');
    $code = cxpReserva(false);

    expect(reservationRow($code)->status)->toBe('borrador')
        ->and(cxpServicios($code)['payables'])->toBeEmpty();

    $this->postJson("/api/v1/reservations/{$code}/confirm", [], critical(reservationLock($code)))->assertOk();

    expect(reservationRow($code)->status)->toBe('confirmada')
        ->and(cxpServicios($code)['payables'])->not->toBeEmpty();
});

it('modificar la reserva ajusta las obligaciones pendientes y respeta las aprobadas', function () {
    actingAsSeed('U01');
    $code = cxpReserva();
    $payables = cxpServicios($code)['payables'];
    expect($payables->count())->toBeGreaterThan(0);
    $approved = $payables->first();
    withinTenant(tenantA(), fn () => DB::table('fin_payables')->where('id', $approved->id)->update(['approved_at' => now(), 'approved_by' => seedUser('U07')->id, 'status' => 'aprobada']));

    $this->postJson("/api/v1/reservations/{$code}/changes", ['type' => 'pax', 'extra_pax' => 1, 'description' => 'Se suma un pasajero', 'apply_now' => true], critical(reservationLock($code)))->assertSuccessful();

    ['services' => $services, 'payables' => $after] = cxpServicios($code);
    expect($after)->toHaveCount($payables->count())
        ->and((string) $after->get($approved->reservation_service_id)->amount)->toBe((string) $approved->amount);

    foreach ($services->whereNotNull('provider_id') as $service) {
        if ($service->id === $approved->reservation_service_id || bccomp((string) $service->cost_amount, '0', 2) !== 1) {
            continue;
        }
        expect((string) $after->get($service->id)->amount)->toBe(bcadd((string) $service->cost_amount, '0', 2));
    }
});

it('reprogramar mueve el vencimiento de las obligaciones pendientes', function () {
    actingAsSeed('U01');
    $code = cxpReserva();
    $before = cxpServicios($code)['payables'];
    $start = (string) $this->postJson("/api/v1/reservations/{$code}/reschedule/preview", [])->assertOk()->json('data.suggested');

    $this->postJson("/api/v1/reservations/{$code}/reschedule", ['new_start' => $start, 'reason' => 'El cliente cambió la fecha del viaje'], critical(reservationLock($code)))->assertSuccessful();

    ['services' => $services, 'payables' => $after] = cxpServicios($code);
    expect(reservationRow($code)->status)->toBe('reprogramada')
        ->and($after)->toHaveCount($before->count())
        ->and($after->filter(fn (object $payable, string $serviceId): bool => $payable->due_date !== $before->get($serviceId)->due_date))->not->toBeEmpty();

    foreach ($after as $serviceId => $payable) {
        $service = $services->firstWhere('id', $serviceId);
        expect($payable->due_date)->toBe(SupplierPaymentTerms::dueDate($service->payment_terms, CarbonImmutable::parse($service->service_date), CarbonImmutable::parse(BUSINESS_TODAY))->toDateString())
            ->and((string) $payable->amount)->toBe(bcadd((string) $service->cost_amount, '0', 2));
    }
});

it('cancelar la reserva anula las obligaciones no aprobadas y deja las aprobadas', function () {
    actingAsSeed('U01');
    $code = cxpReserva();
    $payables = cxpServicios($code)['payables'];
    $approved = $payables->first();
    withinTenant(tenantA(), fn () => DB::table('fin_payables')->where('id', $approved->id)->update(['approved_at' => now(), 'approved_by' => seedUser('U07')->id, 'status' => 'aprobada']));

    $this->postJson("/api/v1/reservations/{$code}/cancel", ['reason' => 'Cambio de planes', 'detail' => 'El cliente pospone el viaje.'], critical(reservationLock($code)))->assertOk();

    $after = cxpServicios($code)['payables'];
    expect($after->get($approved->reservation_service_id)->status)->toBe('aprobada');

    foreach ($after->except([$approved->reservation_service_id]) as $payable) {
        expect($payable->status)->toBe('cancelada')
            ->and($payable->observation)->toBe('Reserva cancelada');
    }

    expect(cxpSincronizar($code))->toBe(['created' => [], 'adjusted' => [], 'cancelled' => []]);
});

it('el importe y el vencimiento de una obligación de servicio no se editan a mano', function () {
    actingAsSeed('U01');
    $code = cxpReserva();
    $payable = cxpServicios($code)['payables']->first();

    actingAsSeed('U07');
    expect($this->patchJson("/api/v1/finance/payables/{$payable->code}", ['concept' => $payable->concept, 'due_date' => '2026-12-31']))->toBeApiError(409, 'FIN-BR-18');
    $this->patchJson("/api/v1/finance/payables/{$payable->code}", ['concept' => 'Hotel con late check-out', 'due_date' => $payable->due_date, 'supplier_doc' => 'F001-000777'])->assertOk();

    $row = collect($this->getJson('/api/v1/finance/payables')->assertOk()->json('data.rows'))->firstWhere('code', $payable->code);
    expect($row['concept'])->toBe('Hotel con late check-out')
        ->and($row['managed'])->toBeTrue()
        ->and($row['reservation']['code'])->toBe($code)
        ->and($row['service']['code'])->toBe(withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('id', $payable->reservation_service_id)->value('code')));
});

it('el comando genera las obligaciones que faltan en reservas vigentes y es idempotente', function () {
    [$reservation, $legacy] = withinTenant(tenantA(), function (): array {
        $legacy = DB::table('fin_payables')->whereNull('reservation_service_id')->where('kind', 'servicio')->whereNotNull('reservation_id')->where('status', '<>', 'cancelada')->first(['reservation_id', 'provider_id']);
        $reservation = DB::table('booking_reservations as r')->whereNull('r.deleted_at')->whereIn('r.status', SyncServicePayables::GENERATING)
            ->whereExists(fn ($query) => $query->from('booking_reservation_services as s')->whereColumn('s.reservation_id', 'r.id')->whereNotNull('s.provider_id')->where('s.cost_amount', '>', 0)->whereNotIn('s.status', ['cancelado', 'rechazado']))
            ->whereExists(fn ($query) => $query->from('fin_payables as p')->whereColumn('p.reservation_id', 'r.id')->whereNotNull('p.reservation_service_id')->where('p.status', 'abierta'))
            ->whereNotExists(fn ($query) => $query->from('fin_payables as p')->whereColumn('p.reservation_id', 'r.id')->whereNull('p.reservation_service_id'))
            ->orderBy('r.code')->first(['r.id', 'r.code']);

        if ($reservation !== null) {
            DB::table('fin_payables')->where('reservation_id', $reservation->id)->whereNotNull('reservation_service_id')->delete();
        }

        return [$reservation, $legacy];
    });
    expect($reservation)->not->toBeNull();
    $count = fn (): int => withinTenant(tenantA(), fn (): int => DB::table('fin_payables')->where('kind', 'servicio')->count());
    $legacyCount = fn (): int => withinTenant(tenantA(), fn (): int => $legacy === null ? 0 : DB::table('fin_payables')->where('reservation_id', $legacy->reservation_id)->where('provider_id', $legacy->provider_id)->where('kind', 'servicio')->count());
    $legacyBefore = $legacyCount();

    $this->artisan('finance:service-payables', ['--tenant' => tenantA()->code])->assertSuccessful();
    $first = $count();
    $generated = withinTenant(tenantA(), fn (): int => DB::table('fin_payables')->where('reservation_id', $reservation->id)->whereNotNull('reservation_service_id')->count());

    $this->artisan('finance:service-payables', ['--tenant' => tenantA()->code])->assertSuccessful()->expectsOutputToContain('0 cuentas por pagar generadas');

    expect($generated)->toBeGreaterThan(0)
        ->and($count())->toBe($first)
        ->and($legacyCount())->toBe($legacyBefore);
});

it('si el proveedor rechaza un servicio, su obligación se anula y la alternativa genera la suya', function () {
    actingAsSeed('U01');
    $code = cxpReserva();
    ['services' => $services, 'payables' => $payables] = cxpServicios($code);
    $service = $services->first(fn (object $row): bool => $payables->has($row->id));
    $alternative = CarbonImmutable::parse($service->service_date)->addDay()->toDateString();

    $this->postJson("/api/v1/reservations/{$code}/services/{$service->code}/reject", ['reason' => 'Sin disponibilidad (sold out)', 'detail' => 'El proveedor no tiene cupo ese día.', 'alternative_date' => $alternative])->assertOk();

    ['services' => $servicesAfter, 'payables' => $after] = cxpServicios($code);
    $replacement = $servicesAfter->first(fn (object $row): bool => $row->service_date === $alternative && $row->provider_id === $service->provider_id && $row->id !== $service->id);

    expect(reservationRow($code)->status)->toBe('pendiente_proveedor')
        ->and($after->get($service->id)->status)->toBe('cancelada')
        ->and($after->get($service->id)->observation)->toBe('El proveedor rechazó el servicio')
        ->and($replacement)->not->toBeNull()
        ->and($after->get($replacement->id))->not->toBeNull()
        ->and($after->get($replacement->id)->status)->toBe('abierta')
        ->and((string) $after->get($replacement->id)->amount)->toBe((string) $after->get($service->id)->amount);
});

it('una reserva B2B con prepago genera sus obligaciones cuando Finanzas aplica el pago', function () {
    actingAsSeed('U13');
    $code = (string) $this->postJson('/api/v1/b2b/reservations', [
        'product' => 'CUS-HUM-FD',
        'date' => '2026-10-06',
        'adults' => 2,
        'pay_mode' => 'prepago',
        'passengers' => [['name' => 'Rosa Quispe Mamani', 'doc_type' => 'DNI', 'doc_number' => '41235566'], ['name' => 'Elena Quispe Mamani', 'doc_type' => 'DNI', 'doc_number' => '41235567']],
    ], critical())->assertOk()->json('data.code');

    expect(reservationRow($code)->status)->toBe('pendiente_pago')
        ->and(cxpServicios($code)['payables'])->toBeEmpty();

    $receivable = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('reservation_id', reservationRow($code)->id)->first(['code', 'amount']));
    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/payments', ['receivable_id' => $receivable->code, 'method' => 'transferencia_bcp', 'amount' => (string) $receivable->amount, 'paid_on' => BUSINESS_TODAY, 'reference' => 'OP-B2B-1'], critical())->assertCreated();

    expect(reservationRow($code)->status)->toBe('confirmada')
        ->and(cxpServicios($code)['payables'])->not->toBeEmpty();
});
