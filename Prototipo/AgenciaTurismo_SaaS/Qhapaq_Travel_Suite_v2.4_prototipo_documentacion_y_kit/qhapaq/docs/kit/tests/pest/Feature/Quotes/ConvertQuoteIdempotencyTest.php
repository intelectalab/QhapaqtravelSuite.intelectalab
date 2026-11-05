<?php

/*
| Conversión idempotente cotización → reserva (esp. 04 §4.3 pasos 0–19, T-R01/T-R02/T-R04;
| CONVENCIONES §3 Idempotency-Key; UNIQUE (tenant_id, quote_id) WHERE quote_id IS NOT NULL).
| Plantilla para toda operación crítica: misma key → misma respuesta; key distinta → idempotencia
| de negocio; concurrencia → una sola fila.
*/

use App\Domain\Bookings\Models\Reservation;
use App\Domain\Quotes\Models\Quote;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    // Cotización aprobada nueva de U03 para CLI-0003, PRD-011 el 2026-11-20 × 2 pax (fábrica de referencia)
    $this->quote = withinTenant(tenantA(), fn () => \Database\Factories\QuoteFactory::new()
        ->forClient('CLI-0003')->ownedBy(seedUser('U03'))
        ->withItem(product: 'PRD-011', serviceDate: '2026-11-20', pax: 2)
        ->approved()->create());
    actingAsSeed('U03');
});

function convert(Quote $q, string $key, ?int $lock = null)
{
    return test()->postJson("/api/v1/quotes/{$q->id}/convert", [], critical($lock ?? $q->lock_version, $key));
}

it('convierte: 201, reserva confirmada, cotización convertida y oportunidad ganada', function () {
    $res = convert($this->quote, idem('conv'))->assertCreated();

    $r = $res->json('data');
    expect($r['status'])->toBe('confirmada')
        ->and($r['code'])->toMatch('/^RES-2026-\d{6}$/')
        ->and($this->quote->fresh()->status)->toBe('convertida')
        ->and($this->quote->fresh()->reservation_id)->toBe($r['id']);
});

it('misma Idempotency-Key → misma respuesta (paso 0) y una sola reserva', function () {
    $key = idem('conv');
    $a = convert($this->quote, $key)->assertCreated();
    $b = convert($this->quote, $key); // la respuesta cacheada conserva el 201 original

    expect($b->status())->toBe(201)
        ->and($b->json('data.id'))->toBe($a->json('data.id'))
        ->and(withinTenant(tenantA(), fn () => Reservation::query()->where('quote_id', $this->quote->id)->count()))->toBe(1);
});

it('misma key con cuerpo distinto → 422', function () {
    $key = idem('conv');
    convert($this->quote, $key)->assertCreated();

    $this->postJson("/api/v1/quotes/{$this->quote->id}/convert", ['notes' => 'otro cuerpo'], critical($this->quote->lock_version, $key))
        ->assertUnprocessable();
});

it('key distinta sobre una cotización ya convertida → 200 con la reserva existente (paso 4) y auditoría convertir_idempotente', function () {
    $a = convert($this->quote, idem('conv'))->assertCreated();
    $b = convert($this->quote->fresh(), idem('conv2'));

    $b->assertOk();
    expect($b->json('data.id'))->toBe($a->json('data.id'));
    expect(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('action', 'convertir_idempotente')->exists()))->toBeTrue();
});

it('sin Idempotency-Key → 422 IDEMPOTENCY_KEY_REQUIRED (supuesto de F0-26)', function () {
    $this->postJson("/api/v1/quotes/{$this->quote->id}/convert", [], ['If-Match' => (string) $this->quote->lock_version])
        ->assertStatus(422)->assertJsonPath('code', 'IDEMPOTENCY_KEY_REQUIRED');
});

it('10 solicitudes concurrentes con keys distintas → 1 reserva (lock Redis + FOR UPDATE + UNIQUE parcial)', function () {
    // Ejecutar con `pest --parallel` o con procesos: aquí se simula disparando la Action en paralelo.
    $action = app(\App\Domain\Bookings\Actions\ConvertQuoteToReservation::class);
    $results = \Illuminate\Support\Facades\Concurrency::run(array_fill(0, 10, fn () => rescue(
        fn () => $action->handle($this->quote->id, idempotencyKey: idem('par'), lockVersion: $this->quote->lock_version, actor: seedUser('U03')),
        report: false,
    )));

    expect(collect($results)->filter()->pluck('id')->unique())->toHaveCount(1)
        ->and(withinTenant(tenantA(), fn () => Reservation::query()->where('quote_id', $this->quote->id)->count()))->toBe(1);
});

it('CxC 40/60 con vencimientos exactos (paso 14)', function () {
    $r = convert($this->quote, idem('conv'))->assertCreated()->json('data');

    $cxc = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('reservation_id', $r['id'])->orderBy('due_date')->get());
    expect($cxc)->toHaveCount(2)
        ->and($cxc[0]->due_date)->toBe('2026-10-02')          // min(hoy+3, max(hoy, 2026-11-20))
        ->and($cxc[1]->due_date)->toBe('2026-11-05')          // max(hoy, 2026-11-20 − 15)
        ->and(bcadd($cxc[0]->amount, $cxc[1]->amount, 2))->toBe($r['total_amount'])
        ->and($cxc[0]->amount)->toBe(bcdiv(bcmul($r['total_amount'], '40', 4), '100', 2)); // round2(total × 0.40)
});

it('cotización no aprobada → 409 RT-3 (T-R04)', function () {
    $q = withinTenant(tenantA(), fn () => Quote::query()->where('code', 'COT-2026-00188')->firstOrFail()); // enviada

    expect(convert($q, idem('conv')))->toBeApiError(409, 'RT-3');
});

it('If-Match desactualizado → 409 y no crea nada', function () {
    expect(convert($this->quote, idem('conv'), $this->quote->lock_version + 5))->toBeApiError(409);
    expect(withinTenant(tenantA(), fn () => Reservation::query()->where('quote_id', $this->quote->id)->exists()))->toBeFalse();
});

it('Ventas no convierte cotizaciones ajenas (ownership) y Operaciones no tiene reservations.create', function () {
    actingAsSeed('U04');
    expect(convert($this->quote, idem('conv')))->toBeApiError(403);

    actingAsSeed('U05');
    expect(convert($this->quote, idem('conv')))->toBeApiError(403);
});
