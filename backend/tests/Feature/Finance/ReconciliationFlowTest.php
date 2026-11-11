<?php

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

function reconImport(object $test, string $content, string $name = 'extracto.csv', array $extra = []): TestResponse
{
    return $test->withHeaders([...critical(), 'Accept' => 'application/json'])
        ->post('/api/v1/finance/bank-statements', ['bank' => 'BCP', ...$extra, 'file' => UploadedFile::fake()->createWithContent($name, $content)]);
}

function reconOpenLines(): Collection
{
    return withinTenant(tenantA(), fn () => DB::table('fin_bank_lines')->whereNull('closure_id')->orderBy('code')->get());
}

it('FIN-E2E-D: importar un extracto crea líneas pendientes normalizadas y registra el extracto', function () {
    actingAsSeed('U07');
    $csv = "Fecha;Descripción;Importe\n30/09/2026;Abono transf ref 55501;1.250,00\n2026-09-30;Comision mantenimiento cta cte;-18.50\nfila sin datos\n";

    $data = reconImport($this, $csv)->assertStatus(202)->json('data');

    expect($data['lines'])->toBe(2)
        ->and($data['codes'])->toHaveCount(2);
    $first = rowOf('fin_bank_lines', $data['codes'][0]);
    $second = rowOf('fin_bank_lines', $data['codes'][1]);
    expect($first->status)->toBe('pendiente')
        ->and($first->description)->toBe('ABONO TRANSF REF 55501')
        ->and((string) $first->amount)->toBe('1250.00')
        ->and((string) $second->amount)->toBe('-18.50')
        ->and((string) $first->value_date)->toStartWith('2026-09-30')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_bank_statements')->where('id', $first->statement_id)->value('lines_count')))->toBe(2)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Conciliación', 'action' => 'importar'])->exists()))->toBeTrue();
});

it('un extracto sin líneas reconocibles responde 422', function () {
    actingAsSeed('U07');

    expect(reconImport($this, "hola\nmundo\n"))->toBeApiError(422, 'FIN-BR-51');
    reconImport($this, '30/09/2026;x;1', 'extracto.pdf')->assertStatus(422)->assertJsonValidationErrors(['file']);
});

it('FIN-BR-52: el matching sugiere el pago por importe y referencia y deja excepción lo demás', function () {
    actingAsSeed('U07');
    $payment = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('kind', 'cobro')->where('currency', 'PEN')->whereNotIn('status', ['revertido', 'rechazado'])->whereNotIn('id', DB::table('fin_bank_lines')->whereNotNull('matched_payment_id')->pluck('matched_payment_id'))->whereNotNull('reference')->first());
    $reference = preg_match('/\d{5,}/', (string) $payment->reference, $found) ? $found[0] : '00000';
    $codes = reconImport($this, "30/09/2026;ABONO REF {$reference};{$payment->amount}\n30/09/2026;ABONO DESCONOCIDO;987654.32\n")->json('data.codes');

    $result = $this->postJson('/api/v1/finance/reconciliation/matching', [], critical())->assertOk()->json('data');

    expect($result['lines'])->toBe(2)
        ->and($result['suggested'])->toBe(1)
        ->and($result['exceptions'])->toBe(1)
        ->and(rowOf('fin_bank_lines', $codes[0])->status)->toBe('sugerido')
        ->and(rowOf('fin_bank_lines', $codes[0])->matched_payment_id)->toBe($payment->id)
        ->and(rowOf('fin_bank_lines', $codes[1])->status)->toBe('excepcion')
        ->and($this->postJson('/api/v1/finance/reconciliation/matching', ['again' => 1], critical()))->toBeApiError(422, 'FIN-BR-51');
});

