<?php

use App\Domain\Booking\Rules\RuleResolver;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function g7Rule(string $code, bool $on, ?array $params = null): void
{
    withinTenant(tenantA(), function () use ($code, $on, $params) {
        DB::table('sys_booking_rules')->where('code', $code)->update(['enabled' => $on, ...($params !== null ? ['params' => json_encode($params)] : [])]);
        RuleResolver::invalidate((string) tenantA()->getKey());
    });
}

function g7ControlledCart(): array
{
    $products = withinTenant(tenantA(), fn () => DB::table('catalog_products as p')
        ->join('catalog_product_channels as c', fn ($join) => $join->on('c.product_id', '=', 'p.id')->where('c.channel', 'ecommerce')->where('c.is_published', true))
        ->whereNull('p.deleted_at')->whereNotNull('p.slug')
        ->where(fn ($query) => $query->whereExists(fn ($q) => $q->from('catalog_product_departures as d')->whereColumn('d.product_id', 'p.id'))
            ->orWhereExists(fn ($q) => $q->from('catalog_availability_ranges as r')->whereColumn('r.product_id', 'p.id')->whereNull('r.deleted_at')))
        ->orderBy('p.code')->pluck('p.slug'));

    foreach ($products as $slug) {
        foreach (['2026-11', '2026-12', '2027-01'] as $month) {
            $calendar = test()->getJson("/api/v1/public/products/{$slug}/calendar?mes={$month}&viajeros=2", siteOf());
            if ($calendar->status() !== 200) {
                continue 2;
            }
            foreach ($calendar->json('data.days') as $day) {
                if ($day['sellable']) {
                    return test()->postJson('/api/v1/public/carts/current/items', ['product' => $slug, 'date' => $day['date'], 'adults' => 2], siteOf(extra: critical()))->assertCreated()->json('data');
                }
            }
        }
    }

    throw new RuntimeException('Sin producto con cupos controlados');
}

it('RV-02: la respuesta a una reseña externa pide al menos 20 caracteres y el resumen trae el estado de las invitaciones', function () {
    actingAsSeed('U01');
    $overview = $this->getJson('/api/v1/channels/external-reviews')->assertOk()->json('data');
    expect($overview['kpis'])->toHaveKeys(['invites_active', 'invites_sent']);

    $id = $overview['items'][0]['id'] ?? null;
    if ($id === null) {
        expect(true)->toBeTrue();

        return;
    }

    $this->putJson("/api/v1/channels/external-reviews/{$id}/reply", ['text' => 'Gracias por venir.'])->assertStatus(422)->assertJsonValidationErrors(['text']);
});

it('los ajustes de reseñas propias traen la vista previa de la invitación y los datos para exportar el feed', function () {
    actingAsSeed('U01');
    $settings = $this->getJson('/api/v1/settings/own-reviews')->assertOk()->json('data');

    expect($settings['preview'])->toHaveKeys(['nombre', 'tour', 'agencia', 'enlace', 'reservation'])
        ->and($settings['preview']['agencia'])->not->toBe('');

    if ($settings['export'] !== null) {
        expect($settings['export'])->toHaveKeys(['public_key', 'key_header', 'cdn', 'host', 'feed_url', 'product', 'json_ld'])
            ->and($settings['export']['feed_url'])->toContain('/api/v1/public/reviews');
    }
});

it('B2B: cada agencia lista sus usuarios del portal', function () {
    actingAsSeed('U01');
    $agencies = $this->getJson('/api/v1/channels/b2b')->assertOk()->json('data.items');

    expect($agencies)->not->toBeEmpty()->and($agencies[0])->toHaveKey('portal_users')
        ->and(collect($agencies)->pluck('portal_users')->flatten(1)->pluck('code'))->toContain('U13');
});

it('E-commerce: la tabla de productos trae precio web, promoción vigente, slug y el enlace a la tienda', function () {
    actingAsSeed('U01');
    $overview = $this->getJson('/api/v1/channels/ecommerce')->assertOk()->json('data');

    expect($overview['site_url'])->toBeString()->and($overview['products'])->not->toBeEmpty()
        ->and($overview['products'][0])->toHaveKeys(['slug', 'web_price', 'on_site', 'promotion'])
        ->and(collect($overview['products'])->where('on_site', true)->pluck('web_price')->filter()->first())->toHaveKeys(['amount', 'currency']);
});

