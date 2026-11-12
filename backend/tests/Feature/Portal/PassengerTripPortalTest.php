<?php

use App\Jobs\SendPlainMail;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function paxTripIncident(string $type = 'Horario'): string
{
    return withinTenant(tenantA(), function () use ($type): string {
        $reservation = idOf('booking_reservations', 'RES-2026-000347');
        $code = 'INC-PX-'.Str::upper(Str::random(5));
        DB::table('ops_incidents')->insert([
            'code' => $code, 'reservation_id' => $reservation, 'type' => $type, 'severity' => 'media', 'title' => 'Cambio interno de horario',
            'public_title' => 'El recojo se adelanta 30 minutos', 'public_message' => 'Te recogemos a las 4:30 en tu hotel.', 'description' => 'Ajuste por tráfico',
            'status' => 'abierta', 'reported_by' => idOf('iam_users', 'U01'), 'assignee_id' => idOf('iam_users', 'U01'), 'sla_hours' => 24, 'sla_due_at' => now()->addDay(),
        ]);

        return $code;
    });
}

function paxLinkToken(): string
{
    $token = null;
    Queue::assertPushed(SendPlainMail::class, function (SendPlainMail $mail) use (&$token): bool {
        if (preg_match('/token=([A-Za-z0-9]{48})/', $mail->body, $match)) {
            $token = $match[1];
        }

        return true;
    });

    return (string) $token;
}

it('PPX-BR-02: el pasajero pide un enlace con el correo del titular y el código; el enlace abre su sesión una sola vez', function () {
    $email = (string) withinTenant(tenantA(), fn () => DB::table('booking_reservations as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')->where('r.code', 'RES-2026-000347')->value('c.email'));

    expect($this->postJson('/api/v1/portal/passenger/auth/link', ['email' => 'otro@correo.pe', 'code' => 'RES-2026-000347'], siteOf()))->toBeApiError(422, 'PPX-BR-02');
    expect(auditExists(['entity' => 'Portal pasajero', 'entity_id' => 'RES-2026-000347', 'action' => 'enlace_rechazado']))->toBeTrue();

    $this->postJson('/api/v1/portal/passenger/auth/link', ['email' => strtoupper($email), 'code' => 'res-2026-000347'], siteOf())->assertOk();
    $token = paxLinkToken();
    expect($token)->toHaveLength(48);

    $session = $this->postJson('/api/v1/portal/passenger/auth/verify', ['token' => $token], siteOf())->assertOk()->json('data');
    $this->postJson('/api/v1/portal/passenger/auth/verify', ['token' => $token], siteOf())->assertStatus(422);

    $trip = $this->getJson('/api/v1/portal/passenger/trip?trip=RES-2026-000347', ['Authorization' => "Bearer {$session['token']}"])->assertOk()->json('data');
    expect($trip['code'])->toBe('RES-2026-000347')->and($trip['days_total'])->toBeGreaterThan(0);
});

it('PPX-BR-03 y 04: las alertas son incidencias de transporte u horario con texto público; confirmar la lectura deja bitácora, aviso al responsable y es idempotente', function () {
    actingAsSeed('U15');
    $alert = paxTripIncident();
    $hidden = paxTripIncident('Proveedor');

    $alerts = $this->getJson('/api/v1/portal/passenger/alerts')->assertOk()->json('data.alerts');
    $mine = collect($alerts)->firstWhere('code', $alert);
    expect($mine['title'])->toBe('El recojo se adelanta 30 minutos')->and($mine['acked'])->toBeFalse()
        ->and(collect($alerts)->pluck('code'))->not->toContain($hidden);

    $first = $this->postJson("/api/v1/portal/passenger/alerts/{$alert}/ack", [])->assertOk()->json('data');
    $second = $this->postJson("/api/v1/portal/passenger/alerts/{$alert}/ack", [])->assertOk()->json('data');
    $incident = idOf('ops_incidents', $alert);

    expect($second['acknowledged_at'])->toBe($first['acknowledged_at'])
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_incident_pax_acks')->where('incident_id', $incident)->count()))->toBe(1)
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_incident_logs')->where('incident_id', $incident)->where('kind', 'alerta')->exists()))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'incidencia_acuse_pasajero')->where('source_id', $incident)->exists()))->toBeTrue()
        ->and(collect($this->getJson('/api/v1/portal/passenger/alerts')->json('data.alerts'))->firstWhere('code', $alert)['acked'])->toBeTrue();

    expect($this->postJson("/api/v1/portal/passenger/alerts/{$hidden}/ack", []))->toBeApiError(404);
});

