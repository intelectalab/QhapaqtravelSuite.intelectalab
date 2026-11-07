<?php

use App\Jobs\SendInvoiceToFiscalProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Queue::fake();
    freezeBusinessToday();
});

function flujoLead(): array
{
    actingAsSeed('U02');
    $code = test()->postJson('/api/v1/crm/leads', [
        'name' => 'Valeria Gutiérrez Soto',
        'email' => 'valeria.gutierrez@flujo.pe',
        'phone' => '987 654 321',
        'channel' => 'web',
        'source' => 'formulario_web',
        'interest' => 'paquete',
        'destination' => 'Cusco',
        'travel_date' => '2026-09-30',
        'pax' => 2,
    ])->assertCreated()->json('data.code');

    $lead = rowOf('crm_leads', $code);
    expect($lead->status)->toBe('nuevo')->and($lead->owner_id)->toBeNull();

    $seller = actingAsSeed('U03');
    test()->postJson("/api/v1/crm/leads/{$code}/take")->assertOk();
    expect(rowOf('crm_leads', $code)->owner_id)->toBe($seller->id);

    test()->postJson("/api/v1/crm/leads/{$code}/qualify", [
        'budget' => 25, 'authority' => 18, 'need' => 25, 'timeline' => 18,
        'amount' => 1800, 'currency' => 'USD', 'mark_qualified' => true,
    ], critical((int) rowOf('crm_leads', $code)->lock_version))->assertOk();
    expect(rowOf('crm_leads', $code)->status)->toBe('calificado')
        ->and((int) rowOf('crm_leads', $code)->score)->toBe(86);

    $converted = test()->postJson("/api/v1/crm/leads/{$code}/convert", [
        'doc_type' => 'DNI',
        'doc_number' => '70451236',
        'city' => 'Lima',
        'opportunity_title' => 'Cusco mágico para dos',
        'amount' => 1800,
        'currency' => 'USD',
        'expected_close_date' => '2026-10-15',
    ], critical((int) rowOf('crm_leads', $code)->lock_version))->assertOk()->json('data');

    $client = rowOf('crm_clients', $converted['client']);
    $opportunity = rowOf('crm_opportunities', $converted['opportunity']);

    expect(rowOf('crm_leads', $code)->status)->toBe('convertido')
        ->and($client->owner_id)->toBe($seller->id)
        ->and($client->doc_number)->toBe('70451236')
        ->and($opportunity->client_id)->toBe($client->id)
        ->and($opportunity->stage)->toBe('calificacion');

    return ['lead' => $code, 'client' => $client->code, 'opportunity' => $opportunity->code];
}

function flujoCotizacion(array $flow): array
{
    actingAsSeed('U03');
    $code = test()->postJson('/api/v1/quotes', [
        'client_code' => $flow['client'],
        'opportunity_code' => $flow['opportunity'],
        'title' => 'Cusco mágico 5D/4N para dos',
        'travel_from' => '2026-09-30',
        'travel_to' => '2026-10-04',
        'currency' => 'USD',
        'pax_adt' => 2,
        'discount_pct' => 6,
        'tax_pct' => 18,
        'items' => [['product_code' => 'CUS-PKG-5D4N', 'date' => '2026-09-30', 'qty' => 1, 'pax' => 2, 'segment' => 'Adulto']],
    ], critical())->assertCreated()->json('data.code');

    expect(rowOf('quote_quotes', $code)->status)->toBe('borrador')
        ->and(rowOf('crm_opportunities', $flow['opportunity'])->stage)->toBe('cotizacion');

    $detail = test()->getJson("/api/v1/quotes/{$code}")->assertOk()->json('data');
    expect($detail['internal']['required'])->toBeTrue();
    expect(test()->postJson("/api/v1/quotes/{$code}/send", sendBody(), critical((int) rowOf('quote_quotes', $code)->lock_version)))->toBeApiError(409, 'QTE-BR-12');

    test()->postJson("/api/v1/quotes/{$code}/internal-approval-requests", ['note' => 'Cliente referido, pide 6 % por pago anticipado'])->assertOk();

    actingAsSeed('U02');
    decideInternally($code, 'approve', 'Descuento aceptado por ser cliente nuevo')->assertOk();

    actingAsSeed('U03');
    expect(test()->getJson("/api/v1/quotes/{$code}")->json('data.internal.status'))->toBe('aprobada');
    test()->postJson("/api/v1/quotes/{$code}/send", sendBody(), critical((int) rowOf('quote_quotes', $code)->lock_version))->assertOk();
    expect(rowOf('quote_quotes', $code)->status)->toBe('enviada');

    withinTenant(tenantA(), fn () => DB::table('iam_users')->where('code', 'U14')->update(['client_id' => idOf('crm_clients', $flow['client'])]));

    actingAsSeed('U14');
    $portal = test()->getJson("/api/v1/portal/client/quotes/{$code}")->assertOk()->json('data');
    expect($portal['status'])->toBe('vista')
        ->and($portal['can_decide'])->toBeTrue();
    test()->postJson("/api/v1/portal/client/quotes/{$code}/approve", ['name' => 'Valeria Gutiérrez Soto', 'accept' => true, 'comment' => 'Conforme'], critical((int) $portal['lock_version']))->assertOk();

    $quote = rowOf('quote_quotes', $code);
    expect($quote->status)->toBe('aprobada')
        ->and($quote->approval_channel)->toBe('Portal');

    return [...$flow, 'quote' => $code];
}

