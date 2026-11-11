<?php

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

function paxMensajes(string $reservation, ?string $template = null): Collection
{
    return withinTenant(tenantA(), fn () => DB::table('notif_pax_messages as m')
        ->join('booking_reservations as r', 'r.id', '=', 'm.reservation_id')
        ->leftJoin('notif_pax_message_templates as t', 't.id', '=', 'm.template_id')
        ->where('r.code', $reservation)
        ->when($template, fn ($query) => $query->where('t.code', $template))
        ->get(['m.code', 'm.status', 'm.origin', 'm.channel', 'm.recipient', 'm.scheduled_at', 'm.body', 'm.lang', 'm.attempts', 't.code as template']));
}

function paxRegla(string $code, bool $enabled): void
{
    withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->where('code', $code)->update(['enabled' => $enabled]));
}

it('recalcular programa los mensajes futuros de las reservas vigentes sin duplicar', function () {
    lockScheduledJobs();
    actingAsSeed('U01');

    $this->postJson('/api/v1/notifications/pax-messages/reschedule')->assertOk();
    $first = paxMensajes('RES-2026-000350')->where('origin', 'auto')->where('status', 'programado');
    $this->postJson('/api/v1/notifications/pax-messages/reschedule')->assertOk()->assertJsonPath('data.scheduled', 0);
    $second = paxMensajes('RES-2026-000350')->where('origin', 'auto')->where('status', 'programado');

    $reminder = $first->firstWhere(fn (object $message): bool => $message->template === 'PMT-004' && $message->channel === 'email');
    $reservation = reservationRow('RES-2026-000350');
    $time = withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereNotNull('service_time')->orderBy('service_date')->orderBy('service_time')->value('service_time'));
    $expected = Carbon::parse($reservation->travel_from.' '.substr((string) ($time ?? '00:00'), 0, 5), 'America/Lima')->subHours(168);
    expect($first)->not->toBeEmpty()
        ->and($second->count())->toBe($first->count())
        ->and($reminder)->not->toBeNull()
        ->and(Carbon::parse((string) $reminder->scheduled_at)->equalTo($expected))->toBeTrue()
        ->and($reminder->recipient)->toBe(strtolower((string) withinTenant(tenantA(), fn () => DB::table('crm_clients')->where('id', $reservation->client_id)->value('email'))))
        ->and($reminder->body)->not->toContain('{{')
        ->and(paxMensajes('RES-2026-000349'))->toBeEmpty()
        ->and(paxMensajes('RES-2026-000343')->where('status', 'programado'))->toBeEmpty();
});

it('con los mensajes automáticos apagados se retiran los programados y no se programan nuevos', function () {
    lockScheduledJobs();
    actingAsSeed('U01');
    $this->postJson('/api/v1/notifications/pax-messages/reschedule')->assertOk();

    paxRegla('R-PAX-MESSAGES', false);
    $this->postJson('/api/v1/notifications/pax-messages/reschedule')->assertOk()->assertJsonPath('data.disabled', true);

    expect(paxMensajes('RES-2026-000350')->where('origin', 'auto')->where('status', 'programado'))->toBeEmpty()
        ->and(paxMensajes('RES-2026-000350')->where('origin', 'auto')->where('status', 'cancelado'))->not->toBeEmpty();
});

it('las condiciones por canal de venta y producto filtran las reservas', function () {
    lockScheduledJobs();
    actingAsSeed('U01');
    $template = $this->postJson('/api/v1/notifications/pax-templates', [
        'name' => 'Bienvenida corporativa',
        'event' => 'viaje',
        'offset_hours' => -24,
        'channels' => ['email'],
        'subject' => 'Tu viaje {{reserva}}',
        'body' => 'Hola {{pasajero}}, mañana empieza {{producto}}.',
        'lang' => 'ES',
        'sales_channels' => ['Corporativo'],
    ])->assertCreated()->json('data.code');

    $this->postJson('/api/v1/notifications/pax-messages/reschedule')->assertOk();

    expect(paxMensajes('RES-2026-000348', $template))->toHaveCount(1)
        ->and(paxMensajes('RES-2026-000350', $template))->toBeEmpty()
        ->and(collect($this->getJson('/api/v1/notifications/pax-templates')->json('data.templates'))->firstWhere('code', $template)['sales_channels'])->toBe(['Corporativo']);

    $product = withinTenant(tenantA(), fn () => DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')->where('r.code', 'RES-2026-000350')->whereNotNull('s.product_id')->value('s.product_id'));
    $this->patchJson("/api/v1/notifications/pax-templates/{$template}", ['name' => 'Bienvenida por producto', 'event' => 'viaje', 'offset_hours' => -24, 'channels' => ['email'], 'subject' => 'Tu viaje {{reserva}}', 'body' => 'Hola {{pasajero}}, mañana empieza {{producto}}.', 'lang' => 'ES', 'products' => [$product]])->assertOk();
    $this->postJson('/api/v1/notifications/pax-messages/reschedule')->assertOk();

    expect(paxMensajes('RES-2026-000350', $template)->where('status', 'programado'))->toHaveCount(1)
        ->and(paxMensajes('RES-2026-000348', $template)->where('status', 'programado'))->toBeEmpty();
});

it('el cliente extranjero recibe la variante en inglés de la plantilla', function () {
    lockScheduledJobs();
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('notif_pax_message_templates')->where('code', 'PMT-008')->update(['group_code' => 'G-FIN']));
    $english = $this->postJson('/api/v1/notifications/pax-templates', ['name' => 'Thank you', 'event' => 'fin_viaje', 'offset_hours' => 24, 'channels' => ['email'], 'subject' => 'Thank you for travelling', 'body' => 'Dear {{pasajero}}, thank you for choosing us.', 'lang' => 'EN'])->assertCreated()->json('data.code');
    withinTenant(tenantA(), fn () => DB::table('notif_pax_message_templates')->where('code', $english)->update(['group_code' => 'G-FIN']));

    $this->postJson('/api/v1/notifications/pax-messages/reschedule')->assertOk();

    expect(paxMensajes('RES-2026-000347')->where('status', 'programado')->pluck('template'))->toContain($english)->not->toContain('PMT-008')
        ->and(paxMensajes('RES-2026-000350')->where('status', 'programado')->pluck('template'))->toContain('PMT-008')->not->toContain($english);
});