it('el pasajero ve su viaje: itinerario con asignaciones, secciones, vouchers con apertura auditada, documentos y contactos', function () {
    actingAsSeed('U15');

    $itinerary = $this->getJson('/api/v1/portal/passenger/itinerary')->assertOk()->json('data');
    $services = collect($itinerary['days'])->flatMap(fn (array $day) => $day['services']);
    expect($itinerary['code'])->toBe('RES-2026-000347')->and($services)->not->toBeEmpty()->and($services->first())->toHaveKeys(['state', 'guide', 'driver', 'vehicle']);

    foreach (['hotels' => ['alojamiento'], 'transport' => ['traslado', 'tren_entrada'], 'activities' => ['tour', 'libre']] as $section => $kinds) {
        $items = $this->getJson("/api/v1/portal/passenger/{$section}")->assertOk()->json('data.items');
        expect(collect($items)->pluck('kind')->diff($kinds))->toBeEmpty();
    }

    $this->getJson('/api/v1/portal/passenger/hotels')->assertOk();
    $this->getJson('/api/v1/portal/passenger/transport')->assertOk();
    $this->getJson('/api/v1/portal/passenger/activities')->assertOk();
    $vouchers = $this->getJson('/api/v1/portal/passenger/vouchers')->assertOk()->json('data.items');
    if ($vouchers !== []) {
        $code = $vouchers[0]['code'];
        $this->getJson("/api/v1/portal/passenger/vouchers/{$code}")->assertOk()->assertJsonPath('data.code', $code);
        expect(auditExists(['entity' => 'Voucher', 'entity_id' => $code, 'action' => 'abrir_portal_pasajero']) || withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Voucher', 'entity_id' => $code, 'action' => 'abrir_portal_pasajero'])->exists()))->toBeTrue();
    }
    expect($this->getJson('/api/v1/portal/passenger/vouchers/VOU-NO-EXISTE'))->toBeApiError(404);

    $documents = $this->getJson('/api/v1/portal/passenger/documents')->assertOk()->json('data');
    expect(collect($documents['items'])->pluck('kind'))->toContain('itinerary')->and($documents['invoices'])->toBe([]);

    $contacts = $this->getJson('/api/v1/portal/passenger/contacts')->assertOk()->json('data');
    expect($contacts['emergency'])->toHaveKey('phone');

    $trip = $this->getJson('/api/v1/portal/passenger/trip')->assertOk()->json('data');
    expect($trip)->toHaveKeys(['day', 'days_total', 'today_services', 'next', 'alerts']);
});

it('PPX-BR-06: el mensaje a operaciones crea un ticket asignado al coordinador; tema salud va con prioridad alta; se marcan leídos los mensajes de la agencia', function () {
    actingAsSeed('U15');
    $reservation = idOf('booking_reservations', 'RES-2026-000347');
    $agency = (string) Str::uuid7();
    withinTenant(tenantA(), fn () => DB::table('channel_trip_messages')->insert(['id' => $agency, 'reservation_id' => $reservation, 'sender_type' => 'agency', 'sender_user_id' => idOf('iam_users', 'U01'), 'body' => 'Mañana el recojo es a las 5:00.']));

    $this->postJson('/api/v1/portal/passenger/messages', ['body' => ''])->assertStatus(422)->assertJsonValidationErrors(['body']);
    $sent = $this->postJson('/api/v1/portal/passenger/messages', ['body' => 'Tengo dolor de cabeza por la altura.', 'topic' => 'salud'])->assertCreated()->json('data');
    $ticket = withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('code', $sent['ticket'])->first(['priority', 'reservation_id', 'assignee_id']));
    $coordinator = withinTenant(tenantA(), fn () => DB::table('ops_orders')->where('reservation_id', $reservation)->where('status', '<>', 'cancelada')->value('coordinator_id'));

    expect($sent['priority'])->toBe('alta')->and($ticket->priority)->toBe('alta')->and($ticket->reservation_id)->toBe($reservation);
    if ($coordinator) {
        expect($ticket->assignee_id)->toBe($coordinator);
    }

    $messages = $this->getJson('/api/v1/portal/passenger/messages')->assertOk()->json('data');
    expect($messages['unread'])->toBeGreaterThanOrEqual(1)->and(collect($messages['items'])->pluck('body'))->toContain('Tengo dolor de cabeza por la altura.');

    $this->postJson("/api/v1/portal/passenger/messages/{$agency}/read", [])->assertOk()->assertJsonPath('data.updated', 1);
    $this->postJson('/api/v1/portal/passenger/messages/read-all', [])->assertOk();
    expect($this->getJson('/api/v1/portal/passenger/messages')->json('data.unread'))->toBe(0);
});