function flujoReserva(array $flow): array
{
    $quote = rowOf('quote_quotes', $flow['quote']);
    actingAsSeed('U03');
    $key = idem('conv');
    $first = test()->postJson("/api/v1/quotes/{$flow['quote']}/convert", [], critical((int) $quote->lock_version, $key))->assertCreated();
    $replay = test()->postJson("/api/v1/quotes/{$flow['quote']}/convert", [], critical((int) $quote->lock_version, $key))->assertCreated();
    $again = test()->postJson("/api/v1/quotes/{$flow['quote']}/convert", [], critical((int) rowOf('quote_quotes', $flow['quote'])->lock_version, idem('conv2')))->assertOk();

    $code = (string) $first->json('data.code');
    $reservation = reservationRow($code);

    expect($replay->json('data.code'))->toBe($code)
        ->and($replay->headers->get('Idempotent-Replayed'))->toBe('true')
        ->and($again->json('data.code'))->toBe($code)
        ->and($again->json('meta.idempotent'))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('quote_id', $quote->id)->count()))->toBe(1)
        ->and($reservation->status)->toBe('confirmada')
        ->and($reservation->client_id)->toBe(idOf('crm_clients', $flow['client']))
        ->and(rowOf('quote_quotes', $flow['quote'])->status)->toBe('convertida')
        ->and(rowOf('crm_opportunities', $flow['opportunity'])->stage)->toBe('ganada');

    actingAsSeed('U05');
    $placeholders = withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', $reservation->id)->orderBy('seq')->get());
    $people = [
        ['full_name' => 'Valeria Gutiérrez Soto', 'pax_type' => 'ADT', 'doc_type' => 'DNI', 'doc_number' => '70451236', 'relationship' => 'Titular', 'is_lead' => true],
        ['full_name' => 'Martín Rojas Delgado', 'pax_type' => 'ADT', 'doc_type' => 'DNI', 'doc_number' => '70451299', 'relationship' => 'Cónyuge / pareja'],
    ];
    expect($placeholders)->toHaveCount(2);
    foreach ($placeholders as $index => $placeholder) {
        test()->putJson("/api/v1/reservations/{$code}/passengers/{$placeholder->id}", $people[$index], critical(reservationLock($code)))->assertOk();
    }
    $extra = test()->postJson("/api/v1/reservations/{$code}/passengers", ['full_name' => 'Lucía Rojas Gutiérrez', 'pax_type' => 'INF', 'doc_type' => 'DNI', 'doc_number' => '90451200', 'relationship' => 'Hijo/a'], critical(reservationLock($code)))->assertCreated();
    expect($extra->json('data.is_placeholder'))->toBeFalse()
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', $reservation->id)->where('is_placeholder', true)->count()))->toBe(0);

    $requested = test()->postJson("/api/v1/reservations/{$code}/services/request-pending")->assertOk()->json('data.requested');
    $services = withinTenant(tenantA(), fn () => DB::table('booking_reservation_services as s')->join('catalog_providers as p', 'p.id', '=', 's.provider_id')
        ->where('s.reservation_id', $reservation->id)->orderBy('s.code')->get(['s.code', 's.status', 's.service_kind', 'p.ref as provider']));
    expect($services)->not->toBeEmpty()
        ->and($requested)->toHaveCount($services->count())
        ->and($services->pluck('status')->unique()->all())->toBe(['solicitado']);

    $hotel = $services->firstWhere('provider', 'PRV-001');
    expect($hotel)->not->toBeNull();

    actingAsSeed('U17');
    $row = collect(test()->getJson('/api/v1/supplier/requests')->assertOk()->json('data.rows'))->firstWhere('code', $hotel->code);
    expect($row)->not->toBeNull()
        ->and($row['state'])->toBe('por_responder');
    test()->postJson("/api/v1/supplier/requests/{$hotel->code}/confirm", ['confirmation_code' => 'TR-55120', 'service_time' => '14:00', 'confirmed_by_name' => 'Recepción Tambo Real'], critical((int) $row['lock_version']))->assertOk();
    expect(serviceRow($hotel->code)->status)->toBe('confirmado')
        ->and(serviceRow($hotel->code)->confirmation_code)->toBe('TR-55120');

    actingAsSeed('U05');
    foreach ($services->where('provider', '!=', 'PRV-001') as $index => $service) {
        test()->postJson("/api/v1/reservations/{$code}/services/{$service->code}/confirm", ['confirmation_code' => 'CNF-'.(1000 + $index)])->assertOk()->assertJsonPath('data.status', 'confirmado');
    }

    expect(withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->where('status', '<>', 'confirmado')->count()))->toBe(0)
        ->and(reservationRow($code)->status)->toBe('confirmada');

    return [...$flow, 'reservation' => $code];
}

