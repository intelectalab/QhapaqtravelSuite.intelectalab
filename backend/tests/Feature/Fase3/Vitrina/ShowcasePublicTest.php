<?php

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

function vitrinaDb(): ConnectionInterface
{
    return DB::connection('pgsql_platform');
}

function vitrinaBooking(array $extra = []): array
{
    return ['name' => 'Lucía Prado', 'email' => 'lucia.prado@correo.pe', 'date' => '2026-10-02', 'time' => '10:00', 'pax' => 2, 'language' => 'es', ...$extra];
}

it('lista las publicaciones aprobadas con filtros de ciudad, idioma y tipo', function () {
    $all = $this->getJson('/api/v1/showcase/listings')->assertOk()->json('data');
    $codes = collect($all['items'])->pluck('code');

    expect($codes)->toContain('SHL-001')->not->toContain('SHL-010')->not->toContain('SHL-012')
        ->and($all['brand']['name'])->toBe('Rutas Libres Perú');

    $cusco = collect($this->getJson('/api/v1/showcase/listings?city=cusco')->assertOk()->json('data.items'));
    expect($cusco)->not->toBeEmpty()->and($cusco->pluck('city')->unique()->all())->toBe(['cusco']);

    $paid = collect($this->getJson('/api/v1/showcase/listings?model=pago')->assertOk()->json('data.items'));
    expect($paid->pluck('model')->unique()->all())->toBe(['pago']);
});

it('el resumen público trae ciudades, cifras, reglas, planes y add-ons para la web de la vitrina', function () {
    $data = $this->getJson('/api/v1/showcase/overview')->assertOk()->json('data');

    expect(collect($data['cities'])->pluck('id'))->toContain('lima')->toContain('cusco')
        ->and($data['stats']['tours'])->toBeGreaterThanOrEqual(9)
        ->and($data['rules']['free_monthly_bookings'])->toBe(30)
        ->and(collect($data['plans'])->pluck('code'))->toContain('starter')
        ->and(collect($data['addons'])->pluck('code'))->toContain('paypal_gateway');
});

it('la ficha muestra agencia y horarios y registra la visita en el embudo', function () {
    $before = vitrinaDb()->table('platform_funnel_events')->where('kind', 'visita')->count();

    $listing = $this->getJson('/api/v1/showcase/listings/centro-historico-de-lima-gratis')->assertOk()->json('data');

    expect($listing['agency']['verified'])->toBeTrue()
        ->and($listing['start_times'])->toContain('10:00')
        ->and(vitrinaDb()->table('platform_funnel_events')->where('kind', 'visita')->count())->toBe($before + 1);
    $this->getJson('/api/v1/showcase/listings/no-existe')->assertNotFound();
});

it('VT-02: reserva gratis con nombre y correo, exige Idempotency-Key y bloquea el mismo correo en la misma salida', function () {
    $this->postJson('/api/v1/showcase/listings/centro-historico-de-lima-gratis/bookings', vitrinaBooking())->assertStatus(422);

    $booking = $this->postJson('/api/v1/showcase/listings/centro-historico-de-lima-gratis/bookings', vitrinaBooking(), critical())->assertOk()->json('data');
    $row = vitrinaDb()->table('platform_showcase_bookings')->where('code', $booking['code'])->first();

    expect($booking['free'])->toBeTrue()
        ->and($row->status)->toBe('confirmada')
        ->and($row->fee_basis)->toBe('cupo_gratis')
        ->and($row->traveler_email)->toBe('lucia.prado@correo.pe');

    expect($this->postJson('/api/v1/showcase/listings/centro-historico-de-lima-gratis/bookings', vitrinaBooking(['name' => 'Otra']), critical()))->toBeApiError(409, 'VT-02');
    expect($this->postJson('/api/v1/showcase/listings/centro-historico-de-lima-gratis/bookings', vitrinaBooking(['email' => 'x@correo.pe', 'time' => '23:00']), critical()))->toBeApiError(422, 'VT-02');
});

it('VT-02: respeta el cupo por salida', function () {
    $listing = vitrinaDb()->table('platform_showcase_listings')->where('code', 'SHL-001')->first();
    vitrinaDb()->table('platform_showcase_listings')->where('id', $listing->id)->update(['capacity' => 3]);

    $this->postJson('/api/v1/showcase/listings/centro-historico-de-lima-gratis/bookings', vitrinaBooking(['pax' => 2]), critical())->assertOk();
    $full = $this->postJson('/api/v1/showcase/listings/centro-historico-de-lima-gratis/bookings', vitrinaBooking(['email' => 'otro@correo.pe', 'pax' => 2]), critical());

    expect($full)->toBeApiError(409, 'VT-02')->and($full->json('details.available'))->toBe(1);
});

