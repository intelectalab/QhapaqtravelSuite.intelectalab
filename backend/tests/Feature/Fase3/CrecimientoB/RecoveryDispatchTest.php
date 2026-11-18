<?php

use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Fake\FakeMessagingChannel;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Site\Actions\NewsletterLifecycle;
use App\Jobs\ScheduleRecoveryAttempts;
use App\Jobs\SendAutomationMessages;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

function recoveryFakeChannel(): FakeMessagingChannel
{
    $fake = new FakeMessagingChannel;
    app()->instance(MessagingChannel::class, $fake);

    return $fake;
}

function recoveryWaitingQuote(string $code, int $hoursAgo = 72): object
{
    return withinTenant(tenantA(), function () use ($code, $hoursAgo): object {
        $quote = DB::table('quote_quotes')->where('code', $code)->first(['id', 'client_id']);
        DB::table('mkt_recovery_flows')->update(['active' => false]);
        DB::table('quote_quotes')->where('id', $quote->id)->update(['status' => 'enviada', 'viewed_at' => null, 'valid_until' => now()->addDays(20)->toDateString(), 'reservation_id' => null]);
        DB::table('quote_access_tokens')->where('quote_id', $quote->id)->delete();
        DB::table('quote_access_tokens')->insert(['id' => (string) Str::uuid7(), 'quote_id' => $quote->id, 'token_hash' => hash('sha256', Str::random(20)), 'expires_at' => now()->addDays(20)->toDateString(), 'created_at' => now()->subHours($hoursAgo)]);

        return $quote;
    });
}

function recoveryQuoteFlow(object $test, int $delayMinutes = 1440, int $maxAttempts = 2): string
{
    actingAsSeed('U01');

    return $test->postJson('/api/v1/marketing/recovery-flows', ['name' => 'Cotización sin respuesta por correo', 'trigger_kind' => 'quote', 'delay_minutes' => $delayMinutes, 'channel' => 'email', 'template_ref' => 'TPL-01', 'max_attempts' => $maxAttempts, 'active' => true])
        ->assertCreated()->json('data.code');
}

function recoveryAttempts(string $quoteId, string $flow)
{
    return withinTenant(tenantA(), fn () => DB::table('mkt_recovery_attempts as a')->join('mkt_recovery_flows as f', 'f.id', '=', 'a.flow_id')->where('f.code', $flow)->where('a.quote_id', $quoteId)->orderBy('a.attempt_no')->get(['a.*']));
}

function recoverySentTo(FakeMessagingChannel $fake, string $quoteId): array
{
    $email = withinTenant(tenantA(), fn () => DB::table('quote_quotes as q')->join('crm_clients as c', 'c.id', '=', 'q.client_id')->where('q.id', $quoteId)->value('c.email'));

    return array_values(array_filter($fake->sent, fn ($message) => $message->to === $email));
}

function recoveryRun(): string
{
    dispatch_sync((new ScheduleRecoveryAttempts)->forTenant((string) tenantA()->getKey()));

    return (string) DB::connection('pgsql_audit')->table('sys_job_runs')->where('tenant_id', tenantA()->getKey())->where('job_class', ScheduleRecoveryAttempts::class)->orderByDesc('started_at')->value('result');
}

it('JOB-34 programa y envía el intento para la cotización sin respuesta, con el enlace de la propuesta', function () {
    $fake = recoveryFakeChannel();
    $quote = recoveryWaitingQuote('COT-2026-00185');
    $flow = recoveryQuoteFlow($this);

    expect(recoveryRun())->toContain('intento')->toContain('enviado');

    $attempts = recoveryAttempts($quote->id, $flow);
    $sent = recoverySentTo($fake, $quote->id);
    expect($attempts)->toHaveCount(1)
        ->and($attempts[0]->status)->toBe('enviado')
        ->and($attempts[0]->sent_at)->not->toBeNull()
        ->and($sent)->toHaveCount(1)
        ->and($sent[0]->channel)->toBe('email')
        ->and($sent[0]->body)->toContain('/c/')
        ->and($sent[0]->body)->toContain('boletin/baja?token=kclient-');

    recoveryRun();
    expect(recoveryAttempts($quote->id, $flow))->toHaveCount(1)->and(recoverySentTo($fake, $quote->id))->toHaveCount(1);
});

