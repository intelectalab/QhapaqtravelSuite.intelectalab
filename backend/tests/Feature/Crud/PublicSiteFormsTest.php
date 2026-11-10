<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
    freezeBusinessToday();
});

function sitioPost(string $uri, array $body): TestResponse
{
    return test()->postJson($uri, $body, siteOf(extra: critical()));
}

function sitioCarrito(int $adults = 2, string $date = '2026-10-04'): string
{
    return (string) sitioPost('/api/v1/public/carts/current/items', ['product' => 'laguna-humantay-full-day', 'date' => $date, 'adults' => $adults])->assertCreated()->json('data.token');
}

function sitioConCarrito(string $token): mixed
{
    return test()->withCredentials()->withUnencryptedCookie('ah_cart', $token);
}

function sitioHolds(string $departureRef): Collection
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_availability_holds')->where('departure_id', departureRow($departureRef)->id)->where('reference_type', 'cart')->orderBy('created_at')->get());
}

function sitioVivos(string $departureRef): Collection
{
    return sitioHolds($departureRef)->filter(fn (object $hold): bool => $hold->status === 'hold' && Carbon::parse($hold->expires_at)->isFuture());
}

function sitioDejarLibres(string $departureRef, int $free): void
{
    withinTenant(tenantA(), fn () => DB::table('catalog_product_departures')->where('ref', $departureRef)->update(['sold' => DB::raw("capacity - {$free}")]));
}

function sitioPedido(string $token): object
{
    return (object) sitioConCarrito($token)->postJson('/api/v1/public/checkout/orders', [
        'name' => 'Valeria Quispe Mamani',
        'email' => 'valeria.quispe@sitio.pe',
        'phone' => '+51 987 654 321',
        'country' => 'Perú',
        'doc_type' => 'DNI',
        'doc_number' => '47851236',
        'billing_type' => 'Boleta',
        'terms' => true,
        'privacy' => true,
    ], siteOf(extra: critical()))->assertCreated()->json('data');
}

function sitioLead(array $overrides = []): array
{
    return [
        'name' => 'Rosa Huamán Flores',
        'email' => 'rosa.huaman@viajera.pe',
        'phone' => '+51 955 112 233',
        'country' => 'Perú',
        'destinations' => ['cusco', 'machu-picchu'],
        'start_date' => '2026-10-20',
        'end_date' => '2026-10-26',
        'adults' => 2,
        'children' => 2,
        'budget' => 2500,
        'interests' => ['cultura', 'gastronomía'],
        'preferred_contact' => 'whatsapp',
        'comments' => 'Viajamos con dos niños pequeños.',
        'consent' => true,
        ...$overrides,
    ];
}

function sitioReclamo(array $overrides = []): array
{
    return [
        'name' => 'Jorge Salas Paredes',
        'doc_type' => 'DNI',
        'doc_number' => '41523698',
        'email' => 'gabriela.rios@correo.pe',
        'phone' => '+51 944 556 677',
        'address' => 'Av. Larco 1234, Miraflores',
        'sede_id' => sitioSedeLima(),
        'good_kind' => 'servicio',
        'good_description' => 'Tour Laguna Humantay',
        'good_amount' => 320,
        'good_currency' => 'PEN',
        'type' => 'reclamo',
        'detail' => 'El transporte llegó dos horas tarde y perdimos la caminata.',
        'request' => 'Devolución parcial del servicio.',
        'declaration' => true,
        ...$overrides,
    ];
}

function sitioSedeLima(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('iam_sedes')->where('name', 'like', 'Lima%')->value('id'));
}

it('quitar una línea del carrito libera su cupo y otro cliente puede tomarlo', function () {
    sitioDejarLibres('SAL-0404', 3);
    $first = sitioCarrito(2);

    expect(sitioPost('/api/v1/public/carts/current/items', ['product' => 'laguna-humantay-full-day', 'date' => '2026-10-04', 'adults' => 2]))->toBeApiError(422, 'SIT-BR-05');

    $cart = sitioConCarrito($first)->deleteJson('/api/v1/public/carts/current/items/1', [], siteOf())->assertOk()->json('data');
    $hold = sitioHolds('SAL-0404')->first();

    expect($cart['items'])->toBe([])
        ->and($hold->status)->toBe('liberada')
        ->and($hold->released_reason)->toBe('El cliente quitó la línea del carrito')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity_id', $hold->ref)->where('action', 'liberar_hold')->exists()))->toBeTrue();

    sitioCarrito(2);
    expect(sitioVivos('SAL-0404'))->toHaveCount(1);
});