it('vista previa del portal del pasajero: token de solo lectura auditado que no permite escribir', function () {
    actingAsSeed('U01');
    expect($this->postJson('/api/v1/channels/passenger-portal/preview', ['reservation' => 'RES-NO-EXISTE']))->toBeApiError(404);

    $options = $this->getJson('/api/v1/channels/passenger-portal')->assertOk()->json('data.previewable');
    expect(collect($options)->pluck('code'))->toContain('RES-2026-000347');

    $preview = $this->postJson('/api/v1/channels/passenger-portal/preview', ['reservation' => 'RES-2026-000347'])->assertOk()->json('data');
    expect($preview['read_only'])->toBeTrue()->and($preview['user']['code'])->toBe('U15')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Reserva', 'entity_id' => 'RES-2026-000347', 'action' => 'previsualizar_portal_pasajero'])->exists()))->toBeTrue();

    app('auth')->forgetGuards();
    $headers = ['Authorization' => "Bearer {$preview['token']}"];
    $this->getJson('/api/v1/portal/client/session', $headers)->assertOk()->assertJsonPath('data.role', 'passenger');
    expect($this->postJson('/api/v1/portal/passenger/feedback', ['type' => 'comentario', 'text' => 'Todo muy bien organizado.'], [...$headers, ...critical()]))->toBeApiError(403, 'PREVIEW_READ_ONLY');
});

it('la sesión del pasajero trae el menú según las reglas, los contadores y la alerta de viaje', function () {
    actingAsSeed('U15');
    $menu = $this->getJson('/api/v1/portal/client/session')->assertOk()->json('data.menu');

    expect($menu['trip'])->toBe('RES-2026-000347')
        ->and($menu['sections'])->toHaveKeys(['messages', 'feedback', 'companions', 'reviews'])
        ->and($menu['counts'])->toHaveKeys(['messages', 'companions', 'reviews', 'alerts']);

    g7Rule('R-PAX-FEEDBACK', false);
    expect($this->getJson('/api/v1/portal/client/session')->json('data.menu.sections.feedback'))->toBeFalse();
    g7Rule('R-PAX-FEEDBACK', true);

    actingAsSeed('U14');
    expect($this->getJson('/api/v1/portal/client/session')->assertOk()->json('data.menu'))->toBeNull();
});

it('portal cliente: el mensaje guarda la prioridad elegida y salud siempre va con prioridad alta', function () {
    actingAsSeed('U14');
    $low = $this->postJson('/api/v1/portal/client/tickets', ['body' => 'Consulta sin apuro sobre facturas.', 'topic' => 'pagos', 'priority' => 'baja'])->assertOk()->json('data.code');
    $health = $this->postJson('/api/v1/portal/client/tickets', ['body' => 'Tengo una consulta médica.', 'topic' => 'salud', 'priority' => 'baja'])->assertOk()->json('data.code');

    expect(rowOf('collab_conversations', $low)->priority)->toBe('baja')
        ->and(rowOf('collab_conversations', $health)->priority)->toBe('alta');
    $this->postJson('/api/v1/portal/client/tickets', ['body' => 'Hola', 'priority' => 'urgente'])->assertStatus(422)->assertJsonValidationErrors(['priority']);
});

it('viajeros: el punto de recojo se elige de la lista del producto u «Otra dirección» con dirección', function () {
    actingAsSeed('U14');
    $code = (string) withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('client_id', DB::table('iam_users')->where('code', 'U14')->value('client_id'))->where('travel_from', '>', BUSINESS_TODAY)->whereNotIn('status', ['cancelada', 'borrador'])->orderBy('travel_from')->value('code'));
    $current = $this->getJson("/api/v1/portal/passenger/companions?trip={$code}")->assertOk()->json('data');
    if ($current['pickup'] === null) {
        expect(true)->toBeTrue();

        return;
    }

    expect($current['pickup'])->toHaveKey('points');
    $this->putJson('/api/v1/portal/passenger/companions', ['trip' => $code, 'pickup' => ['point' => 'Un punto que no existe']], ['If-Match' => (string) $current['lock_version']])->assertStatus(422)->assertJsonValidationErrors(['pickup.point']);
    $this->putJson('/api/v1/portal/passenger/companions', ['trip' => $code, 'pickup' => ['point' => 'Otra dirección']], ['If-Match' => (string) $current['lock_version']])->assertStatus(422)->assertJsonValidationErrors(['pickup.address']);

    $saved = $this->putJson('/api/v1/portal/passenger/companions', ['trip' => $code, 'pickup' => ['point' => 'Otra dirección', 'address' => 'Hotel Tambo Real, Cusco']], ['If-Match' => (string) $current['lock_version']])->assertOk()->json('data');
    expect($saved['pickup']['point'])->toBe('Otra dirección')->and($saved['pickup']['address'])->toBe('Hotel Tambo Real, Cusco');
});

