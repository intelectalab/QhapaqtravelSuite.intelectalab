<?php

use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Contracts\PushSender;
use App\Domain\Integrations\Fake\FakeMessagingChannel;
use App\Domain\Integrations\Fake\FakePushSender;
use App\Domain\Platform\Support\IntegrationSecrets;
use App\Jobs\CheckPushReceipts;
use App\Jobs\SendPushNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

function wadecDevice(string $token): string
{
    return withinTenant(tenantA(), function () use ($token): string {
        $id = (string) Str::uuid7();
        DB::table('ops_mobile_devices')->insert(['id' => $id, 'user_id' => seedUser('U09')->getKey(), 'app' => 'operador', 'platform' => 'android', 'app_version' => '1.0.0', 'expo_push_token' => $token, 'last_seen_at' => now()]);

        return $id;
    });
}

function wadecAudited(array $where, ?string $like = null): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->when($like !== null, fn ($query) => $query->where('after_value', 'like', $like))->exists());
}

function wadecReceivable(): object
{
    return withinTenant(tenantA(), fn () => DB::table('fin_receivables as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')->whereNull('r.deleted_at')
        ->whereIn('r.status', ['abierta', 'parcial', 'vencida'])->whereColumn('r.paid_amount', '<', 'r.amount')->where('c.email', 'like', '%@%')->orderBy('r.code')->first(['r.code', 'r.id', 'r.client_id']))
        ?? throw new RuntimeException('No hay cuotas abiertas con correo.');
}

function wadecConnectWhatsapp(): void
{
    withinTenant(tenantA(), function (): void {
        $account = DB::table('collab_channel_accounts')->where('channel', 'whatsapp')->orderBy('created_at')->value('id');
        DB::table('collab_channel_accounts')->where('id', $account)->update(['status' => 'activo', 'phone_number_id' => '133344455566', 'connected_at' => now(), 'connection_mode' => 'plataforma', 'credentials_encrypted' => IntegrationSecrets::seal(['access_token' => 'SIMULADO-token-de-la-agencia'])]);
        DB::table('collab_whatsapp_templates')->insert(['id' => (string) Str::uuid7(), 'channel_account_id' => $account, 'name' => 'pago_recordatorio', 'lang' => 'es', 'category' => 'utility', 'purpose' => 'recordatorio', 'body' => 'Hola {{cliente}}, te recordamos el pago de {{monto}} de tu reserva {{reserva}}.', 'variables' => '{cliente,monto,reserva}', 'meta_template_id' => 'tpl-pago-1', 'status' => 'aprobada']);
    });
}

it('el push guarda el ticket de Expo y el job de recibos desactiva el dispositivo no registrado', function () {
    FakePushSender::reset();
    $active = wadecDevice('ExponentPushToken[activo-guia]');
    $gone = wadecDevice('ExponentPushToken['.FakePushSender::UNREGISTERED.'-guia]');

    withinTenant(tenantA(), fn () => (new SendPushNotification([(string) seedUser('U09')->getKey()], 'Servicio asignado', 'Mañana a las 08:00'))->handle(app(PushSender::class)));

    $tickets = withinTenant(tenantA(), fn () => DB::table('ops_push_tickets')->whereIn('device_id', [$active, $gone])->get());
    expect($tickets)->toHaveCount(2)
        ->and($tickets->pluck('status')->unique()->all())->toBe(['pendiente']);

    withinTenant(tenantA(), function (): void {
        DB::table('ops_push_tickets')->update(['created_at' => now()->subMinutes(20)]);
        (new CheckPushReceipts)->handle();
    });

    $device = fn (string $id) => withinTenant(tenantA(), fn () => DB::table('ops_mobile_devices')->where('id', $id)->first());
    $status = fn (string $id) => withinTenant(tenantA(), fn () => DB::table('ops_push_tickets')->where('device_id', $id)->first());

    expect($device($gone)->revoked_at)->not->toBeNull()
        ->and($device($gone)->expo_push_token)->toBeNull()
        ->and($device($active)->revoked_at)->toBeNull()
        ->and($status($gone)->status)->toBe('error')
        ->and($status($gone)->error)->toBe('DeviceNotRegistered')
        ->and($status($active)->status)->toBe('entregado')
        ->and(wadecAudited(['entity' => 'Dispositivo móvil', 'action' => 'desactivar']))->toBeTrue();

    withinTenant(tenantA(), function (): void {
        DB::table('ops_push_tickets')->insert(['ticket_id' => 'SIM-viejo', 'status' => 'pendiente', 'created_at' => now()->subHours(30)]);
        (new CheckPushReceipts)->handle();
    });
    expect(withinTenant(tenantA(), fn () => DB::table('ops_push_tickets')->where('ticket_id', 'SIM-viejo')->value('status')))->toBe('sin_recibo');
});

it('el aviso fcm ya no se usa y la consola no pide el secreto de acuses push', function () {
    $raw = json_encode(['provider_message_id' => 'x', 'status' => 'entregado']);
    expect($this->call('POST', '/api/v1/webhooks/providers/fcm', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], $raw))->toBeApiError(404);

    actingAsPlatform();
    expect(array_keys($this->getJson('/api/v1/platform/settings')->assertOk()->json('data.sections.outgoing_mail.webhook_secrets')))->toBe(['ses']);
});

it('el recordatorio de pago sale solo por correo sin WhatsApp conectado y por los dos cuando está conectado', function () {
    Queue::fake();
    lockTreasury();
    actingAsSeed('U07');
    $receivable = wadecReceivable();
    withinTenant(tenantA(), fn () => DB::table('crm_clients')->where('id', $receivable->client_id)->update(['phone' => '+51 987 654 321']));

    $only = $this->postJson("/api/v1/finance/receivables/{$receivable->code}/reminders", [], critical())->assertCreated();
    expect($only->json('data.channels'))->toBe(['email'])
        ->and($only->json('data.whatsapp.sent'))->toBeFalse()
        ->and($only->json('data.whatsapp.note'))->toContain('no tiene WhatsApp conectado');

    wadecConnectWhatsapp();
    $messaging = new FakeMessagingChannel;
    app()->instance(MessagingChannel::class, $messaging);
    $before = count($messaging->sent);

    $both = $this->postJson("/api/v1/finance/receivables/{$receivable->code}/reminders", [], critical())->assertCreated();
    $channels = withinTenant(tenantA(), fn () => DB::table('fin_receivable_reminders')->where('receivable_id', $receivable->id)->pluck('channels')->sort()->values()->all());
    $notice = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('channel', 'whatsapp')->where('source_id', $receivable->id)->first());
    $sent = $messaging->sent[$before] ?? null;

    expect($both->json('data.channels'))->toBe(['email', 'whatsapp'])
        ->and($channels)->toBe(['email', 'email,whatsapp'])
        ->and($notice->event_code)->toBe('pago.recordatorio')
        ->and($notice->status)->toBe('enviado')
        ->and($notice->recipient_address)->toBe('+51987654321')
        ->and($notice->provider_message_id)->not->toBeNull()
        ->and($sent?->templateCode)->toBe('pago_recordatorio')
        ->and($sent?->sender['access_token'] ?? null)->toBe('SIMULADO-token-de-la-agencia')
        ->and(wadecAudited(['entity' => 'Cuenta por cobrar', 'entity_id' => $receivable->code, 'action' => 'recordar'], '%y WhatsApp +51987654321%'))->toBeTrue();
});