it('quitar una línea deja intactas las demás líneas del carrito', function () {
    $token = sitioCarrito(2);
    sitioConCarrito($token)->postJson('/api/v1/public/carts/current/items', ['product' => 'laguna-humantay-full-day', 'date' => '2026-10-06', 'adults' => 3], siteOf(extra: critical()))->assertCreated();

    $cart = sitioConCarrito($token)->deleteJson('/api/v1/public/carts/current/items/1', [], siteOf())->assertOk()->json('data');

    expect(collect($cart['items'])->pluck('line')->all())->toBe([2])
        ->and($cart['items'][0]['hold']['status'])->toBe('hold')
        ->and(sitioVivos('SAL-0405'))->toHaveCount(1);
});

it('quitar una línea sin carrito o una línea inexistente responde 404', function () {
    $token = sitioCarrito(2);

    expect($this->deleteJson('/api/v1/public/carts/current/items/1', [], siteOf()))->toBeApiError(404);
    expect(sitioConCarrito($token)->deleteJson('/api/v1/public/carts/current/items/9', [], siteOf()))->toBeApiError(404);
    expect(sitioVivos('SAL-0404'))->toHaveCount(1);
});

it('renovar el bloqueo vencido de una línea crea un bloqueo nuevo y marca el anterior como expirado', function () {
    $token = sitioCarrito(2);
    $old = sitioHolds('SAL-0404')->first();
    Carbon::setTestNow(now()->addHours(3));

    $expired = sitioConCarrito($token)->getJson('/api/v1/public/carts/current', siteOf())->assertOk()->json('data.items.0.hold.status');
    $cart = sitioConCarrito($token)->postJson('/api/v1/public/carts/current/items/1/hold', [], siteOf())->assertOk()->json('data');
    $holds = sitioHolds('SAL-0404');

    expect($expired)->toBe('expirada')
        ->and($cart['items'][0]['hold']['status'])->toBe('hold')
        ->and($cart['items'][0]['hold']['ref'])->not->toBe($old->ref)
        ->and($holds->firstWhere('id', $old->id)->status)->toBe('expirada')
        ->and($holds->where('status', 'hold'))->toHaveCount(1)
        ->and((int) $holds->firstWhere('status', 'hold')->quantity)->toBe(2);
});

it('no se renueva el bloqueo si otro cliente ya tomó los cupos', function () {
    sitioDejarLibres('SAL-0404', 3);
    $token = sitioCarrito(2);
    Carbon::setTestNow(now()->addHours(3));
    expect($this->postJson('/api/v1/public/carts/current/items/1/hold', [], siteOf()))->toBeApiError(404);
    sitioCarrito(3);

    expect(sitioConCarrito($token)->postJson('/api/v1/public/carts/current/items/1/hold', [], siteOf()))->toBeApiError(409, 'RT-4');
    expect(sitioVivos('SAL-0404'))->toHaveCount(1);
});

it('pagar el pedido confirma la reserva, salda las cuotas, convierte los bloqueos en venta y deja el pedido confirmado', function () {
    $sold = (int) departureRow('SAL-0404')->sold;
    $order = sitioPedido(sitioCarrito(2));
    $access = siteOf(extra: ['X-Order-Token' => $order->token]);

    $paid = $this->postJson("/api/v1/public/orders/{$order->code}/payments", [], [...$access, ...critical()])->assertOk()->json('data');
    $code = $paid['reservations'][0]['code'];
    $reservation = reservationRow($code);
    [$receivables, $payments] = withinTenant(tenantA(), fn () => [
        DB::table('fin_receivables')->where('reservation_id', $reservation->id)->get(),
        DB::table('fin_payments')->where('reservation_id', $reservation->id)->get(),
    ]);

    expect($paid['status'])->toBe('confirmado')
        ->and($reservation->status)->toBe('confirmada')
        ->and($receivables->pluck('status')->unique()->all())->toBe(['pagada'])
        ->and($payments)->toHaveCount($receivables->count())
        ->and($payments->pluck('source')->unique()->all())->toBe(['ecommerce'])
        ->and(bccomp((string) $payments->sum('amount'), (string) $receivables->sum('amount'), 2))->toBe(0)
        ->and((int) departureRow('SAL-0404')->sold)->toBe($sold + 2)
        ->and(sitioVivos('SAL-0404'))->toHaveCount(0)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity_id', $order->code)->where('action', 'pago_simulado')->exists()))->toBeTrue();
});

