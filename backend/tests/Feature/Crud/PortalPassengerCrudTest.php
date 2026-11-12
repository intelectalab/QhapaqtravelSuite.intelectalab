<?php

use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function paxService(string $status = 'completado'): string
{
    return withinTenant(tenantA(), function () use ($status): string {
        $reservation = idOf('booking_reservations', 'RES-2026-000347');
        $service = DB::table('booking_reservation_services')->where('reservation_id', $reservation)->orderBy('service_date')->first(['id', 'code']);
        DB::table('booking_reservation_services')->where('id', $service->id)->update(['product_id' => idOf('catalog_products', 'CUS-HUM-FD'), 'status' => $status]);

        return $service->code;
    });
}

it('CAN-V21-03: el pasajero envía un comentario sobre un servicio de su viaje y lo ve en su historial', function () {
    actingAsSeed('U15');
    $service = paxService();

    $data = $this->postJson('/api/v1/portal/passenger/feedback', ['type' => 'felicitacion', 'rating' => 5, 'service' => $service, 'text' => 'El guía fue excelente y muy puntual.'], critical())->assertCreated()->json('data');
    $row = withinTenant(tenantA(), fn () => DB::table('channel_pax_feedback')->where('code', $data['code'])->first());
    $overview = $this->getJson('/api/v1/portal/passenger/feedback')->assertOk()->json('data');

    expect($data['conversation'])->toBeNull()
        ->and($row->status)->toBe('nuevo')
        ->and($row->channel)->toBe('Portal pasajero')
        ->and((int) $row->rating)->toBe(5)
        ->and($overview['trip']['code'])->toBe('RES-2026-000347')
        ->and(collect($overview['history'])->pluck('code'))->toContain($data['code'])
        ->and($overview['services'])->not->toBeEmpty();

    $this->postJson('/api/v1/portal/passenger/feedback', ['type' => 'otro', 'rating' => 9, 'text' => 'ok'], critical())->assertStatus(422)->assertJsonValidationErrors(['type', 'rating', 'text']);
    expect($this->postJson('/api/v1/portal/passenger/feedback', ['type' => 'comentario', 'service' => 'RS-9999', 'text' => 'Servicio que no es mío'], critical()))->toBeApiError(422, 'CAN-V21-03');
});

it('CAN-V21-04: un reclamo o incidencia abre una conversación en la bandeja y sugiere el libro de reclamaciones', function () {
    actingAsSeed('U15');

    $claim = $this->postJson('/api/v1/portal/passenger/feedback', ['type' => 'reclamo', 'text' => 'El traslado llegó una hora tarde al hotel.'], critical())->assertCreated()->json('data');
    $row = withinTenant(tenantA(), fn () => DB::table('channel_pax_feedback')->where('code', $claim['code'])->first());

    expect($claim['conversation'])->toStartWith('CNV-')
        ->and($claim['claims_book'])->toBeTrue()
        ->and($row->status)->toBe('nuevo')
        ->and($row->incident_id)->toBeNull()
        ->and($row->conversation_id)->not->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('code', $claim['conversation'])->value('channel')))->toBe('portal');
});

