<?php

use App\Jobs\SendPlainMail;
use App\Jobs\ShowcaseMonthlyFees;
use App\Jobs\ShowcaseReminder;
use Carbon\CarbonImmutable;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(function () {
    lockPlatformBilling();
    lockShowcase();
});

function showcaseBillingDb(): ConnectionInterface
{
    return DB::connection('pgsql_platform');
}

function showcaseBillingNow(string $moment): void
{
    $now = CarbonImmutable::parse($moment, 'America/Lima');
    Carbon::setTestNow($now);
    CarbonImmutable::setTestNow($now);
}

function showcaseBillingBooking(string $listingCode, array $extra): string
{
    $listing = showcaseBillingDb()->table('platform_showcase_listings')->where('code', $listingCode)->first();
    $code = 'SHB-F'.Str::upper(Str::random(6));
    showcaseBillingDb()->table('platform_showcase_bookings')->insert([
        'id' => (string) Str::uuid7(),
        'code' => $code,
        'listing_id' => $listing->id,
        'service_date' => '2026-09-12',
        'start_time' => '10:00',
        'traveler_name' => 'Viajero de prueba',
        'traveler_email' => Str::lower($code).'@correo.pe',
        'pax' => 2,
        'language' => 'es',
        'fee_basis' => 'por_asistente',
        'fee_amount' => '4.00',
        'cancel_token' => 'tok-'.Str::lower($code),
        ...$extra,
    ]);

    return $code;
}

function showcaseBillingRun(string $class): string
{
    $job = new $class;
    $job->handle();

    return (string) $job->runResult;
}

function showcaseAgencyOfA(): object
{
    return showcaseBillingDb()->table('platform_showcase_agencies')->where('tenant_id', tenantA()->getKey())->first();
}

function showcasePendingOf(string $agencyId, string $cutoff): string
{
    return (string) showcaseBillingDb()->table('platform_showcase_bookings as b')->join('platform_showcase_listings as l', 'l.id', '=', 'b.listing_id')
        ->where('l.agency_id', $agencyId)->whereNull('b.invoice_id')->where('b.status', '<>', 'cancelada')->whereIn('b.fee_basis', ['por_asistente', 'comision'])->where('b.service_date', '<', $cutoff)
        ->sum('b.fee_amount');
}

it('VT-03: el día 1 factura a la agencia los cargos por asistente y las comisiones del mes cerrado, una sola vez', function () {
    $agency = showcaseAgencyOfA();
    $listing = (string) showcaseBillingDb()->table('platform_showcase_listings')->where('agency_id', $agency->id)->orderBy('code')->value('code');
    $attendee = showcaseBillingBooking($listing, []);
    $commission = showcaseBillingBooking($listing, ['fee_basis' => 'comision', 'amount' => '100.00', 'commission_pct' => '4.00', 'fee_amount' => '4.00']);
    $canceled = showcaseBillingBooking($listing, ['status' => 'cancelada', 'fee_amount' => '6.00']);
    $current = showcaseBillingBooking($listing, ['service_date' => '2026-10-03']);
    showcaseBillingNow('2026-10-01 04:00:00');
    $expected = number_format((float) showcasePendingOf($agency->id, '2026-10-01'), 2, '.', '');
    $subscription = showcaseBillingDb()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->where('status', '<>', 'canceled')->orderByDesc('created_at')->first();

    $result = showcaseBillingRun(ShowcaseMonthlyFees::class);

    $billed = showcaseBillingDb()->table('platform_showcase_bookings')->where('code', $attendee)->value('invoice_id');
    $invoice = showcaseBillingDb()->table('platform_invoices')->where('id', $billed)->first();
    $lines = showcaseBillingDb()->table('platform_invoice_lines')->where('invoice_id', $billed)->get();

    expect($result)->toContain('facturada')
        ->and($invoice->tenant_id)->toBe(tenantA()->getKey())
        ->and($invoice->subscription_id)->toBe($subscription->id)
        ->and($invoice->kind)->toBe('manual')
        ->and($invoice->status)->toBe('open')
        ->and((string) $invoice->subtotal)->toBe($expected)
        ->and((string) $invoice->total)->toBe(bcadd((string) $invoice->subtotal, (string) $invoice->igv, 2))
        ->and($lines->pluck('line_type')->unique()->all())->toBe(['usage_overage'])
        ->and($lines->pluck('description')->implode(' '))->toContain('septiembre 2026')->toContain('comisión de tours de pago')
        ->and(showcaseBillingDb()->table('platform_showcase_bookings')->where('code', $commission)->value('invoice_id'))->toBe($billed)
        ->and(showcaseBillingDb()->table('platform_showcase_bookings')->where('code', $canceled)->value('invoice_id'))->toBeNull()
        ->and(showcaseBillingDb()->table('platform_showcase_bookings')->where('code', $current)->value('invoice_id'))->toBeNull()
        ->and(showcaseBillingDb()->table('audit_events')->where(['entity' => 'Vitrina cargos', 'entity_id' => $agency->code, 'action' => 'facturar'])->exists())->toBeTrue();

    $invoices = showcaseBillingDb()->table('platform_invoices')->where('tenant_id', tenantA()->getKey())->count();
    showcaseBillingRun(ShowcaseMonthlyFees::class);
    expect(showcaseBillingDb()->table('platform_invoices')->where('tenant_id', tenantA()->getKey())->count())->toBe($invoices);
});