function flujoCuotas(string $reservation): array
{
    return withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('reservation_id', reservationRow($reservation)->id)->orderBy('due_date')->orderBy('code')->get()->keyBy('kind')->all());
}

function flujoCobros(array $flow): array
{
    $cuotas = flujoCuotas($flow['reservation']);
    $anticipo = $cuotas['anticipo'];
    $saldo = $cuotas['saldo'];
    expect(bcadd((string) $anticipo->amount, (string) $saldo->amount, 2))->toBe(bcadd((string) reservationRow($flow['reservation'])->total_amount, '0', 2))
        ->and($anticipo->status)->toBe('abierta');

    actingAsSeed('U14');
    $billing = test()->getJson('/api/v1/portal/client/receivables')->assertOk()->json('data');
    expect(collect($billing['installments'])->pluck('code'))->toContain($anticipo->code);
    $payment = test()->postJson("/api/v1/portal/client/receivables/{$anticipo->code}/payments", [
        'amount' => (string) $anticipo->amount,
        'method' => 'transferencia_bcp',
        'reference' => 'OP-778812',
        'paid_on' => BUSINESS_TODAY,
    ], critical())->assertOk()->json('data.code');

    expect(rowOf('fin_payments', $payment)->status)->toBe('pendiente')
        ->and((string) rowOf('fin_receivables', $anticipo->code)->paid_amount)->toBe('0.00');

    actingAsSeed('U07');
    test()->postJson("/api/v1/finance/payments/{$payment}/confirm", ['receivable' => $anticipo->code], critical())->assertOk();

    $anticipoAfter = rowOf('fin_receivables', $anticipo->code);
    expect(rowOf('fin_payments', $payment)->status)->toBe('aplicado')
        ->and(bcadd((string) $anticipoAfter->paid_amount, '0', 2))->toBe(bcadd((string) $anticipo->amount, '0', 2))
        ->and($anticipoAfter->status)->toBe('pagada');

    $partial = bcdiv((string) $saldo->amount, '2', 2);
    $direct = test()->postJson('/api/v1/finance/payments', [
        'receivable_id' => $saldo->code,
        'method' => 'transferencia_bbva',
        'amount' => $partial,
        'paid_on' => BUSINESS_TODAY,
        'reference' => 'OP-990011',
    ], critical())->assertCreated()->json('data.payment');

    $saldoAfter = rowOf('fin_receivables', $saldo->code);
    expect(rowOf('fin_payments', $direct)->status)->toBe('aplicado')
        ->and(bcadd((string) $saldoAfter->paid_amount, '0', 2))->toBe($partial)
        ->and($saldoAfter->status)->toBe('parcial');

    return [...$flow, 'anticipo' => $anticipo->code, 'saldo' => $saldo->code, 'portal_payment' => $payment, 'direct_payment' => $direct];
}

function flujoComprobante(array $flow): array
{
    actingAsSeed('U07');
    $draft = test()->getJson("/api/v1/finance/receivables/{$flow['anticipo']}/invoice-draft")->assertOk()->json('data');
    expect($draft['doc_type'])->toBe('03')
        ->and($draft['customer_doc_number'])->toBe('70451236');

    $invoice = test()->postJson('/api/v1/finance/invoices', [
        'receivable_id' => $flow['anticipo'],
        'doc_type' => $draft['doc_type'],
        'customer_doc_type' => $draft['customer_doc_type'],
        'customer_doc_number' => $draft['customer_doc_number'],
        'customer_name' => $draft['customer_name'],
        'domiciled' => $draft['domiciled'],
        'amount' => $draft['amount'],
        'description' => $draft['description'],
    ], critical())->assertStatus(202)->json('data');

    expect($invoice['status'])->toBe('pendiente_envio')
        ->and($invoice['total_amount'])->toBe(bcadd((string) rowOf('fin_receivables', $flow['anticipo'])->amount, '0', 2));
    Queue::assertPushed(SendInvoiceToFiscalProvider::class);

    $row = rowOf('fin_invoices', $invoice['number'], column: 'number');
    withinTenant(tenantA(), fn () => app()->call([new SendInvoiceToFiscalProvider((string) $row->id), 'handle']));

    $accepted = test()->getJson("/api/v1/finance/invoices/{$invoice['number']}")->assertOk()->json('data');
    expect($accepted['status'])->toBe('aceptado')
        ->and(collect($accepted['fiscal_events'])->pluck('status')->all())->toBe(['ok']);
    expect(test()->postJson('/api/v1/finance/invoices', [
        'receivable_id' => $flow['anticipo'], 'doc_type' => '03', 'customer_doc_type' => 'DNI', 'customer_doc_number' => '70451236',
        'customer_name' => $draft['customer_name'], 'domiciled' => true, 'amount' => $draft['amount'], 'description' => $draft['description'],
    ], critical()))->toBeApiError(422, 'FIN-BR-43');

    return [...$flow, 'invoice' => $invoice['number']];
}

