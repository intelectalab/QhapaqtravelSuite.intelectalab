<?php

use App\Domain\Iam\Support\Invitations;
use App\Domain\Shared\Jobs\JobCatalog;
use App\Domain\Shared\Outbox\OutboxMessagePublished;
use App\Jobs\ExpireAvailabilityHolds;
use App\Jobs\ExpireQuotes;
use App\Jobs\MaintainMonthlyPartitions;
use App\Jobs\MarkOverdueReceivables;
use App\Jobs\RelayOutbox;
use App\Jobs\SendNotificationEmail;
use App\Jobs\SendPaymentReminders;
use App\Jobs\SendPlainMail;
use App\Jobs\TenantJob;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(fn () => lockScheduledJobs());

function runTenantJob(TenantJob $job): void
{
    dispatch_sync($job->forTenant((string) tenantA()->getKey()));
}

function scheduledJob(string $code): object
{
    return withinTenant(tenantA(), fn () => DB::connection('pgsql_audit')->table('sys_scheduled_jobs')->where('tenant_id', tenantA()->getKey())->where('code', $code)->first());
}

function inTenantA(Closure $fn): mixed
{
    return withinTenant(tenantA(), $fn);
}

it('cada agencia nace con todos los procesos del catálogo', function () {
    foreach (['TNT-0001', 'TNT-0002'] as $code) {
        $codes = withinTenant(tenantByCode($code), fn () => DB::table('sys_scheduled_jobs')->pluck('code')->sort()->values()->all());

        expect($codes)->toBe(collect(JobCatalog::TENANT)->keys()->sort()->values()->all());
    }
});

it('JOB-02 vence las cotizaciones abiertas con validez pasada y audita como Sistema', function () {
    inTenantA(fn () => DB::table('quote_quotes')->where('code', 'COT-2026-00188')->update(['status' => 'enviada', 'valid_until' => '2026-09-01']));

    runTenantJob(new ExpireQuotes);

    $audit = inTenantA(fn () => DB::table('audit_events')->where('entity_id', 'COT-2026-00188')->where('action', 'vencer')->first());

    expect(rowOf('quote_quotes', 'COT-2026-00188')->status)->toBe('vencida')
        ->and($audit)->not->toBeNull()
        ->and($audit->before_value)->toBe('enviada')
        ->and($audit->actor_id)->toBeNull()
        ->and(scheduledJob('JOB-02')->last_status)->toBe('ok')
        ->and(scheduledJob('JOB-02')->last_result)->toContain('cotización vencida');
});

it('JOB-02 no toca las cotizaciones vigentes ni las ya convertidas', function () {
    inTenantA(fn () => DB::table('quote_quotes')->where('code', 'COT-2026-00189')->update(['valid_until' => '2026-12-31']));
    $converted = rowOf('quote_quotes', 'COT-2026-00186')->status;

    runTenantJob(new ExpireQuotes);

    expect(rowOf('quote_quotes', 'COT-2026-00189')->status)->not->toBe('vencida')
        ->and(rowOf('quote_quotes', 'COT-2026-00186')->status)->toBe($converted);
});

it('JOB-01 expira los holds vencidos y el pedido web impago que los retenía', function () {
    $order = rowOf('channel_ecom_orders', 'WEB-10433');
    $holdId = (string) Str::uuid7();
    inTenantA(function () use ($order, $holdId) {
        DB::table('channel_ecom_orders')->where('id', $order->id)->update(['hold_expires_at' => now()->subMinutes(5)]);
        DB::table('catalog_availability_holds')->insert([
            'id' => $holdId,
            'tenant_id' => tenantA()->getKey(),
            'ref' => 'HLD-PEST',
            'product_id' => DB::table('catalog_products')->value('id'),
            'service_date' => '2026-10-10',
            'quantity' => 2,
            'reference' => $order->code,
            'reference_type' => 'order',
            'reference_id' => $order->id,
            'status' => 'hold',
            'expires_at' => now()->subMinutes(5),
        ]);
    });

    runTenantJob(new ExpireAvailabilityHolds);

    expect(inTenantA(fn () => DB::table('catalog_availability_holds')->where('id', $holdId)->value('status')))->toBe('expirada')
        ->and(rowOf('channel_ecom_orders', 'WEB-10433')->status)->toBe('expirado')
        ->and(scheduledJob('JOB-01')->last_result)->toMatch('/holds? expirados?/')
        ->and(scheduledJob('JOB-01')->last_result)->toContain('pedido web vencido');
});

it('JOB-12 marca vencidas las cuentas por cobrar impagas con vencimiento pasado', function () {
    inTenantA(fn () => DB::table('fin_receivables')->where('code', 'CXC-00714')->update(['due_date' => '2026-09-20', 'status' => 'abierta']));

    runTenantJob(new MarkOverdueReceivables);

    expect(rowOf('fin_receivables', 'CXC-00714')->status)->toBe('vencida')
        ->and(inTenantA(fn () => DB::table('audit_events')->where('entity_id', 'CXC-00714')->where('action', 'vencer')->exists()))->toBeTrue();
});