it('R-COMPANIONS: el cliente completa acompañantes y recojo antes del viaje; la edad debe calzar con el tipo y se respeta la versión', function () {
    actingAsSeed('U14');
    $code = (string) withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('client_id', DB::table('iam_users')->where('code', 'U14')->value('client_id'))->where('travel_from', '>', BUSINESS_TODAY)->whereNotIn('status', ['cancelada', 'borrador'])->orderBy('travel_from')->value('code'));
    $current = $this->getJson("/api/v1/portal/passenger/companions?trip={$code}")->assertOk()->json('data');
    $adult = collect($current['passengers'])->firstWhere('type', 'ADT');

    expect($current['editable'])->toBeTrue();

    $body = ['trip' => $code, 'passengers' => [['seq' => $adult['seq'], 'first_name' => 'Lucía', 'last_name' => 'Ramos Paz', 'birth_date' => '2020-01-10', 'doc_type' => 'DNI', 'doc_number' => '70112233', 'nationality' => 'Perú']]];
    $this->putJson('/api/v1/portal/passenger/companions', $body, ['If-Match' => (string) $current['lock_version']])->assertStatus(422)->assertJsonValidationErrors(['passengers.0.birth_date']);
    expect($this->putJson('/api/v1/portal/passenger/companions', $body, ['If-Match' => '999']))->toBeApiError(409);

    $body['passengers'][0]['birth_date'] = '1990-05-04';
    $updated = $this->putJson('/api/v1/portal/passenger/companions', [...$body, 'pickup' => ['address' => 'Hotel Tambo Real, Cusco']], ['If-Match' => (string) $current['lock_version']])->assertOk()->json('data');

    expect(collect($updated['passengers'])->firstWhere('seq', $adult['seq'])['name'])->toBe('Lucía Ramos Paz')
        ->and(collect($updated['passengers'])->firstWhere('seq', $adult['seq'])['pending'])->toBeFalse();
});

it('el pasajero abre un mensaje recibido y queda leído; marcar todos cuenta para la tasa de lectura', function () {
    actingAsSeed('U15');
    $reservation = idOf('booking_reservations', 'RES-2026-000347');
    withinTenant(tenantA(), function () use ($reservation): void {
        foreach (['PXM-T1', 'PXM-T2'] as $code) {
            DB::table('notif_pax_messages')->insert(['code' => $code, 'reservation_id' => $reservation, 'channel' => 'email', 'recipient' => 'pasajero@correo.pe', 'subject' => "Aviso {$code}", 'body' => 'Recuerda llevar tu pasaporte.', 'status' => 'enviado', 'sent_at' => now()]);
        }
    });

    $notice = fn (string $code) => collect($this->getJson('/api/v1/portal/passenger/alerts')->assertOk()->json('data.notices'))->firstWhere('code', $code);
    expect($notice('PXM-T1')['read'])->toBeFalse();

    $this->postJson('/api/v1/portal/passenger/messages/PXM-T1/read', [])->assertOk()->assertJsonPath('data.updated', 1);
    expect($notice('PXM-T1')['read'])->toBeTrue()->and($notice('PXM-T2')['read'])->toBeFalse();
    expect($this->postJson('/api/v1/portal/passenger/messages/PXM-NOEXISTE/read', []))->toBeApiError(404);

    $this->postJson('/api/v1/portal/passenger/messages/read-all', [])->assertOk();
    $status = withinTenant(tenantA(), fn () => DB::table('notif_pax_messages')->whereIn('code', ['PXM-T1', 'PXM-T2'])->pluck('status')->unique()->values()->all());

    expect($notice('PXM-T2')['read'])->toBeTrue()->and($status)->toBe(['leido']);
});