it('un pedido ya pagado no se cobra dos veces y sin el token del pedido no se paga', function () {
    $order = sitioPedido(sitioCarrito(2));
    $access = siteOf(extra: ['X-Order-Token' => $order->token]);

    expect($this->postJson("/api/v1/public/orders/{$order->code}/payments", [], siteOf(extra: critical())))->toBeApiError(404);
    $this->postJson("/api/v1/public/orders/{$order->code}/payments", [], [...$access, ...critical()])->assertOk();
    $sold = (int) departureRow('SAL-0404')->sold;

    expect($this->postJson("/api/v1/public/orders/{$order->code}/payments", [], [...$access, ...critical()]))->toBeApiError(409, 'ORDER_STATE');
    expect((int) departureRow('SAL-0404')->sold)->toBe($sold);
});

it('pagar exige Idempotency-Key', function () {
    $order = sitioPedido(sitioCarrito(2));

    expect($this->postJson("/api/v1/public/orders/{$order->code}/payments", [], siteOf(extra: ['X-Order-Token' => $order->token, 'Accept' => 'application/json'])))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');
});

it('la solicitud de viaje del sitio crea un lead web que aparece en Leads del back-office con su origen', function () {
    $data = sitioPost('/api/v1/public/leads', sitioLead())->assertCreated()->json('data');
    $row = rowOf('crm_leads', $data['code']);

    expect($data['duplicate'])->toBeFalse()
        ->and($row->status)->toBe('nuevo')
        ->and($row->channel_code)->toBe('web')
        ->and($row->source_code)->toBe('formulario_web')
        ->and((int) $row->pax)->toBe(4)
        ->and($row->travel_date)->toBe('2026-10-20')
        ->and(explode(', ', (string) $row->destination_label))->toEqualCanonicalizing(['Cusco', 'Machu Picchu'])
        ->and(json_decode($row->consent, true)['policy_version'])->toBe('PDP-2026.1')
        ->and(json_decode($row->web_request, true)['origin'])->toBe('a_medida');

    actingAsSeed('U02');
    $detail = $this->getJson("/api/v1/crm/leads/{$data['code']}")->assertOk()->json('data');
    $list = $this->getJson('/api/v1/crm/leads?page[size]=100')->assertOk()->json();

    expect($detail['codes']['source'])->toBe('formulario_web')
        ->and($detail['codes']['channel'])->toBe('web')
        ->and(json_encode($list))->toContain($data['code'])
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Lead')->where('entity_id', $data['code'])->where('action', 'crear_desde_sitio_web')->exists()))->toBeTrue();
});

it('una segunda solicitud con el mismo correo queda como duplicado del lead abierto', function () {
    $first = sitioPost('/api/v1/public/leads', sitioLead())->assertCreated()->json('data.code');
    $second = sitioPost('/api/v1/public/leads', sitioLead(['email' => 'ROSA.HUAMAN@viajera.pe']))->assertCreated()->json('data');
    $row = rowOf('crm_leads', $second['code']);

    expect($second['duplicate'])->toBeTrue()
        ->and($row->status)->toBe('duplicado')
        ->and($row->duplicate_of_id)->toBe(rowOf('crm_leads', $first)->id);
});

it('la solicitud de viaje valida fechas, destinos y consentimiento', function () {
    sitioPost('/api/v1/public/leads', sitioLead(['start_date' => '2026-09-30', 'destinations' => [], 'consent' => false]))
        ->assertStatus(422)->assertJsonValidationErrors(['start_date', 'destinations', 'consent']);
    sitioPost('/api/v1/public/leads', sitioLead(['start_date' => null, 'undefined_dates' => true]))->assertCreated();
    expect($this->postJson('/api/v1/public/leads', sitioLead(), critical())->status())->toBe(404);
});