it('JOB-03 encola el recordatorio de pago con la plantilla de la agencia y no lo repite el mismo día', function () {
    Queue::fake([SendNotificationEmail::class]);
    inTenantA(fn () => DB::table('fin_receivables')->where('code', 'CXC-00714')->update(['due_date' => '2026-09-30', 'last_reminder_at' => null]));

    runTenantJob(new SendPaymentReminders);
    runTenantJob(new SendPaymentReminders);

    $receivable = rowOf('fin_receivables', 'CXC-00714');
    $messages = inTenantA(fn () => DB::table('notif_messages')->where('event_code', 'pago.recordatorio')->where('source_id', $receivable->id)->get());

    expect($messages)->toHaveCount(1)
        ->and($messages[0]->status)->toBe('pendiente')
        ->and($messages[0]->body_rendered)->not->toContain('{{')
        ->and($messages[0]->body_rendered)->toMatch('/(S\/|US\$) [0-9 ]+\.[0-9]{2}/')
        ->and($receivable->last_reminder_at)->not->toBeNull();
    Queue::assertPushedOn('notifications', SendNotificationEmail::class);
});

it('el correo de una notificación se envía desde la cola y queda como enviado', function () {
    Mail::fake();
    $id = (string) Str::uuid7();
    inTenantA(fn () => DB::table('notif_messages')->insert([
        'id' => $id, 'tenant_id' => tenantA()->getKey(), 'event_code' => 'pago.recordatorio', 'channel' => 'email',
        'recipient_address' => 'cliente@example.test', 'subject' => 'Prueba', 'body_rendered' => 'Hola', 'status' => 'pendiente',
    ]));

    dispatch_sync((new SendNotificationEmail($id))->forTenant((string) tenantA()->getKey()));

    $message = inTenantA(fn () => DB::table('notif_messages')->where('id', $id)->first());
    expect($message->status)->toBe('enviado')->and($message->sent_at)->not->toBeNull();
});

it('JOB-13 publica los eventos pendientes del outbox una sola vez', function () {
    Event::fake([OutboxMessagePublished::class]);
    $id = (string) Str::uuid7();
    inTenantA(fn () => DB::table('sys_outbox')->insert([
        'id' => $id, 'tenant_id' => tenantA()->getKey(), 'aggregate_type' => 'booking_reservation', 'aggregate_id' => (string) Str::uuid7(),
        'event' => 'ReservationCreated', 'payload' => json_encode(['reservation_code' => 'RES-PEST']), 'status' => 'pending', 'available_at' => now(),
    ]));

    runTenantJob(new RelayOutbox);
    runTenantJob(new RelayOutbox);

    expect(inTenantA(fn () => DB::table('sys_outbox')->where('id', $id)->value('status')))->toBe('dispatched');
    expect(Event::dispatched(OutboxMessagePublished::class, fn (OutboxMessagePublished $event) => $event->messageId === $id))->toHaveCount(1);
    Event::assertDispatched(OutboxMessagePublished::class, fn (OutboxMessagePublished $event) => $event->messageId === $id && $event->payload['reservation_code'] === 'RES-PEST');
});

it('cada ejecución queda en sys_job_runs con su resultado', function () {
    runTenantJob(new MarkOverdueReceivables);

    $run = DB::connection('pgsql_audit')->table('sys_job_runs')->where('tenant_id', tenantA()->getKey())->where('job_class', MarkOverdueReceivables::class)->orderByDesc('id')->first();

    expect($run->status)->toBe('ok')
        ->and($run->result)->not->toBeEmpty()
        ->and($run->finished_at)->not->toBeNull();
});

it('Ejecutar ahora encola la clase real del proceso en su cola', function () {
    Queue::fake();
    actingAsSeed('U01');

    $response = $this->postJson('/api/v1/jobs/JOB-12/run', [], critical())->assertStatus(202);

    expect($response->json('data.status'))->toBe('en_curso');
    Queue::assertPushedOn('low', MarkOverdueReceivables::class, fn (MarkOverdueReceivables $job) => $job->trigger === 'manual' && $job->runId === $response->json('data.id'));
});

it('el despachador encola solo los procesos que tocan, por agencia y en su cola', function () {
    Queue::fake();

    $this->artisan('jobs:run-due', ['--tenant' => 'TNT-0001', '--at' => '2026-09-29 05:05:00'])->assertSuccessful();

    Queue::assertPushedOn('critical', ExpireAvailabilityHolds::class);
    Queue::assertPushedOn('default', ExpireQuotes::class);
    Queue::assertPushedOn('low', MarkOverdueReceivables::class);
    Queue::assertNotPushed(SendPaymentReminders::class);
});

it('el despachador respeta los procesos pausados', function () {
    Queue::fake();
    inTenantA(fn () => DB::table('sys_scheduled_jobs')->where('code', 'JOB-13')->update(['paused' => true]));

    $this->artisan('jobs:run-due', ['--tenant' => 'TNT-0001', '--at' => '2026-09-29 05:05:00'])->assertSuccessful();

    Queue::assertNotPushed(RelayOutbox::class);
});

it('las particiones mensuales quedan creadas con margen de tres meses', function () {
    dispatch_sync(new MaintainMonthlyPartitions);

    $next = now('America/Lima')->startOfMonth()->addMonths(MaintainMonthlyPartitions::MONTHS_AHEAD)->format('\yY\mm');

    expect(DB::connection('pgsql_owner')->selectOne('select to_regclass(?) as oid', ['audit_events_'.$next])->oid)->not->toBeNull();
});

it('los correos del sistema salen por la cola notifications', function () {
    Queue::fake();

    app(Invitations::class)->send('nuevo@example.test', 'Usuario Nuevo', 'Andes Horizonte', 'token-pest');

    Queue::assertPushedOn('notifications', SendPlainMail::class, fn (SendPlainMail $mail) => $mail->to === 'nuevo@example.test' && str_contains($mail->body, '/invitacion/token-pest'));
});