function flujoOrden(string $order): array
{
    return test()->getJson("/api/v1/ops/orders/{$order}")->assertOk()->json('data');
}

function flujoOperaciones(array $flow): array
{
    $coordinator = actingAsSeed('U05');
    $order = (string) test()->postJson("/api/v1/reservations/{$flow['reservation']}/operation-order", ['coordinator_id' => $coordinator->id], critical())->assertOk()->json('meta.order_code');
    expect($order)->toStartWith('OP-');

    $detail = flujoOrden($order);
    expect($detail['status'])->toBe('pendiente_asignacion')
        ->and($detail['assignments'])->not->toBeEmpty();

    $options = $detail['options'];
    foreach ($detail['assignments'] as $assignment) {
        $kind = serviceRow($assignment['service_code'])->service_kind;
        $candidates = $kind === 'traslado'
            ? collect($options['drivers'])->crossJoin($options['vehicles'])->map(fn (array $pair) => ['driver_id' => $pair[0]['value'], 'vehicle_id' => $pair[1]['value']])
            : collect($options['guides'])->map(fn (array $guide) => ['guide_id' => $guide['value']]);
        $assigned = $candidates->first(function (array $resources) use ($assignment): bool {
            $lock = (int) rowOf('ops_assignments', $assignment['id'], column: 'id')->lock_version;

            return test()->putJson("/api/v1/ops/assignments/{$assignment['id']}/resources", [...$resources, 'ack_warnings' => true], critical($lock))->status() === 200;
        });
        expect($assigned)->not->toBeNull();
    }

    foreach (flujoOrden($order)['assignments'] as $assignment) {
        expect($assignment['status'])->toBe('asignada');
        test()->postJson("/api/v1/ops/assignments/{$assignment['id']}/confirm", [], critical((int) $assignment['lock_version']))->assertOk();
    }
    expect(flujoOrden($order)['status'])->toBe('confirmada');

    $hotel = withinTenant(tenantA(), fn () => DB::table('booking_reservation_services as s')->join('catalog_providers as p', 'p.id', '=', 's.provider_id')
        ->where('s.reservation_id', reservationRow($flow['reservation'])->id)->where('p.ref', 'PRV-001')->value('s.code'));
    $voucher = test()->postJson('/api/v1/ops/vouchers', ['service_code' => $hotel, 'note' => 'Ingreso 14:00'], critical())->assertCreated()->json('data.code');
    expect(rowOf('ops_vouchers', $voucher)->status)->toBe('emitido');
    expect(test()->postJson('/api/v1/ops/vouchers', ['service_code' => $hotel], critical()))->toBeApiError(409, 'OPS-BR-41');

    $incident = test()->postJson('/api/v1/ops/incidents', [
        'order_code' => $order,
        'type' => 'Horario',
        'severity' => 'media',
        'title' => 'Retraso del vuelo de llegada',
        'description' => 'El vuelo LA2021 llega con 90 minutos de retraso.',
    ], critical())->assertCreated()->json('data.code');
    test()->postJson("/api/v1/ops/incidents/{$incident}/take", [], critical((int) rowOf('ops_incidents', $incident)->lock_version))->assertOk();
    expect(rowOf('ops_incidents', $incident)->status)->toBe('en_proceso');
    test()->postJson("/api/v1/ops/incidents/{$incident}/resolve", ['resolution' => 'Se reprogramó el traslado de llegada a las 11:30.'], critical((int) rowOf('ops_incidents', $incident)->lock_version))->assertOk();
    expect(rowOf('ops_incidents', $incident)->status)->toBe('resuelta');

    test()->postJson("/api/v1/ops/orders/{$order}/start", [], critical((int) rowOf('ops_orders', $order)->lock_version))->assertOk()->assertJsonPath('data.status', 'en_ejecucion');
    expect(reservationRow($flow['reservation'])->status)->toBe('en_operacion');

    expect(test()->postJson("/api/v1/ops/orders/{$order}/close", [], critical((int) rowOf('ops_orders', $order)->lock_version)))->toBeApiError(422, 'OPS-BR-80');

    withinTenant(tenantA(), function () use ($flow, $order, $coordinator): void {
        $reservationId = reservationRow($flow['reservation'])->id;
        DB::table('booking_reservation_services')->where('reservation_id', $reservationId)->where('status', 'confirmado')->update(['status' => 'completado']);
        DB::table('ops_evidences')->insert([
            'tenant_id' => tenantA()->getKey(),
            'order_id' => rowOf('ops_orders', $order)->id,
            'file_name' => 'cierre.jpg',
            'storage_path' => 'evidences/cierre.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 2048,
            'sha256' => str_repeat('a', 64),
            'captured_at' => now(),
            'uploaded_by' => $coordinator->id,
        ]);
    });

    test()->postJson("/api/v1/ops/orders/{$order}/close", [], critical((int) rowOf('ops_orders', $order)->lock_version))->assertOk()->assertJsonPath('data.status', 'completada');
    expect(reservationRow($flow['reservation'])->status)->toBe('completada')
        ->and(collect(flujoOrden($order)['checks'])->every(fn (array $check) => $check['ok']))->toBeTrue();

    $history = collect(test()->getJson("/api/v1/reservations/{$flow['reservation']}/history?page[size]=100")->assertOk()->json('data'))->where('entity', 'Reserva');
    expect($history->pluck('action')->all())->toContain('iniciar_operacion', 'completar');

    return [...$flow, 'order' => $order, 'voucher' => $voucher, 'incident' => $incident];
}

