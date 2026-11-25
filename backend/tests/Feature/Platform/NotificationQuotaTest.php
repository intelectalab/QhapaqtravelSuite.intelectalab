<?php

use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Data\OutboundMessage;
use App\Domain\Platform\Support\EffectiveLimits;
use App\Domain\Platform\Support\NotificationThrottler;
use App\Domain\Platform\Support\UsageMeter;
use App\Jobs\SendNotificationEmail;
use App\Jobs\SendNotificationWhatsapp;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

function nqLimit(string $metric, int $headroom): void
{
    $tenant = (string) tenantA()->getKey();
    $plan = (string) DB::connection('pgsql_platform')->table('tenants')->where('id', $tenant)->value('plan_id');
    DB::connection('pgsql_platform')->table('plan_limits')->updateOrInsert(['plan_id' => $plan, 'metric' => $metric], ['value' => UsageMeter::used($tenant, $metric) + $headroom - (int) (EffectiveLimits::extras($tenant)[$metric] ?? 0), 'hard' => true]);
    expect(EffectiveLimits::limit($tenant, $plan, $metric))->toBe(UsageMeter::used($tenant, $metric) + $headroom);
}

function nqMessage(string $channel, string $event, string $address): object
{
    return withinTenant(tenantA(), fn () => app(NotificationLog::class)->record([
        'event_code' => $event,
        'channel' => $channel,
        'recipient_address' => $address,
        'subject' => 'Aviso de prueba',
        'body_rendered' => 'Cuerpo del aviso de prueba.',
        'status' => 'pendiente',
    ]));
}

function nqRow(string $id): object
{
    return withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('id', $id)->first());
}

function nqRun(object $job): void
{
    withinTenant(tenantA(), fn () => app()->call([$job->forTenant((string) tenantA()->getKey()), 'handle']));
}

it('al 100 % de correos del plan el aviso de la agencia no sale, queda en espera y dice por qué (SUB-BR-04)', function () {
    Queue::fake();
    Mail::fake();
    nqLimit('email_month', 0);
    $message = nqMessage('email', 'reserva.confirmada', 'cliente@example.com');

    nqRun(new SendNotificationEmail((string) $message->id));

    $row = nqRow((string) $message->id);
    expect($row->status)->toBe('pendiente')
        ->and($row->last_error)->toStartWith('Tu agencia ya usó los')
        ->and($row->last_error)->toContain('correos que incluye su plan este mes')
        ->and($row->last_error)->toContain(app(NotificationThrottler::class)->resumesAt()->format('d/m/Y'));
    Queue::assertPushed(SendNotificationEmail::class, fn (SendNotificationEmail $job) => $job->messageId === (string) $message->id && $job->delay !== null);
});

it('con cupo disponible el correo sale y suma al consumo', function () {
    Queue::fake();
    Mail::fake();
    nqLimit('email_month', 5);
    $message = nqMessage('email', 'reserva.confirmada', 'cliente@example.com');

    nqRun(new SendNotificationEmail((string) $message->id));

    expect(nqRow((string) $message->id)->status)->toBe('enviado');
    Queue::assertNotPushed(SendNotificationEmail::class);
});

it('los correos de seguridad de la cuenta no se frenan al llegar al límite', function () {
    Queue::fake();
    Mail::fake();
    nqLimit('email_month', 0);
    $message = nqMessage('email', 'seguridad.mfa_reset', 'admin@example.com');

    nqRun(new SendNotificationEmail((string) $message->id));

    expect(nqRow((string) $message->id)->status)->toBe('enviado')
        ->and(NotificationThrottler::exempt('usuario.invitado'))->toBeTrue()
        ->and(NotificationThrottler::exempt('reserva.confirmada'))->toBeFalse();
});

it('al 100 % de WhatsApp el canal común frena el envío con el motivo en español', function () {
    nqLimit('whatsapp_month', 0);

    $result = withinTenant(tenantA(), fn () => app(MessagingChannel::class)->send(new OutboundMessage('whatsapp', '+51987111222', null, 'Hola', 'plantilla')));

    expect($result->ok)->toBeFalse()
        ->and($result->errorClass)->toBe('cuota')
        ->and($result->payload['code'])->toBe('QUOTA_EXCEEDED')
        ->and($result->message)->toContain('mensajes de WhatsApp que incluye su plan este mes');
});

it('el WhatsApp interno en cola espera al mes siguiente cuando la agencia agotó su cupo', function () {
    Queue::fake();
    nqLimit('whatsapp_month', 0);
    $message = nqMessage('whatsapp', 'asignacion.liberada', '+51987111222');

    nqRun(new SendNotificationWhatsapp((string) $message->id));

    $row = nqRow((string) $message->id);
    expect($row->status)->toBe('pendiente')->and($row->last_error)->toContain('queda en espera hasta el');
    Queue::assertPushed(SendNotificationWhatsapp::class, fn (SendNotificationWhatsapp $job) => $job->messageId === (string) $message->id);
});

it('fuera de una agencia el freno no aplica', function () {
    expect(app(NotificationThrottler::class)->reason('email'))->toBeNull()
        ->and(app(NotificationThrottler::class)->reason('push', (string) tenantA()->getKey()))->toBeNull();
});