it('FIN-BR-54: asignar una excepción exige un candidato y concilia con el pago elegido', function () {
    actingAsSeed('U07');
    $candidates = $this->getJson('/api/v1/finance/bank-lines/BNK-3/candidates')->assertOk()->json('data');
    expect($candidates)->not->toBeEmpty()
        ->and($candidates[0])->toHaveKeys(['kind', 'code', 'label', 'pen', 'difference'])
        ->and(collect($candidates)->pluck('kind')->unique()->all())->toBe(['payment']);

    expect($this->postJson('/api/v1/finance/bank-lines/BNK-3/resolve', ['resolution' => 'asignado', 'target' => 'PAG-99999', 'note' => 'Voucher del cliente'], critical()))->toBeApiError(422, 'FIN-BR-54');
    $this->postJson('/api/v1/finance/bank-lines/BNK-3/resolve', ['resolution' => 'asignado', 'note' => 'Sin destino'], critical())->assertStatus(422)->assertJsonValidationErrors(['target']);

    $this->postJson('/api/v1/finance/bank-lines/BNK-3/resolve', ['resolution' => 'asignado', 'target' => $candidates[0]['code'], 'note' => 'Voucher enviado por el cliente'], critical())->assertOk();

    $line = rowOf('fin_bank_lines', 'BNK-3');
    expect($line->status)->toBe('conciliado')
        ->and($line->resolution)->toBe('asignado')
        ->and($line->matched_payment_id)->toBe(rowOf('fin_payments', $candidates[0]['code'])->id);
});

it('FIN-BR-53: confirmar un cargo contra una obligación con saldo registra el pago al proveedor por cargo bancario', function () {
    actingAsSeed('U07');
    $payable = withinTenant(tenantA(), fn () => DB::table('fin_payables')->whereNull('deleted_at')->whereNotNull('approved_at')->where('currency', 'PEN')->whereIn('status', ['aprobada', 'abierta', 'parcial', 'vencida'])->whereNotIn('id', DB::table('fin_bank_lines')->whereNotNull('matched_payable_id')->pluck('matched_payable_id'))->first());
    expect($payable)->not->toBeNull();
    $balance = bcsub((string) $payable->amount, (string) $payable->paid_amount, 2);
    $code = reconImport($this, "30/09/2026;CARGO PAGO PROVEEDOR;-{$balance}\n")->json('data.codes.0');
    $this->postJson('/api/v1/finance/reconciliation/matching', [], critical())->assertOk();
    expect(rowOf('fin_bank_lines', $code)->matched_payable_id)->toBe($payable->id);

    $this->postJson("/api/v1/finance/bank-lines/{$code}/confirm", [], critical())->assertOk();

    $after = rowOf('fin_payables', $payable->code);
    $payout = withinTenant(tenantA(), fn () => DB::table('fin_payable_payouts')->where('bank_line_id', rowOf('fin_bank_lines', $code)->id)->first());
    expect($after->status)->toBe('pagada')
        ->and($payout->method)->toBe('cargo_bancario')
        ->and((string) $payout->amount)->toBe($balance);
});

it('FIN-BR-55: no se cierra con líneas sin conciliar y al cerrar las líneas quedan bloqueadas con el resumen', function () {
    actingAsSeed('U07');

    expect($this->postJson('/api/v1/finance/reconciliation/closures', [], critical()))->toBeApiError(422, 'FIN-BR-55');

    $this->postJson('/api/v1/finance/bank-lines/BNK-1/confirm', [], critical())->assertOk();
    $this->postJson('/api/v1/finance/bank-lines/BNK-3/resolve', ['resolution' => 'otro_ingreso', 'note' => 'Devolución de garantía'], critical())->assertOk();
    $open = reconOpenLines();
    expect($open->where('status', '<>', 'conciliado'))->toBeEmpty();

    $closure = $this->postJson('/api/v1/finance/reconciliation/closures', ['close' => true], critical())->assertOk()->json('data');

    expect($closure['code'])->toStartWith('CON-')
        ->and($closure['lines_count'])->toBe($open->count())
        ->and($closure['net'])->toBe(bcadd($closure['credits'], $closure['debits'], 2))
        ->and(reconOpenLines())->toBeEmpty()
        ->and(collect($this->getJson('/api/v1/finance/reconciliation/closures')->assertOk()->json('data'))->pluck('code'))->toContain($closure['code'])
        ->and($this->postJson('/api/v1/finance/bank-lines/BNK-1/reject', [], critical()))->toBeApiError(409, 'FIN-BR-55');
});

it('Gerencia y Contabilidad no importan, no corren matching ni cierran', function (string $user) {
    actingAsSeed($user);

    expect(reconImport($this, "30/09/2026;ABONO;10.00\n"))->toBeApiError(403)
        ->and($this->postJson('/api/v1/finance/reconciliation/matching', [], critical()))->toBeApiError(403)
        ->and($this->postJson('/api/v1/finance/reconciliation/closures', [], critical()))->toBeApiError(403);
})->with(['U02', 'U08']);