it('el contacto para cotizar abre una conversación en la bandeja y crea su lead', function () {
    $data = sitioPost('/api/v1/public/contact', [
        'name' => 'Gabriela Ríos',
        'email' => 'gabriela.rios@correo.pe',
        'phone' => '+51 999 111 222',
        'reason' => 'cotizar',
        'message' => 'Quiero cotizar un viaje a Arequipa para mayo.',
        'consent' => true,
    ])->assertCreated()->json('data');

    $conversation = rowOf('collab_conversations', $data['code']);
    $message = withinTenant(tenantA(), fn () => DB::table('collab_messages')->where('conversation_id', $conversation->id)->first());

    expect($data['lead'])->not->toBeNull()
        ->and($conversation->channel)->toBe('form')
        ->and($conversation->status)->toBe('abierta')
        ->and($conversation->client_id)->toBe(idOf('crm_clients', 'CLI-0001'))
        ->and($conversation->lead_id)->toBe(rowOf('crm_leads', $data['lead'])->id)
        ->and($message->direction)->toBe('in')
        ->and($message->body)->toBe('Quiero cotizar un viaje a Arequipa para mayo.')
        ->and(json_decode(rowOf('crm_leads', $data['lead'])->web_request, true)['origin'])->toBe('contacto');

    actingAsSeed('U01');
    $this->getJson("/api/v1/inbox/conversations/{$data['code']}")->assertOk();
});

it('el contacto por una reserva tiene prioridad alta, la enlaza si es del mismo cliente y no crea lead', function () {
    $body = ['name' => 'Gabriela Ríos', 'email' => 'gabriela.rios@correo.pe', 'reason' => 'reserva', 'message' => 'Necesito cambiar el horario del recojo.', 'consent' => true];

    $own = $this->postJson('/api/v1/public/contact', [...$body, 'reservation' => 'res-2026-000344'], siteOf(extra: critical()))->assertCreated()->json('data');
    $foreign = sitioPost('/api/v1/public/contact', [...$body, 'reservation' => 'RES-2026-000348'])->assertCreated()->json('data');
    $conversation = rowOf('collab_conversations', $own['code']);

    expect($own['lead'])->toBeNull()
        ->and($conversation->priority)->toBe('alta')
        ->and($conversation->reservation_id)->toBe(reservationRow('RES-2026-000344')->id)
        ->and(rowOf('collab_conversations', $foreign['code'])->reservation_id)->toBeNull();
});

it('el contacto valida motivo, mensaje y consentimiento', function () {
    sitioPost('/api/v1/public/contact', ['name' => 'Ana', 'email' => 'no-es-correo', 'reason' => 'spam', 'message' => 'corto'])
        ->assertStatus(422)->assertJsonValidationErrors(['email', 'reason', 'message', 'consent']);
});

it('suscribirse al boletín crea el suscriptor con su consentimiento y lo reactiva si se había dado de baja', function () {
    $created = $this->postJson('/api/v1/public/newsletter', ['email' => 'Nuevo.Lector@correo.pe', 'name' => 'Nuevo Lector', 'consent' => true], siteOf(extra: critical()))->assertCreated()->json('data');
    [$subscriber, $consent] = withinTenant(tenantA(), function () {
        $subscriber = DB::table('mkt_contacts_subscribers')->where('email', 'nuevo.lector@correo.pe')->first();

        return [$subscriber, DB::table('mkt_consents')->where('subject_type', 'subscriber')->where('subject_id', $subscriber->id)->where('channel', 'email')->first()];
    });

    expect($created['status'])->toBe('creado')
        ->and($subscriber->source)->toBe('Newsletter web')
        ->and($consent->status)->toBe('otorgado')
        ->and(sitioPost('/api/v1/public/newsletter', ['email' => 'nuevo.lector@correo.pe', 'consent' => true])->assertCreated()->json('data.status'))->toBe('existente');

    withinTenant(tenantA(), fn () => DB::table('mkt_consents')->where('id', $consent->id)->update(['status' => 'revocado', 'revoked_at' => now()]));

    expect(sitioPost('/api/v1/public/newsletter', ['email' => 'nuevo.lector@correo.pe', 'consent' => true])->assertCreated()->json('data.status'))->toBe('reactivado')
        ->and(rowOf('mkt_consents', $consent->id, column: 'id')->status)->toBe('otorgado')
        ->and(withinTenant(tenantA(), fn () => DB::table('mkt_consent_events')->where('consent_id', $consent->id)->where('event', 'otorgado')->count()))->toBe(2);
});