function flujoProveedores(array $flow): array
{
    $reservationId = reservationRow($flow['reservation'])->id;
    expect(withinTenant(tenantA(), fn () => DB::table('fin_payables')->where('reservation_id', $reservationId)->count()))->toBe(0);

    actingAsSeed('U07');
    $payable = test()->postJson('/api/v1/finance/payables', [
        'reservation' => $flow['reservation'],
        'provider' => 'PRV-001',
        'cost_type' => 'gasto_operativo_destino',
        'concept' => 'Late check-out por el retraso del vuelo de llegada',
        'amount' => '45.00',
        'currency' => 'USD',
        'fx_rate' => '3.75',
        'supplier_doc' => 'F001-000981',
    ])->assertCreated()->json('data.code');
    expect(rowOf('fin_payables', $payable)->status)->toBe('abierta');

    actingAsSeed('U17');
    expect(collect(test()->getJson('/api/v1/supplier/payables')->assertOk()->json('data.rows'))->pluck('code'))->toContain($payable);

    actingAsSeed('U07');
    expect(test()->postJson("/api/v1/finance/payables/{$payable}/payouts", ['method' => 'transferencia', 'amount' => '45.00', 'paid_on' => BUSINESS_TODAY, 'operation_ref' => 'TRF-1'], critical((int) rowOf('fin_payables', $payable)->lock_version)))->toBeApiError(422, 'FIN-BR-19');
    test()->postJson("/api/v1/finance/payables/{$payable}/approve", [], critical((int) rowOf('fin_payables', $payable)->lock_version))->assertOk();
    expect(rowOf('fin_payables', $payable)->status)->toBe('aprobada');
    test()->postJson("/api/v1/finance/payables/{$payable}/payouts", ['method' => 'transferencia', 'amount' => '45.00', 'paid_on' => BUSINESS_TODAY, 'operation_ref' => 'TRF-55120', 'fx_rate' => '3.75'], critical((int) rowOf('fin_payables', $payable)->lock_version))->assertCreated();
    expect(rowOf('fin_payables', $payable)->status)->toBe('pagada')
        ->and(bcadd((string) rowOf('fin_payables', $payable)->paid_amount, '0', 2))->toBe('45.00');

    test()->postJson('/api/v1/finance/commissions/calculate', [], critical())->assertCreated();
    $commission = withinTenant(tenantA(), fn () => DB::table('fin_commissions')->where('reservation_id', $reservationId)->whereNull('deleted_at')->first());
    $reservation = reservationRow($flow['reservation']);
    expect($commission)->not->toBeNull()
        ->and($commission->kind)->toBe('vendedor')
        ->and($commission->beneficiary_user_id)->toBe(seedUser('U03')->id)
        ->and($commission->status)->toBe('calculada')
        ->and($commission->currency)->toBe($reservation->currency)
        ->and(bcadd((string) $commission->amount, '0', 2))->toBe(number_format(round((float) $commission->base_amount * (float) $commission->pct / 100, 2), 2, '.', ''));

    test()->postJson("/api/v1/finance/commissions/{$commission->code}/approve", [], critical((int) rowOf('fin_commissions', $commission->code)->lock_version))->assertOk();
    expect(rowOf('fin_commissions', $commission->code)->status)->toBe('aprobada');
    test()->postJson("/api/v1/finance/commissions/{$commission->code}/pay", ['method' => 'Planilla del mes', 'reference' => 'PLANILLA-2026-09'], critical((int) rowOf('fin_commissions', $commission->code)->lock_version))->assertOk();
    expect(rowOf('fin_commissions', $commission->code)->status)->toBe('pagada');

    return [...$flow, 'payable' => $payable, 'commission' => $commission->code];
}

