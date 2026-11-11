<?php

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    lockTreasury();
    Queue::fake();
});

function gapCustodian(): string
{
    return withinTenant(tenantA(), fn () => DB::table('iam_users')->where('code', 'U07')->value('id'));
}

function treasuryAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function openedPettyCash(object $test): string
{
    $code = $test->postJson('/api/v1/treasury/accounts', ['kind' => 'petty_cash', 'name' => 'Caja chica de brechas', 'currency' => 'PEN', 'opening_balance' => 400, 'fund_amount' => 400, 'custodian_id' => gapCustodian()])->assertCreated()->json('data.code');
    $test->postJson("/api/v1/treasury/petty-cash/{$code}/sessions", ['counted' => 400])->assertCreated();

    return $code;
}

it('la diferencia cambiaria previsualiza por cuenta en dólares, se registra una vez por periodo y solo con finance.invoicing', function () {
    actingAsSeed('U02');
    $preview = $this->getJson('/api/v1/treasury/fx/revaluation-preview?close_rate=3.95')->assertOk()->json('data');

    expect($preview['period'])->toBe('2026-09')
        ->and($preview['close_rate'])->toBe('3.9500')
        ->and(collect($preview['rows'])->pluck('code'))->toContain('CTA-02')
        ->and($preview['can']['register'])->toBeFalse()
        ->and($preview['rows'][0])->toHaveKeys(['balance_usd', 'book_rate', 'book_pen', 'market_pen', 'unrealized_pen', 'realized_pen', 'registered']);
    expect($this->postJson('/api/v1/treasury/fx/revaluations', ['close_rate' => 3.95]))->toBeApiError(403);

    actingAsSeed('U08');
    $codes = $this->postJson('/api/v1/treasury/fx/revaluations', ['close_rate' => 3.95])->assertCreated()->json('data.codes');
    $row = withinTenant(tenantA(), fn () => DB::table('fin_fx_revaluations')->where('code', $codes[0])->first());

    expect($codes[0])->toStartWith('DC-')
        ->and($row->period)->toBe('2026-09')
        ->and((string) $row->close_rate)->toStartWith('3.95')
        ->and(treasuryAudit(['entity' => 'Diferencia cambiaria', 'entity_id' => $codes[0], 'action' => 'registrar']))->toBeTrue()
        ->and(collect($this->getJson('/api/v1/treasury/fx/revaluation-preview')->json('data.rows'))->firstWhere('code', 'CTA-02')['registered'])->not->toBeNull();
    expect($this->postJson('/api/v1/treasury/fx/revaluations', ['close_rate' => 3.95]))->toBeApiError(409, 'TES-BR-16');
    expect($this->postJson('/api/v1/treasury/fx/revaluations', []))->toBeApiError(422);
});

it('la configuración de tesorería se lee, se edita con su versión y alimenta la rentabilidad', function () {
    actingAsSeed('U01');
    $settings = $this->getJson('/api/v1/treasury/settings')->assertOk()->json('data');

    $updated = $this->patchJson('/api/v1/treasury/settings', ['petty_tolerance' => 5, 'max_petty_expense' => 300, 'sworn_statement_max' => 100, 'margin_target_pct' => 30, 'margin_floor_pct' => 18, 'recurring_outflows' => [['concept' => 'Alquiler de oficina', 'amount' => 4200, 'day' => 5]], 'lock_version' => $settings['lock_version']])->assertOk()->json('data');

    expect($updated['max_petty_expense'])->toEqual(300)
        ->and($updated['lock_version'])->toBe($settings['lock_version'] + 1)
        ->and($updated['recurring_outflows'])->toHaveCount(1)
        ->and($this->getJson('/api/v1/finance/profitability')->json('data.target'))->toEqual(30)
        ->and(treasuryAudit(['entity' => 'Configuración de tesorería', 'action' => 'editar']))->toBeTrue();
    expect($this->patchJson('/api/v1/treasury/settings', ['petty_tolerance' => 6, 'lock_version' => $settings['lock_version']]))->toBeApiError(409, 'STALE_VERSION');
    expect($this->patchJson('/api/v1/treasury/settings', ['margin_floor_pct' => 40]))->toBeApiError(422);
    expect($this->patchJson('/api/v1/treasury/settings', ['sworn_statement_max' => 900]))->toBeApiError(422);

    actingAsSeed('U07');
    expect($this->patchJson('/api/v1/treasury/settings', ['petty_tolerance' => 7]))->toBeApiError(403);
});