it('RVW-02 a RVW-05: el pasajero califica un servicio terminado una sola vez y sin consentimiento queda oculta', function () {
    actingAsSeed('U15');
    paxService();

    $overview = $this->getJson('/api/v1/portal/passenger/reviews')->assertOk()->json('data');
    $item = collect($overview['items'])->firstWhere('product.code', 'CUS-HUM-FD');
    expect($item['eligible'])->toBeTrue()->and($overview['subratings'])->not->toBeEmpty();

    $data = $this->postJson('/api/v1/portal/passenger/reviews', ['product' => 'CUS-HUM-FD', 'stars' => 5, 'subratings' => ['guia' => 5, 'inventado' => 3], 'title' => 'Laguna inolvidable', 'body' => 'Un paisaje increíble y un guía que cuidó de todo el grupo en la subida.', 'consent_publish' => false], critical())->assertCreated()->json('data');
    $review = withinTenant(tenantA(), fn () => DB::table('crm_own_reviews')->where('code', $data['code'])->first());

    expect($data['status'])->toBe('oculta')
        ->and($review->source)->toBe('portal')
        ->and((bool) $review->verified)->toBeTrue()
        ->and(json_decode((string) $review->subratings, true))->toBe(['guia' => 5])
        ->and($this->postJson('/api/v1/portal/passenger/reviews', ['product' => 'CUS-HUM-FD', 'stars' => 4, 'title' => 'Otra vez', 'body' => 'Quiero calificar de nuevo el mismo servicio del viaje.'], critical()))->toBeApiError(422, 'RVW-02');
});

it('RVW-06: una reseña con datos personales queda pendiente con el motivo y una limpia con consentimiento se modera', function () {
    actingAsSeed('U15');
    paxService();

    $data = $this->postJson('/api/v1/portal/passenger/reviews', ['product' => 'CUS-HUM-FD', 'stars' => 5, 'title' => 'Muy bueno', 'body' => 'Escríbanme a viajero@correo.com para recomendarles más rutas.', 'consent_publish' => true], critical())->assertCreated()->json('data');
    $review = withinTenant(tenantA(), fn () => DB::table('crm_own_reviews')->where('code', $data['code'])->first());

    expect($data['status'])->toBe('pendiente')->and($review->moderation_reason)->toContain('datos personales');
});

it('la reseña del pasajero guarda hasta 4 fotos y rechaza archivos que no son imagen', function () {
    Storage::fake(config('filesystems.default'));
    actingAsSeed('U15');
    paxService();
    $base = ['product' => 'CUS-HUM-FD', 'stars' => 5, 'title' => 'Con fotos', 'body' => 'La laguna estaba turquesa y el grupo llegó completo a la cima.', 'consent_publish' => '1'];

    expect($this->post('/api/v1/portal/passenger/reviews', [...$base, 'photos' => [UploadedFile::fake()->create('nota.pdf', 20, 'application/pdf')]], [...critical(), 'Accept' => 'application/json']))->toBeApiError(422);

    $data = $this->post('/api/v1/portal/passenger/reviews', [...$base, 'photos' => [UploadedFile::fake()->image('laguna.jpg'), UploadedFile::fake()->image('grupo.png')]], [...critical(), 'Accept' => 'application/json'])->assertCreated()->json('data');
    $photos = json_decode((string) withinTenant(tenantA(), fn () => DB::table('crm_own_reviews')->where('code', $data['code'])->value('photos')), true);

    expect($photos)->toHaveCount(2);
    foreach ($photos as $path) {
        Storage::disk(config('filesystems.default'))->assertExists($path);
    }
});

it('RVW-02: no se califica un servicio que aún no termina', function () {
    actingAsSeed('U15');
    paxService('confirmado');
    withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('reservation_id', idOf('booking_reservations', 'RES-2026-000347'))->update(['service_date' => now()->addDays(10)->toDateString()]));

    $item = collect($this->getJson('/api/v1/portal/passenger/reviews')->assertOk()->json('data.items'))->firstWhere('product.code', 'CUS-HUM-FD');

    expect($item['eligible'])->toBeFalse()
        ->and($this->postJson('/api/v1/portal/passenger/reviews', ['product' => 'CUS-HUM-FD', 'stars' => 5, 'title' => 'Antes de tiempo', 'body' => 'Todavía no hice el tour pero quiero calificarlo igual.'], critical()))->toBeApiError(422, 'RVW-02');
});

it('el personal de la agencia no usa las rutas del pasajero', function () {
    actingAsSeed('U01');

    expect($this->getJson('/api/v1/portal/passenger/feedback'))->toBeApiError(403);
});