function flujoCancelacion(array $flow): array
{
    $departure = departureRow('SAL-0105');
    $sold = (int) $departure->sold;

    actingAsSeed('U03');
    $code = (string) test()->postJson('/api/v1/reservations', [
        'client_id' => $flow['client'],
        'product_id' => 'CUS-MAPI-FD',
        'departure_id' => $departure->id,
        'adt' => 2,
        'confirm' => true,
    ], critical())->assertCreated()->assertJsonPath('data.status', 'confirmada')->json('data.code');
    expect((int) departureRow('SAL-0105')->sold)->toBe($sold + 2);

    $cuotas = flujoCuotas($code);
    actingAsSeed('U07');
    test()->postJson('/api/v1/finance/payments', ['receivable_id' => $cuotas['anticipo']->code, 'method' => 'yape', 'amount' => (string) $cuotas['anticipo']->amount, 'paid_on' => BUSINESS_TODAY, 'reference' => 'YAPE-3301'], critical())->assertCreated();

    actingAsSeed('U03');
    $reason = ['reason' => 'Motivo de salud', 'detail' => 'La titular tiene una indicación médica de reposo.'];
    expect(test()->postJson("/api/v1/reservations/{$code}/cancel", $reason, critical(reservationLock($code))))->toBeApiError(403);
    $request = test()->postJson("/api/v1/reservations/{$code}/cancel-requests", $reason)->assertCreated()->json('data');
    expect($request['status'])->toBe('pendiente')
        ->and(reservationRow($code)->status)->toBe('confirmada');
    expect(test()->postJson("/api/v1/reservations/{$code}/cancel-requests", $reason))->toBeApiError(409, 'CANCEL_REQUEST_PENDING');

    actingAsSeed('U02');
    $preview = test()->postJson("/api/v1/reservations/{$code}/cancellation/preview")->assertOk()->json('data');
    $prices = collect($preview['lines'])->reduce(fn (string $carry, array $line): string => bcadd($carry, $line['price'], 2), '0.00');
    $expected = bcdiv(bcmul(bcadd($preview['penalty_services'], $preview['consumed'], 2), $preview['total'], 6), $prices, 6);
    expect(abs((float) $preview['penalty'] - min((float) $preview['total'], (float) $expected)))->toBeLessThan(0.006)
        ->and(collect($preview['lines'])->every(fn (array $line): bool => bcadd(bcdiv(bcmul($line['price'], (string) $line['pct'], 4), '100', 4), '0.005', 2) === $line['penalty']))->toBeTrue();
    expect($preview['request_id'])->toBe($request['id'])
        ->and(bccomp($preview['penalty'], '0', 2))->toBe(1)
        ->and($preview['paid'])->toBe(bcadd((string) $cuotas['anticipo']->amount, '0', 2))
        ->and(bcsub($preview['refund'], $preview['owed'], 2))->toBe(bcsub($preview['paid'], $preview['penalty'], 2));

    $cancelled = test()->postJson("/api/v1/reservations/{$code}/cancel", $reason, critical(reservationLock($code)))->assertOk()->json('data');
    $record = withinTenant(tenantA(), fn () => DB::table('booking_cancellations')->where('reservation_id', reservationRow($code)->id)->first());
    $receivables = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('reservation_id', reservationRow($code)->id)->get()->keyBy('kind'));

    expect($cancelled['status'])->toBe('cancelada')
        ->and($cancelled['penalty_amount'])->toBe($preview['penalty'])
        ->and($cancelled['refund_amount'])->toBe($preview['refund'])
        ->and(bcadd((string) $record->penalty_amount, '0', 2))->toBe($preview['penalty'])
        ->and($receivables['saldo']->status)->toBe('cancelada')
        ->and((int) departureRow('SAL-0105')->sold)->toBe($sold)
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_cancel_requests')->where('id', $request['id'])->value('status')))->toBe('aprobada')
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('reservation_id', reservationRow($code)->id)->where('status', '<>', 'cancelado')->count()))->toBe(0);

    if (bccomp($preview['owed'], '0', 2) === 1) {
        expect(bcadd((string) $receivables['penalidad']->amount, '0', 2))->toBe($preview['owed']);
    }
    if (bccomp($preview['refund'], '0', 2) === 1) {
        expect(withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reservation_id', reservationRow($code)->id)->where('kind', 'reembolso')->value('amount')))->not->toBeNull();
    }

    return [...$flow, 'cancelled' => $code, 'penalty' => $preview['penalty']];
}

function flujoSitio(): array
{
    $sold = (int) departureRow('SAL-0404')->sold;
    $token = (string) test()->postJson('/api/v1/public/carts/current/items', ['product' => 'laguna-humantay-full-day', 'date' => '2026-10-04', 'adults' => 2], siteOf(extra: critical()))->assertCreated()->json('data.token');
    $cart = test()->withCredentials()->withUnencryptedCookie('ah_cart', $token)->getJson('/api/v1/public/carts/current', siteOf())->assertOk()->json('data');
    expect($cart['items'])->toHaveCount(1)
        ->and($cart['items'][0]['error'])->toBeNull();

    $order = test()->withCredentials()->withUnencryptedCookie('ah_cart', $token)->postJson('/api/v1/public/checkout/orders', [
        'name' => 'Camila Paredes Núñez',
        'email' => 'camila.paredes@flujo.pe',
        'phone' => '+51 912 345 678',
        'country' => 'Perú',
        'doc_type' => 'DNI',
        'doc_number' => '45127788',
        'billing_type' => 'Boleta',
        'terms' => true,
        'privacy' => true,
    ], siteOf(extra: critical()))->assertCreated()->json('data');

    $access = siteOf(extra: ['X-Order-Token' => $order['token']]);
    $pending = test()->getJson("/api/v1/public/orders/{$order['code']}", $access)->assertOk()->json('data');
    expect($pending['status'])->toBe('pago_pendiente')
        ->and($pending['reservations'])->toHaveCount(1)
        ->and($pending['reservations'][0]['status'])->toBe('pendiente_pago');
    expect(test()->getJson("/api/v1/public/orders/{$order['code']}", siteOf()))->toBeApiError(404);

    $paid = test()->postJson("/api/v1/public/orders/{$order['code']}/payments", [], [...$access, ...critical()])->assertOk()->json('data');
    $reservation = $paid['reservations'][0]['code'];

    expect($paid['status'])->toBe('confirmado')
        ->and($paid['reservations'][0]['status'])->toBe('confirmada')
        ->and(reservationRow($reservation)->channel)->toBe('E-commerce')
        ->and((int) departureRow('SAL-0404')->sold)->toBe($sold + 2)
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('reservation_id', reservationRow($reservation)->id)->where('status', '<>', 'pagada')->count()))->toBe(0);

    return ['order' => $order['code'], 'reservation' => $reservation];
}