it('R-HOLD: los minutos del bloqueo salen de la regla y, apagada, el carrito no bloquea cupos', function () {
    g7Rule('R-HOLD', true, ['minutes' => 12]);
    $cart = g7ControlledCart();
    $hold = $cart['cart']['items'][0]['hold'];

    expect($cart['cart']['hold_minutes'])->toBe(12)->and($hold)->not->toBeNull()
        ->and(abs(now()->addMinutes(12)->diffInSeconds(Carbon::parse($hold['expires_at']), false)))->toBeLessThan(120);

    g7Rule('R-HOLD', false);
    expect(g7ControlledCart()['cart']['items'][0]['hold'])->toBeNull();
    g7Rule('R-HOLD', true, ['minutes' => 30]);
});

it('integración web: modo catálogo por categoría, webhooks relevantes y traspasos al checkout', function () {
    actingAsSeed('U01');
    $overview = $this->getJson('/api/v1/channels/widget')->assertOk()->json('data');
    expect($overview)->toHaveKeys(['categories', 'webhooks', 'handoffs'])
        ->and(collect($overview['webhooks'])->pluck('event'))->toContain('reservation.confirmed');

    $base = ['method' => 'webcomponent', 'lang' => 'es', 'currency' => 'PEN', 'theme' => '#0A3A73', 'radius' => 10, 'reviews' => false];
    $this->putJson('/api/v1/channels/widget', [...$base, 'mode' => 'catalogo', 'category' => 'Categoría inventada'])->assertStatus(422);

    $category = $overview['categories'][0] ?? null;
    $this->putJson('/api/v1/channels/widget', [...$base, 'mode' => 'catalogo', 'category' => $category])->assertOk();
    $defaults = $this->getJson('/api/v1/channels/widget')->json('data.defaults');
    expect($defaults['mode'])->toBe('catalogo')->and($defaults['category'])->toBe($category);

    $this->putJson('/api/v1/channels/widget', [...$base, 'mode' => 'producto'])->assertStatus(422)->assertJsonValidationErrors(['product']);
});

it('chat del sitio: con el token se leen las respuestas de la agencia, nunca las notas internas', function () {
    $chat = $this->postJson('/api/v1/public/chat/sessions', ['name' => 'Ana Torres', 'email' => 'ana.g7@viajes.pe', 'message' => '¿Tienen salidas en diciembre?', 'consent' => true], siteOf())->assertCreated()->json('data');
    $id = rowOf('collab_conversations', $chat['session'])->id;
    withinTenant(tenantA(), fn () => DB::table('collab_messages')->insert([
        ['conversation_id' => $id, 'channel' => 'webchat', 'direction' => 'out', 'body' => 'Sí, salimos todos los sábados.', 'sent_at' => now()->addMinute()],
        ['conversation_id' => $id, 'channel' => 'webchat', 'direction' => 'internal', 'body' => 'Nota interna G7', 'sent_at' => now()->addMinutes(2)],
    ]));

    $messages = $this->getJson("/api/v1/public/chat/sessions/{$chat['session']}", siteOf(extra: ['X-Chat-Token' => $chat['token']]))->assertOk()->json('data.messages');
    expect(collect($messages)->pluck('body'))->toContain('Sí, salimos todos los sábados.')->not->toContain('Nota interna G7')
        ->and(collect($messages)->last()['from'])->toBe('asesor');
    $this->getJson("/api/v1/public/chat/sessions/{$chat['session']}", siteOf(extra: ['X-Chat-Token' => 'falso']))->assertNotFound();
});

it('el perfil del sitio trae el teléfono de emergencias y los medios de pago para el pie', function () {
    $agency = $this->getJson('/api/v1/public/site', siteOf())->assertOk()->json('data.agency');

    expect($agency)->toHaveKeys(['emergency_phone', 'payment_methods'])
        ->and($agency['payment_methods'])->toContain('tarjeta', 'transferencia', 'yape', 'plin');
});
