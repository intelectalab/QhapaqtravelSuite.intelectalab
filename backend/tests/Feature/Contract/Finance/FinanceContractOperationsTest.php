<?php

use Brick\Math\BigDecimal;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

function financeContractAudited(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

beforeEach(fn () => lockTreasury());

it('GET /finance/receivables/summary devuelve KPIs, aging en 5 tramos, próximos vencimientos y cobrado por facturar', function () {
    actingAsSeed('U07');

    $data = $this->getJson('/api/v1/finance/receivables/summary')->assertOk()->json('data');

    expect($data['aging'])->toHaveCount(5)
        ->and($data['kpis'])->toHaveKeys(['receivable_pen', 'overdue_pen', 'collected_uninvoiced_pen'])
        ->and($data['upcoming'])->toBeArray();
});

it('GET /finance/reservations/{code}/account calcula total, comprometido y disponible con montos exactos', function () {
    actingAsSeed('U07');

    $data = $this->getJson('/api/v1/finance/reservations/RES-2026-000344/account')->assertOk()->json('data');
    $total = (string) rowOf('booking_reservations', 'RES-2026-000344')->total_amount;

    $expected = BigDecimal::of($data['total'])->minus($data['committed']);

    expect(BigDecimal::of($data['total'])->isEqualTo($total))->toBeTrue()
        ->and(BigDecimal::of($data['available'])->isEqualTo($expected->isNegative() ? BigDecimal::zero() : $expected))->toBeTrue();
    expect($this->getJson('/api/v1/finance/reservations/RES-NO-EXISTE/account'))->toBeApiError(404);
});

it('POST /finance/payments/{code}/validate deja el pago confirmado sin aplicar y /apply lo aplica a la cuota', function () {
    actingAsSeed('U07');
    $before = (string) rowOf('fin_receivables', 'CXC-00713')->paid_amount;

    expect($this->postJson('/api/v1/finance/payments/PAG-01922/validate', ['apply' => false], critical()))->toBeApiError(428, 'IF_MATCH_REQUIRED');

    $this->postJson('/api/v1/finance/payments/PAG-01922/validate', ['apply' => false], critical((int) rowOf('fin_payments', 'PAG-01922')->lock_version))
        ->assertOk()->assertJsonPath('data.status', 'confirmado');
    expect((string) rowOf('fin_receivables', 'CXC-00713')->paid_amount)->toBe($before);

    $this->postJson('/api/v1/finance/payments/PAG-01922/apply', ['receivable_id' => 'CXC-00713'], critical((int) rowOf('fin_payments', 'PAG-01922')->lock_version))
        ->assertOk()->assertJsonPath('data.status', 'aplicado')->assertJsonPath('data.receivable', 'CXC-00713');

    expect(BigDecimal::of((string) rowOf('fin_receivables', 'CXC-00713')->paid_amount)->isEqualTo(BigDecimal::of($before)->plus((string) rowOf('fin_payments', 'PAG-01922')->amount)))->toBeTrue()
        ->and(financeContractAudited(['entity' => 'Cuenta por cobrar', 'entity_id' => 'CXC-00713', 'action' => 'aplicar']))->toBeTrue();
    expect($this->postJson('/api/v1/finance/payments/PAG-01922/apply', ['receivable_id' => 'CXC-00713'], critical((int) rowOf('fin_payments', 'PAG-01922')->lock_version)))->toBeApiError(409, 'FIN-BR-12');
});

it('POST /finance/payments/{code}/validate con apply aplica en un solo paso', function () {
    actingAsSeed('U07');

    $this->postJson('/api/v1/finance/payments/PAG-01922/validate', ['apply' => true], critical((int) rowOf('fin_payments', 'PAG-01922')->lock_version))
        ->assertOk()->assertJsonPath('data.status', 'aplicado');
});

it('GET /finance/payables/summary y /by-provider resumen las cuentas por pagar', function () {
    actingAsSeed('U07');

    expect($this->getJson('/api/v1/finance/payables/summary')->assertOk()->json('data.kpis'))->toHaveKeys(['payable_pen', 'overdue_pen', 'to_approve']);
    $providers = $this->getJson('/api/v1/finance/payables/by-provider')->assertOk()->json('data');

    expect($providers)->not->toBeEmpty()
        ->and($providers[0])->toHaveKeys(['provider', 'total_pen', 'paid_pen', 'balance_pen', 'overdue_pen', 'next_due']);
});

it('GET /finance/bank-accounts lista las cuentas bancarias de origen y filtra por moneda', function () {
    actingAsSeed('U07');

    $usd = $this->getJson('/api/v1/finance/bank-accounts?filter[currency]=USD')->assertOk()->json('data');

    expect($usd)->not->toBeEmpty()
        ->and(collect($usd)->pluck('currency')->unique()->all())->toBe(['USD']);
    expect($this->getJson('/api/v1/finance/bank-accounts?filter[currency]=EUR'))->toBeApiError(422);
});

it('POST /finance/costs/preview calcula el impacto en el margen y POST /finance/costs registra el costo', function () {
    actingAsSeed('U07');
    $provider = (string) withinTenant(tenantA(), fn () => DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')->orderBy('ref')->value('ref'));

    $impact = $this->postJson('/api/v1/finance/costs/preview', ['reservation_id' => 'RES-2026-000348', 'amount' => '100.00', 'currency' => 'PEN'])->assertOk()->json('data');
    expect($impact['amount_pen'])->toBe('100.00')
        ->and((string) BigDecimal::of($impact['after']['cost_pen'])->minus($impact['before']['cost_pen']))->toBe('100.00');

    $code = $this->postJson('/api/v1/finance/costs', ['reservation' => 'RES-2026-000348', 'provider' => $provider, 'cost_type' => 'costo_adicional', 'concept' => 'Traslado adicional de prueba', 'amount' => '100.00', 'currency' => 'PEN'], critical())
        ->assertCreated()->json('data.code');

    expect((string) rowOf('fin_payables', $code)->amount)->toBe('100.00')
        ->and(financeContractAudited(['entity' => 'Costo', 'entity_id' => $code, 'action' => 'registrar']))->toBeTrue();
});

it('Contabilidad no registra costos y Ventas no ve las cuentas por pagar (403 con permisos requeridos)', function () {
    actingAsSeed('U08');
    $response = $this->postJson('/api/v1/finance/costs', ['reservation' => 'RES-2026-000348'], critical());
    expect($response)->toBeApiError(403)->and($response->json('required_permissions'))->toContain('finance.payables');

    actingAsSeed('U03');
    $response = $this->getJson('/api/v1/finance/payables/summary');
    expect($response)->toBeApiError(403)->and($response->json('required_permissions'))->toContain('finance.payables');
});

it('GET /finance/commissions/summary devuelve KPIs, beneficiarios y reservas sin cálculo', function () {
    actingAsSeed('U07');

    $data = $this->getJson('/api/v1/finance/commissions/summary')->assertOk()->json('data');

    expect($data)->toHaveKeys(['kpis', 'by_beneficiary', 'pending_reservations'])
        ->and($data['kpis']['pending_reservations'])->toBeInt();
});

it('GET /finance/profitability/reservations pagina la tabla por reserva y filtra por semáforo', function () {
    actingAsSeed('U07');

    $all = $this->getJson('/api/v1/finance/profitability/reservations?page[size]=100')->assertOk()->json();
    $red = $this->getJson('/api/v1/finance/profitability/reservations?filter[light]=r&page[size]=100')->assertOk()->json('data');

    expect($all['data'])->not->toBeEmpty()
        ->and($all['meta'])->toHaveKey('next_cursor')
        ->and(collect($red)->pluck('band')->unique()->reject(fn ($band) => $band === 'bad')->all())->toBe([]);
    expect($this->getJson('/api/v1/finance/profitability/reservations?filter[light]=x'))->toBeApiError(422);
});

it('POST /finance/reservations/{code}/account-statement envía el estado de cuenta al cliente y lo audita', function () {
    actingAsSeed('U07');

    $data = $this->postJson('/api/v1/finance/reservations/RES-2026-000344/account-statement', ['email' => 'cliente.prueba@example.com'], critical())->assertOk()->json('data');

    expect($data['sent_to'])->toBe('cliente.prueba@example.com')
        ->and(financeContractAudited(['entity' => 'Reserva', 'entity_id' => 'RES-2026-000344', 'action' => 'enviar_estado_cuenta']))->toBeTrue();
});

it('GET /finance/invoices/{number}/xml y /cdr devuelven la URL firmada o 409 si el proveedor aún no los entrega', function () {
    Storage::fake('s3');
    Storage::disk('s3')->buildTemporaryUrlsUsing(fn (string $path, DateTimeInterface $expiration): string => "https://archivos.prueba/{$path}");
    actingAsSeed('U07');

    expect($this->getJson('/api/v1/finance/invoices/F001-00001482/xml'))->toBeApiError(409, 'FIN-FISCAL-FILE');

    withinTenant(tenantA(), function () {
        $invoice = DB::table('fin_invoices')->where('number', 'F001-00001482')->value('id');
        $document = DB::table('sys_documents')->insertGetId([
            'doc_type' => 'cdr', 'entity_type' => 'fin_invoices', 'entity_id' => $invoice, 'storage_disk' => 's3', 'storage_path' => 'fiscal/F001-00001482-cdr.zip',
            'file_name' => 'R-F001-00001482.zip', 'mime_type' => 'application/zip', 'size_bytes' => 512, 'sha256' => str_repeat('b', 64),
        ]);
        DB::table('fin_invoices')->where('id', $invoice)->update(['cdr_document_id' => $document]);
    });

    expect($this->getJson('/api/v1/finance/invoices/F001-00001482/cdr')->assertOk()->json('data.url'))->toStartWith('https://archivos.prueba/fiscal/F001-00001482-cdr.zip');
    expect($this->getJson('/api/v1/finance/invoices/F001-99999999/cdr'))->toBeApiError(404);
});

it('POST /finance/invoices/{number}/void comunica la baja al OSE (adaptador simulado) y anula el comprobante', function () {
    actingAsSeed('U07');
    $number = (string) withinTenant(tenantA(), function () {
        $number = DB::table('fin_invoices as i')->where('i.status', 'aceptado')->whereIn('i.doc_type', ['01', '03'])
            ->whereNotExists(fn ($notes) => $notes->from('fin_invoices as n')->whereColumn('n.ref_invoice_id', 'i.id'))->orderBy('i.number')->value('i.number');
        DB::table('fin_invoices')->where('number', $number)->update(['issue_date' => BUSINESS_TODAY]);

        return $number;
    });

    $this->postJson("/api/v1/finance/invoices/{$number}/void", ['reason' => 'Error en el nombre del cliente'], critical())->assertOk()->assertJsonPath('data.status', 'anulado');

    $invoice = rowOf('fin_invoices', $number, column: 'number');
    expect($invoice->status)->toBe('anulado')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_fiscal_events')->where('invoice_id', $invoice->id)->where('action', 'void')->where('status', 'ok')->exists()))->toBeTrue()
        ->and(financeContractAudited(['entity' => 'Comprobante', 'entity_id' => $number, 'action' => 'dar_de_baja']))->toBeTrue();
    expect($this->postJson("/api/v1/finance/invoices/{$number}/void", ['reason' => 'Segundo intento de baja'], critical()))->toBeApiError(409, 'FIN-BR-50');
});

it('POST /finance/invoices/{number}/void rechaza la baja fuera del plazo legal', function () {
    actingAsSeed('U07');
    $number = (string) withinTenant(tenantA(), function () {
        $number = DB::table('fin_invoices')->where('status', 'aceptado')->whereIn('doc_type', ['01', '03'])->orderBy('number')->value('number');
        DB::table('fin_invoices')->where('number', $number)->update(['issue_date' => '2026-09-01']);

        return $number;
    });

    expect($this->postJson("/api/v1/finance/invoices/{$number}/void", ['reason' => 'Fuera de plazo'], critical()))->toBeApiError(422, 'FIN-BR-50');
});

it('POST /finance/invoices/{number}/void usa el plazo de baja que fija la agencia en su configuración', function () {
    actingAsSeed('U01');
    $currency = $this->getJson('/api/v1/settings')->json('data.sections.currency.values');
    $version = (int) withinTenant(tenantA(), fn () => DB::table('sys_settings')->where('section', 'currency')->value('lock_version'));

    expect($this->patchJson('/api/v1/settings/currency', [...$currency, 'invoice_void_days' => 31], ['If-Match' => (string) $version]))->toBeApiError(422)
        ->and($this->patchJson('/api/v1/settings/currency', [...$currency, 'invoice_void_days' => 2], ['If-Match' => (string) $version])->assertOk()->json('data.changed'))->toContain('invoice_void_days');

    $number = (string) withinTenant(tenantA(), function () {
        $number = DB::table('fin_invoices as i')->where('i.status', 'aceptado')->whereIn('i.doc_type', ['01', '03'])
            ->whereNotExists(fn ($notes) => $notes->from('fin_invoices as n')->whereColumn('n.ref_invoice_id', 'i.id'))->orderBy('i.number')->value('i.number');
        DB::table('fin_invoices')->where('number', $number)->update(['issue_date' => CarbonImmutable::parse(BUSINESS_TODAY)->subDays(5)->toDateString()]);

        return $number;
    });

    actingAsSeed('U07');
    expect($this->postJson("/api/v1/finance/invoices/{$number}/void", ['reason' => 'Fuera del plazo de la agencia'], critical()))->toBeApiError(422, 'FIN-BR-50');
});