it('el gasto de caja chica guarda su comprobante revisado por el antivirus y se descarga', function () {
    Storage::fake((string) config('filesystems.default'));
    actingAsSeed('U01');
    $cash = openedPettyCash($this);

    $code = $this->withHeaders(['Accept' => 'application/json'])->post("/api/v1/treasury/petty-cash/{$cash}/expenses", [
        'amount' => 35, 'category' => 'Movilidad', 'description' => 'Taxi a la notaría', 'receipt_type' => 'sales_receipt', 'series_number' => 'B001-778', 'supplier' => 'Taxi Seguro',
        'file' => UploadedFile::fake()->createWithContent('boleta.pdf', "%PDF-1.4\n%prueba\n"),
    ])->assertCreated()->json('data.code');
    $path = withinTenant(tenantA(), fn () => DB::table('fin_expense_receipts as r')->join('fin_treasury_movements as m', 'm.id', '=', 'r.movement_id')->where('m.code', $code)->value('r.file_path'));

    expect($path)->toContain('/finance/receipts/')
        ->and(Storage::disk((string) config('filesystems.default'))->exists($path))->toBeTrue();
    $this->get("/api/v1/treasury/movements/{$code}/receipt")->assertOk()->assertHeader('Content-Type', 'application/pdf');

    $movement = collect($this->getJson('/api/v1/treasury/accounts')->json('data.movements'))->firstWhere('code', $code);
    expect($movement['receipt'])->toMatchArray(['type' => 'Boleta', 'number' => 'B001-778', 'file' => true])
        ->and($movement['origin']['label'])->toBe('Gasto de caja chica');

    $other = $this->postJson("/api/v1/treasury/petty-cash/{$cash}/expenses", ['amount' => 10, 'category' => 'Movilidad', 'description' => 'Sin archivo', 'receipt_type' => 'mobility_sheet', 'supplier' => 'Mototaxi'])->assertCreated()->json('data.code');
    expect($this->getJson("/api/v1/treasury/movements/{$other}/receipt"))->toBeApiError(404);
    expect($this->withHeaders(['Accept' => 'application/json'])->post("/api/v1/treasury/petty-cash/{$cash}/expenses", ['amount' => 5, 'category' => 'Movilidad', 'description' => 'Archivo de texto', 'receipt_type' => 'ticket', 'series_number' => 'T-1', 'supplier' => 'X', 'file' => UploadedFile::fake()->createWithContent('nota.txt', 'texto')]))->toBeApiError(422, 'TES-BR-12');
});

it('el acta del arqueo se descarga en PDF con el conteo y las firmas', function () {
    actingAsSeed('U01');
    $cash = openedPettyCash($this);
    $count = $this->postJson("/api/v1/treasury/petty-cash/{$cash}/counts", ['kind' => 'surprise', 'denominations' => ['200' => 2]])->assertCreated()->json('data.code');

    $response = $this->get("/api/v1/treasury/counts/{$count}/pdf")->assertOk()->assertHeader('Content-Type', 'application/pdf');

    expect(substr((string) $response->getContent(), 0, 4))->toBe('%PDF')
        ->and(treasuryAudit(['entity' => 'Arqueo de caja', 'entity_id' => $count, 'action' => 'solicitar_pdf']))->toBeTrue();
    expect($this->getJson('/api/v1/treasury/counts/ARQ-9999/pdf'))->toBeApiError(404);
});

it('registrar movimiento exige banco, categoría del sentido y número de operación', function () {
    actingAsSeed('U07');
    $base = ['account' => 'CTA-01', 'direction' => 'out', 'amount' => 20, 'date' => BUSINESS_TODAY, 'category' => 'Alquileres', 'description' => 'Alquiler de prueba', 'reference' => 'OP-1'];

    $code = $this->postJson('/api/v1/treasury/movements', $base, critical())->assertCreated()->json('data.code');
    expect(collect($this->getJson('/api/v1/treasury/accounts')->json('data.movements'))->firstWhere('code', $code)['category'])->toBe('Alquileres');
    expect($this->postJson('/api/v1/treasury/movements', [...$base, 'account' => 'CTA-07'], critical()))->toBeApiError(422);
    expect($this->postJson('/api/v1/treasury/movements', [...$base, 'category' => 'Intereses bancarios'], critical()))->toBeApiError(422);
    expect($this->postJson('/api/v1/treasury/movements', [...$base, 'reference' => null], critical()))->toBeApiError(422);
    expect($this->getJson('/api/v1/treasury/accounts')->json('data.categories'))->toHaveKeys(['in', 'out']);
});