function flujoB2b(): array
{
    $agency = fn () => rowOf('channel_b2b_agencies', 'AGB-01');
    $creditBefore = bcadd((string) $agency()->credit_used, '0', 2);
    actingAsSeed('U13');
    $body = ['product' => 'CUS-HUM-FD', 'date' => '2026-10-06', 'adults' => 2];
    $price = test()->postJson('/api/v1/b2b/reservations/quote-price', $body)->assertOk()->json('data');
    expect($price['ok'])->toBeTrue(json_encode($price['errors'] ?? null))
        ->and($price['credit']['allowed'])->toBeTrue();

    $code = (string) test()->postJson('/api/v1/b2b/reservations', [
        ...$body,
        'pay_mode' => 'credito',
        'agency_ref' => 'WAY-7781',
        'passengers' => [
            ['name' => 'Rosa Quispe Mamani', 'doc_type' => 'DNI', 'doc_number' => '41235566'],
            ['name' => 'Elena Quispe Mamani', 'doc_type' => 'DNI', 'doc_number' => '41235567'],
        ],
    ], critical())->assertOk()->json('data.code');

    $reservation = reservationRow($code);
    expect($reservation->channel)->toBe('B2B')
        ->and($reservation->status)->toBe('confirmada')
        ->and(collect(test()->getJson('/api/v1/b2b/reservations')->assertOk()->json('data.reservations'))->pluck('code'))->toContain($code)
        ->and(bcadd((string) $agency()->credit_used, '0', 2))->toBe(bcadd($creditBefore, $price['credit']['amount'], 2))
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_vouchers as v')->join('booking_reservation_services as s', 's.id', '=', 'v.reservation_service_id')->where('s.reservation_id', $reservation->id)->where('v.status', 'emitido')->count()))->toBeGreaterThan(0);

    test()->postJson("/api/v1/b2b/reservations/{$code}/cancel-request", ['reason' => 'Cambio de planes', 'detail' => 'El grupo pospone el viaje para noviembre.'])->assertSuccessful();
    expect(test()->postJson("/api/v1/b2b/reservations/{$code}/cancel-request", ['reason' => 'Cambio de planes', 'detail' => 'Otra vez la misma solicitud.']))->toBeApiError(409, 'CANCEL_REQUEST_PENDING');

    actingAsSeed('U02');
    $detail = test()->getJson("/api/v1/reservations/{$code}")->assertOk()->json('data');
    expect($detail['cancel_request'])->not->toBeNull();
    test()->postJson("/api/v1/reservations/{$code}/cancel", ['reason' => 'Cambio de planes', 'detail' => 'Aprobada la solicitud de la agencia aliada.'], critical(reservationLock($code)))->assertOk()->assertJsonPath('data.status', 'cancelada');

    expect(withinTenant(tenantA(), fn () => DB::table('booking_cancel_requests')->where('reservation_id', $reservation->id)->value('status')))->toBe('aprobada')
        ->and(bcadd((string) $agency()->credit_used, '0', 2))->toBe($creditBefore)
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_vouchers as v')->join('booking_reservation_services as s', 's.id', '=', 'v.reservation_service_id')->where('s.reservation_id', $reservation->id)->where('v.status', 'emitido')->count()))->toBe(0);

    return ['reservation' => $code];
}