it('VT-03: una agencia sin cuenta o sin suscripción no se factura y el proceso lo avisa', function () {
    $agency = showcaseBillingDb()->table('platform_showcase_agencies')->whereNull('tenant_id')->orderBy('code')->first();
    $listing = (string) showcaseBillingDb()->table('platform_showcase_listings')->where('agency_id', $agency->id)->orderBy('code')->value('code');
    $code = showcaseBillingBooking($listing, []);
    showcaseBillingNow('2026-10-01 04:00:00');

    $job = new ShowcaseMonthlyFees;
    $job->handle();

    expect($job->runResult)->toContain('sin cuenta en KipuControl')
        ->and($job->runWarning)->not->toBeNull()
        ->and(showcaseBillingDb()->table('platform_showcase_bookings')->where('code', $code)->value('invoice_id'))->toBeNull();
});

it('la agencia ve en sus cargos qué meses ya se facturaron y un no-show posterior no cambia el cargo facturado', function () {
    $agency = showcaseAgencyOfA();
    $listing = (string) showcaseBillingDb()->table('platform_showcase_listings')->where('agency_id', $agency->id)->orderBy('code')->value('code');
    $code = showcaseBillingBooking($listing, []);
    showcaseBillingNow('2026-10-01 04:00:00');
    showcaseBillingRun(ShowcaseMonthlyFees::class);
    $number = showcaseBillingDb()->table('platform_invoices')->where('id', showcaseBillingDb()->table('platform_showcase_bookings')->where('code', $code)->value('invoice_id'))->value('number');

    actingAsSeed('U01');
    $month = collect($this->getJson('/api/v1/channels/showcase/fees')->assertOk()->json('data.months'))->firstWhere('month', '2026-09');

    expect($month['open_month'])->toBeFalse()
        ->and($month['pending'])->toBe('0.00')
        ->and(collect($month['invoices'])->pluck('number')->all())->toContain(sprintf('FQ01-%08d', $number));

    $this->postJson("/api/v1/channels/showcase/bookings/{$code}/attendance", ['status' => 'no_show'])->assertOk();
    expect((string) showcaseBillingDb()->table('platform_showcase_bookings')->where('code', $code)->value('fee_amount'))->toBe('4.00');
});

it('ShowcaseReminder recuerda a cada viajero confirmado su salida de mañana con el punto de encuentro y el enlace para cancelar', function () {
    Queue::fake();
    $agency = showcaseAgencyOfA();
    $listing = showcaseBillingDb()->table('platform_showcase_listings')->where('agency_id', $agency->id)->orderBy('code')->first();
    $tomorrow = CarbonImmutable::now('America/Lima')->addDay()->toDateString();
    $confirmed = showcaseBillingBooking($listing->code, ['service_date' => $tomorrow, 'fee_basis' => 'plan', 'fee_amount' => '0']);
    showcaseBillingBooking($listing->code, ['service_date' => $tomorrow, 'status' => 'cancelada', 'fee_basis' => 'plan', 'fee_amount' => '0']);
    $expected = showcaseBillingDb()->table('platform_showcase_bookings')->where('service_date', $tomorrow)->where('status', 'confirmada')->count();

    $result = showcaseBillingRun(ShowcaseReminder::class);

    expect($result)->toContain((string) $expected)->toContain('salidas de mañana');
    Queue::assertPushed(SendPlainMail::class, $expected);
    Queue::assertPushed(SendPlainMail::class, fn (SendPlainMail $mail): bool => $mail->to === Str::lower($confirmed).'@correo.pe'
        && $mail->sender === null
        && str_contains($mail->body, (string) $listing->meeting_point)
        && str_contains($mail->body, '/vitrina/cancelar/tok-'.Str::lower($confirmed)));
});