it('Operaciones envía un mensaje manual y queda con su origen y usuario', function () {
    actingAsSeed('U05');

    $code = $this->postJson('/api/v1/reservations/RES-2026-000350/pax-messages', ['channel' => 'email', 'subject' => 'Cambio de punto de recojo', 'body' => 'Hola {{pasajero}}, el recojo para {{reserva}} será en la plaza.'], critical())->assertCreated()->json('data.code');

    $message = rowOf('notif_pax_messages', $code);
    expect($message->origin)->toBe('manual')
        ->and($message->status)->toBe('enviado')
        ->and($message->created_by)->toBe(seedUser('U05')->id)
        ->and($message->provider_message_id)->toStartWith('FAKE-MSG-')
        ->and($message->body)->toContain('RES-2026-000350')
        ->and((int) $message->attempts)->toBe(1);
});

it('un mensaje programado se envía ahora o se cancela, y uno fallido se reintenta', function () {
    actingAsSeed('U01');
    $later = $this->postJson('/api/v1/reservations/RES-2026-000350/pax-messages', ['channel' => 'email', 'subject' => 'Recordatorio', 'body' => 'Hola {{pasajero}}, te esperamos pronto.', 'scheduled_at' => '2026-10-20 09:00:00'], critical())->assertCreated()->json('data.code');
    $other = $this->postJson('/api/v1/reservations/RES-2026-000350/pax-messages', ['channel' => 'email', 'subject' => 'Otro aviso', 'body' => 'Hola {{pasajero}}, otro aviso importante.', 'scheduled_at' => '2026-10-21 09:00:00'], critical())->assertCreated()->json('data.code');

    expect(rowOf('notif_pax_messages', $later)->status)->toBe('programado');
    $this->postJson("/api/v1/notifications/pax-messages/{$later}/send-now", [], critical())->assertOk()->assertJsonPath('data.status', 'enviado');
    $this->postJson("/api/v1/notifications/pax-messages/{$other}/cancel", [], critical())->assertOk();

    expect(rowOf('notif_pax_messages', $other)->status)->toBe('cancelado')
        ->and($this->postJson("/api/v1/notifications/pax-messages/{$other}/send-now", [], critical()))->toBeApiError(409, 'MSG-STATE')
        ->and($this->postJson("/api/v1/notifications/pax-messages/{$later}/retry", [], critical()))->toBeApiError(409, 'MSG-STATE');

    withinTenant(tenantA(), fn () => DB::table('notif_pax_messages')->where('code', $later)->update(['status' => 'fallido', 'error' => 'Buzón lleno']));
    $this->postJson("/api/v1/notifications/pax-messages/{$later}/retry", [], critical())->assertOk()->assertJsonPath('data.status', 'enviado');

    expect((int) rowOf('notif_pax_messages', $later)->attempts)->toBe(2)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Mensaje al pasajero')->where('entity_id', $later)->pluck('action')->all()))->toContain('enviar_manual', 'enviar_ahora', 'reintentar');
});

it('el envío de prueba de una plantilla llega al correo de quien la prueba', function () {
    $admin = actingAsSeed('U01');

    $this->postJson('/api/v1/notifications/pax-templates/PMT-004/test', [], critical())->assertOk()->assertJsonPath('data.status', 'enviado');

    $message = withinTenant(tenantA(), fn () => DB::table('notif_pax_messages')->where('origin', 'prueba')->latest('created_at')->first());
    expect($message->recipient)->toBe(strtolower((string) $admin->email))
        ->and($message->reservation_id)->toBeNull()
        ->and($message->subject)->toStartWith('[Prueba]');
});

it('Ventas no envía mensajes al pasajero ni recalcula la programación', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/reservations/RES-2026-000350/pax-messages', ['channel' => 'email', 'subject' => 'Hola', 'body' => 'Mensaje de prueba para el pasajero.'], critical()))->toBeApiError(403)
        ->and($this->postJson('/api/v1/notifications/pax-messages/reschedule'))->toBeApiError(403);
});