function flujoPlataforma(): array
{
    actingAsPlatform();
    $code = (string) test()->postJson('/api/v1/platform/tenants', [
        'commercial_name' => 'Sumaq Rutas',
        'legal_name' => 'Sumaq Rutas Viajes S.A.C.',
        'ruc' => '20612345678',
        'fiscal_address' => 'Av. El Sol 455, Cusco',
        'business_type' => 'Operador turístico',
        'subdomain' => 'sumaq-rutas',
        'plan' => 'professional',
        'status' => 'prueba',
        'sede_name' => 'Cusco Centro',
        'sede_city' => 'Cusco',
        'sede_address' => 'Av. El Sol 455',
        'admin_name' => 'Rocío Huamán Ccori',
        'admin_email' => 'rocio@sumaqrutas.pe',
    ], critical())->assertCreated()->json('data.code');

    $tenant = tenantByCode($code);
    $admin = DB::connection('pgsql_platform')->table('iam_users')->where('tenant_id', $tenant->getKey())->where('code', 'U01')->first(['email', 'status']);
    expect($tenant->status)->toBe('prueba')
        ->and($admin->email)->toBe('rocio@sumaqrutas.pe')
        ->and($admin->status)->toBe('pendiente');

    $detail = test()->getJson("/api/v1/platform/tenants/{$code}")->assertOk()->json('data');
    test()->postJson("/api/v1/platform/tenants/{$code}/change-plan", ['plan' => 'enterprise', 'reason' => 'Suma dos sedes nuevas'], critical((int) $detail['lock_version']))->assertOk();
    expect(test()->postJson("/api/v1/platform/tenants/{$code}/change-plan", ['plan' => 'enterprise'], critical((int) tenantByCode($code)->lock_version)))->toBeApiError(409, 'SAME_PLAN');

    test()->postJson("/api/v1/platform/tenants/{$code}/suspend", ['reason' => 'Falta de pago de la primera factura'], critical((int) tenantByCode($code)->lock_version))->assertOk();
    expect(tenantByCode($code)->status)->toBe('suspendido');
    expect(test()->postJson("/api/v1/platform/tenants/{$code}/suspend", ['reason' => 'Otra vez la misma suspensión'], critical((int) tenantByCode($code)->lock_version)))->toBeApiError(409, 'TEN-BR-08');

    test()->postJson("/api/v1/platform/tenants/{$code}/reactivate", ['reason' => 'Pago regularizado por transferencia'], critical((int) tenantByCode($code)->lock_version))->assertOk();
    expect(tenantByCode($code)->status)->not->toBe('suspendido');

    return ['tenant' => $code, 'plan' => test()->getJson("/api/v1/platform/tenants/{$code}")->assertOk()->json('data.plan')];
}

describe('Flujo de negocio completo de la agencia', function () {
    it('Comercial: registra el lead, Ventas lo toma, lo califica y lo convierte en cliente y oportunidad', function () {
        $flow = flujoLead();

        expect($flow['client'])->toStartWith('CLI-')
            ->and($flow['opportunity'])->toStartWith('OPP-');
    });

    it('Cotización: pide aprobación interna, Gerencia la decide, se envía y el cliente la aprueba desde su portal', function () {
        $flow = flujoCotizacion(flujoLead());

        expect(rowOf('quote_quotes', $flow['quote'])->opportunity_id)->toBe(idOf('crm_opportunities', $flow['opportunity']));
    });

    it('Reserva: convierte una sola vez, completa pasajeros y confirma los servicios con el proveedor', function () {
        $flow = flujoReserva(flujoCotizacion(flujoLead()));

        expect(reservationRow($flow['reservation'])->status)->toBe('confirmada');
    });

    it('Cobros: el cliente reporta su pago en el portal, Finanzas lo valida y la cuota baja su saldo; también un pago directo', function () {
        $flow = flujoCobros(flujoReserva(flujoCotizacion(flujoLead())));

        expect(rowOf('fin_payments', $flow['portal_payment'])->reservation_id)->toBe(reservationRow($flow['reservation'])->id);
    });

    it('Comprobante: emite la boleta del anticipo cobrado y el OSE la acepta', function () {
        $flow = flujoComprobante(flujoCobros(flujoReserva(flujoCotizacion(flujoLead()))));

        expect($flow['invoice'])->toStartWith('B001-');
    });

    it('Operaciones: asigna recursos, emite el voucher, resuelve la incidencia, cierra la orden y completa la reserva', function () {
        $flow = flujoOperaciones(flujoReserva(flujoCotizacion(flujoLead())));

        expect(rowOf('ops_orders', $flow['order'])->status)->toBe('completada');
    });

    it('Finanzas, lado proveedor: registra la cuenta por pagar, la aprueba y la paga; calcula, aprueba y paga la comisión', function () {
        $flow = flujoProveedores(flujoOperaciones(flujoCobros(flujoReserva(flujoCotizacion(flujoLead())))));

        expect(rowOf('fin_commissions', $flow['commission'])->payment_ref)->toBe('PLANILLA-2026-09');
    });

    it('Cancelación: Ventas solo solicita la anulación y Gerencia cancela la segunda reserva con su penalidad', function () {
        $flow = flujoCancelacion(flujoLead());

        expect(reservationRow($flow['cancelled'])->status)->toBe('cancelada');
    });

    it('Canales: el sitio público vende del carrito al pedido pagado', function () {
        $flow = flujoSitio();

        expect($flow['order'])->not->toBeEmpty();
    });

    it('Canales: la agencia aliada reserva en el portal B2B y su solicitud de anulación llega al back-office', function () {
        $flow = flujoB2b();

        expect(reservationRow($flow['reservation'])->status)->toBe('cancelada');
    });

    it('Plataforma: el Super Admin da de alta una agencia, le cambia el plan, la suspende y la reactiva', function () {
        $flow = flujoPlataforma();

        expect(json_encode($flow['plan']))->toContain('enterprise');
    });
});