it('el boletín exige correo válido y consentimiento', function () {
    sitioPost('/api/v1/public/newsletter', ['email' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['email', 'consent']);
});

it('la hoja de reclamación del sitio aparece en el libro de reclamaciones con su número y plazo', function () {
    $data = $this->postJson('/api/v1/public/claims', sitioReclamo(['sede_id' => sitioSedeLima()]), siteOf(extra: critical()))->assertCreated()->json('data');
    $case = withinTenant(tenantA(), fn () => DB::table('crm_cases')->where('book_number', $data['number'])->first());

    expect($data['number'])->toStartWith('LR-LIM-2026-')
        ->and($case->is_book)->toBeTrue()
        ->and($case->channel)->toBe('web')
        ->and($case->status)->toBe('abierta')
        ->and($case->type_code)->toBe('reclamo')
        ->and($case->priority)->toBe('alta')
        ->and($case->client_id)->toBe(idOf('crm_clients', 'CLI-0001'))
        ->and($case->due_date)->toBe($data['due_date'])
        ->and(withinTenant(tenantA(), fn () => DB::table('crm_case_events')->where('case_id', $case->id)->where('event', 'registro')->exists()))->toBeTrue();

    actingAsSeed('U02');
    $book = $this->getJson('/api/v1/crm/claim-book')->assertOk()->json('data.claims');
    expect(collect($book)->pluck('book_number'))->toContain($data['number']);
});

it('la hoja de reclamación valida el documento, el apoderado del menor y la declaración', function () {
    sitioPost('/api/v1/public/claims', sitioReclamo(['sede_id' => sitioSedeLima(), 'doc_number' => '123', 'minor' => true, 'declaration' => false]))
        ->assertStatus(422)->assertJsonValidationErrors(['doc_number', 'guardian_name', 'guardian_doc', 'declaration']);
    expect(sitioPost('/api/v1/public/claims', sitioReclamo(['sede_id' => '00000000-0000-0000-0000-000000000000'])))->toBeApiError(422, 'VALIDATION_ERROR');
});

it('la solicitud de demo del software aparece en la consola de la plataforma y no se duplica en 24 horas', function () {
    $body = [
        'kind' => 'demo',
        'full_name' => 'Lucía Fernández',
        'email' => 'Lucia@AgenciaSur.pe',
        'phone' => '+51 912 000 111',
        'company' => 'Agencia Sur',
        'business_type' => 'Operador turístico',
        'city' => 'Arequipa',
        'team_size' => '6-15',
        'message' => 'Queremos ver el motor de reservas.',
        'consent' => true,
    ];

    $created = $this->postJson('/api/v1/public/software/demo-requests', $body)->assertCreated()->json('data');
    $repeated = $this->postJson('/api/v1/public/software/demo-requests', $body)->assertOk()->json('data');

    expect($created['code'])->not->toBeNull()
        ->and($repeated['repeated'])->toBeTrue()
        ->and($repeated['code'])->toBe($created['code']);

    actingAsPlatform();
    $item = collect($this->getJson('/api/v1/platform/demo-requests')->assertOk()->json('data.items'))->firstWhere('code', $created['code']);

    expect($item)->not->toBeNull()
        ->and($item['email'])->toBe('lucia@agenciasur.pe')
        ->and($item['company'])->toBe('Agencia Sur')
        ->and($item['status'])->toBe('nueva');
});

it('la solicitud de demo valida los datos, el plan y descarta bots', function () {
    $this->postJson('/api/v1/public/software/demo-requests', ['kind' => 'otra', 'email' => 'x', 'consent' => false])
        ->assertStatus(422)->assertJsonValidationErrors(['kind', 'full_name', 'email', 'company', 'business_type', 'team_size', 'consent']);

    $body = ['kind' => 'trial', 'full_name' => 'Bot Bot', 'email' => 'bot@spam.pe', 'company' => 'Spam', 'business_type' => 'Agencia mayorista', 'team_size' => '1-5', 'consent' => true];
    expect($this->postJson('/api/v1/public/software/demo-requests', [...$body, 'plan' => 'NO-EXISTE']))->toBeApiError(422, 'DEMO-BR-01');
    $bot = $this->postJson('/api/v1/public/software/demo-requests', [...$body, 'website' => 'https://spam.example'])->assertCreated()->json('data');

    expect($bot['code'])->toBeNull()
        ->and(DB::connection('pgsql_platform')->table('platform_demo_requests')->where('email', 'bot@spam.pe')->exists())->toBeFalse();
});