it('VT-03: la reserva 31 del mes de una agencia sin plan cobra por asistente y con plan no cobra', function () {
    $listing = vitrinaDb()->table('platform_showcase_listings')->where('code', 'SHL-001')->first();
    $existing = vitrinaDb()->table('platform_showcase_bookings as b')->join('platform_showcase_listings as l', 'l.id', '=', 'b.listing_id')->where('l.agency_id', $listing->agency_id)->where('b.status', '<>', 'cancelada')->whereBetween('b.service_date', ['2026-10-01', '2026-10-31'])->count();

    foreach (range(1, 30 - $existing) as $n) {
        vitrinaDb()->table('platform_showcase_bookings')->insert(['id' => (string) Str::uuid7(), 'code' => 'SHB-T'.str_pad((string) $n, 3, '0', STR_PAD_LEFT), 'listing_id' => $listing->id, 'service_date' => '2026-10-05', 'start_time' => '15:00', 'traveler_name' => "Viajero {$n}", 'traveler_email' => "v{$n}@correo.pe", 'pax' => 1, 'language' => 'es', 'fee_basis' => 'cupo_gratis', 'cancel_token' => 'tok-vitrina-'.$n]);
    }

    $thirtyFirst = $this->postJson('/api/v1/showcase/listings/centro-historico-de-lima-gratis/bookings', vitrinaBooking(['pax' => 3]), critical())->assertOk()->json('data.code');
    $row = vitrinaDb()->table('platform_showcase_bookings')->where('code', $thirtyFirst)->first();
    expect($row->fee_basis)->toBe('por_asistente')->and((string) $row->fee_amount)->toBe('6.00');

    $withPlan = $this->postJson('/api/v1/showcase/listings/'.vitrinaDb()->table('platform_showcase_listings')->where('code', 'SHL-003')->value('slug').'/bookings', vitrinaBooking(['time' => vitrinaDb()->table('platform_showcase_listings')->where('code', 'SHL-003')->value(DB::raw('start_times[1]'))]), critical())->assertOk()->json('data.code');
    $planRow = vitrinaDb()->table('platform_showcase_bookings')->where('code', $withPlan)->first();
    expect($planRow->fee_basis)->toBe('plan')->and((string) $planRow->fee_amount)->toBe('0.00');
});

it('el viajero cancela con el token de su correo y no puede cancelar dos veces', function () {
    $booking = $this->postJson('/api/v1/showcase/listings/centro-historico-de-lima-gratis/bookings', vitrinaBooking(), critical())->assertOk()->json('data');

    $this->postJson("/api/v1/showcase/bookings/{$booking['cancel_token']}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelada');
    expect($this->postJson("/api/v1/showcase/bookings/{$booking['cancel_token']}/cancel"))->toBeApiError(409, 'VT-CANCEL');
    $this->postJson('/api/v1/showcase/bookings/token-que-no-existe/cancel')->assertNotFound();
});

it('el blog público solo muestra artículos publicados con sus tours enlazados', function () {
    $posts = collect($this->getJson('/api/v1/showcase/posts')->assertOk()->json('data'));
    expect($posts->pluck('status')->unique()->all())->toBe(['publicado']);

    $post = $this->getJson('/api/v1/showcase/posts/free-tours-en-lima-guia')->assertOk()->json('data');
    expect($post['tours'])->not->toBeEmpty();
});

it('registra una agencia nueva en revisión, con su evento de embudo, y rechaza correos repetidos', function () {
    $payload = ['name' => 'Huaraz a Pie', 'city' => 'huaraz', 'email' => 'hola@huarazapie.pe', 'ruc' => '20612345999', 'license_ref' => 'DIRCETUR-ANC-77', 'wants_pass' => true];

    $created = $this->postJson('/api/v1/showcase/agencies', $payload, critical())->assertCreated()->json('data');
    $agency = vitrinaDb()->table('platform_showcase_agencies')->where('code', $created['code'])->first();

    expect($agency->status)->toBe('en_revision')
        ->and(vitrinaDb()->table('platform_funnel_events')->where('agency_id', $agency->id)->where('kind', 'registro_agencia')->exists())->toBeTrue();
    expect($this->postJson('/api/v1/showcase/agencies', $payload, critical()))->toBeApiError(409, 'VT-AGENCY-EXISTS');
});