it('JOB-34 deja la pausa del flujo entre intentos y no pasa de max_attempts', function () {
    $fake = recoveryFakeChannel();
    $quote = recoveryWaitingQuote('COT-2026-00185', 240);
    $flow = recoveryQuoteFlow($this, 60, 2);

    recoveryRun();
    recoveryRun();
    expect(recoveryAttempts($quote->id, $flow))->toHaveCount(1);

    withinTenant(tenantA(), fn () => DB::table('mkt_recovery_attempts')->where('quote_id', $quote->id)->update(['sent_at' => now()->subHours(2), 'scheduled_at' => now()->subHours(2)]));
    recoveryRun();
    expect(recoveryAttempts($quote->id, $flow)->pluck('attempt_no')->all())->toBe([1, 2]);

    withinTenant(tenantA(), fn () => DB::table('mkt_recovery_attempts')->where('quote_id', $quote->id)->update(['sent_at' => now()->subHours(3), 'scheduled_at' => now()->subHours(3)]));
    recoveryRun();
    expect(recoveryAttempts($quote->id, $flow))->toHaveCount(2)->and(recoverySentTo($fake, $quote->id))->toHaveCount(2);
});

it('SC-07 descarta el intento si el cliente revocó el consentimiento del canal', function () {
    $fake = recoveryFakeChannel();
    $quote = recoveryWaitingQuote('COT-2026-00189');
    $flow = recoveryQuoteFlow($this);

    recoveryRun();

    expect(recoveryAttempts($quote->id, $flow)->pluck('status')->all())->toBe(['descartado'])
        ->and(recoverySentTo($fake, $quote->id))->toBe([]);
});

it('SC-07 marca recuperado el último intento enviado cuando la cotización se convierte en reserva', function () {
    recoveryFakeChannel();
    $quote = recoveryWaitingQuote('COT-2026-00185');
    $flow = recoveryQuoteFlow($this);
    recoveryRun();

    $reservation = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->whereNull('deleted_at')->orderBy('code')->first(['id', 'total_amount']));
    withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('id', $quote->id)->update(['status' => 'convertida', 'reservation_id' => $reservation->id, 'converted_at' => now()]));

    recoveryRun();

    $attempt = recoveryAttempts($quote->id, $flow)->first();
    expect($attempt->status)->toBe('recuperado')
        ->and($attempt->recovered_reservation_id)->toBe($reservation->id)
        ->and((float) $attempt->recovered_amount)->toBe((float) $reservation->total_amount);
});

it('el enlace de baja de un mensaje automático revoca el consentimiento de correo del cliente', function () {
    $client = withinTenant(tenantA(), fn () => DB::table('crm_clients')->where('code', 'CLI-0008')->value('id'));
    $token = NewsletterLifecycle::contactToken('client', $client);

    withinTenant(tenantA(), fn () => app(NewsletterLifecycle::class)->unsubscribe($token));

    expect(withinTenant(tenantA(), fn () => DB::table('mkt_consents')->where('subject_id', $client)->where('channel', 'email')->value('status')))->toBe('revocado');
    expect(fn () => withinTenant(tenantA(), fn () => app(NewsletterLifecycle::class)->unsubscribe(Str::replaceLast('a', 'b', $token).'0')))->toThrow(ApiException::class);
});

it('ejecutar una automatización entrega de verdad los mensajes por el canal', function () {
    Queue::fake();
    actingAsSeed('U01');
    $automation = withinTenant(tenantA(), fn () => DB::table('mkt_automations')->where('channel', 'email')->orderBy('code')->first(['id', 'code', 'status']));
    withinTenant(tenantA(), fn () => DB::table('mkt_automations')->where('id', $automation->id)->update(['status' => 'activa']));
    $client = withinTenant(tenantA(), fn () => DB::table('crm_clients')->where('code', 'CLI-0001')->first(['id', 'email']));
    $job = new SendAutomationMessages($automation->code, [['subject_type' => 'client', 'subject_id' => $client->id, 'address' => $client->email, 'ref_type' => 'client', 'ref_id' => $client->id]]);
    $fake = recoveryFakeChannel();

    withinTenant(tenantA(), fn () => app()->call([$job->forTenant((string) tenantA()->getKey()), 'handle']));

    expect($fake->sent)->toHaveCount(1)
        ->and($fake->sent[0]->to)->toBe($client->email)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Automatización')->where('entity_id', $automation->code)->where('action', 'envio_completado')->exists()))->toBeTrue();
});
