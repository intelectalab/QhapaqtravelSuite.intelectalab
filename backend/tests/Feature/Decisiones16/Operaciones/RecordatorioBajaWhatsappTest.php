<?php

use App\Domain\Finance\Support\PaymentReminderWhatsapp;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Fake\FakeMessagingChannel;
use App\Domain\Platform\Support\IntegrationSecrets;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

function t16opsReceivable(): object
{
    return withinTenant(tenantA(), fn () => DB::table('fin_receivables as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')->whereNull('r.deleted_at')
        ->whereIn('r.status', ['abierta', 'parcial', 'vencida'])->whereColumn('r.paid_amount', '<', 'r.amount')->where('c.email', 'like', '%@%')->orderBy('r.code')->first(['r.code', 'r.id', 'r.client_id']))
        ?? throw new RuntimeException('No hay cuotas abiertas con correo.');
}

function t16opsWhatsapp(): void
{
    withinTenant(tenantA(), function (): void {
        $account = DB::table('collab_channel_accounts')->where('channel', 'whatsapp')->orderBy('created_at')->value('id');
        DB::table('collab_channel_accounts')->where('id', $account)->update(['status' => 'activo', 'phone_number_id' => '133344455566', 'connected_at' => now(), 'connection_mode' => 'plataforma', 'credentials_encrypted' => IntegrationSecrets::seal(['access_token' => 'SIMULADO-token-de-la-agencia'])]);
        DB::table('collab_whatsapp_templates')->insert(['id' => (string) Str::uuid7(), 'channel_account_id' => $account, 'name' => 'pago_recordatorio', 'lang' => 'es', 'category' => 'utility', 'purpose' => 'recordatorio', 'body' => 'Hola {{cliente}}, te recordamos el pago de {{monto}} de tu reserva {{reserva}}.', 'variables' => '{cliente,monto,reserva}', 'meta_template_id' => 'tpl-pago-16', 'status' => 'aprobada']);
    });
}

function t16opsOptOut(string $clientId): void
{
    withinTenant(tenantA(), function () use ($clientId): void {
        DB::table('mkt_consents')->where('subject_type', 'client')->where('subject_id', $clientId)->where('channel', 'whatsapp')->delete();
        DB::table('mkt_consents')->insert([
            'code' => 'CON-T16-'.Str::upper(Str::random(6)), 'subject_type' => 'client', 'subject_id' => $clientId, 'channel' => 'whatsapp', 'status' => 'revocado',
            'granted_at' => now()->subMonths(2), 'source' => 'Formulario del sitio', 'evidence' => 'Casilla marcada', 'policy_version' => 'v1',
            'revoked_at' => now()->subDay(), 'revoke_source' => 'Respuesta BAJA por WhatsApp',
        ]);
    });
}

it('duda 10: si el cliente se dio de baja de WhatsApp el recordatorio sale solo por correo y el historial lo dice', function () {
    Queue::fake();
    lockTreasury();
    actingAsSeed('U07');
    $receivable = t16opsReceivable();
    withinTenant(tenantA(), fn () => DB::table('crm_clients')->where('id', $receivable->client_id)->update(['phone' => '+51 987 654 321']));
    t16opsWhatsapp();
    t16opsOptOut((string) $receivable->client_id);
    $messaging = new FakeMessagingChannel;
    app()->instance(MessagingChannel::class, $messaging);
    $before = count($messaging->sent);

    $sent = $this->postJson("/api/v1/finance/receivables/{$receivable->code}/reminders", [], critical())->assertCreated();

    expect($sent->json('data.channels'))->toBe(['email'])
        ->and($sent->json('data.whatsapp.sent'))->toBeFalse()
        ->and($sent->json('data.whatsapp.note'))->toContain(PaymentReminderWhatsapp::OPTED_OUT)
        ->and(count($messaging->sent))->toBe($before)
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('channel', 'whatsapp')->where('source_id', $receivable->id)->exists()))->toBeFalse()
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_receivable_reminders')->where('receivable_id', $receivable->id)->pluck('channels')->all()))->toBe(['email'])
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Cuenta por cobrar', 'entity_id' => $receivable->code, 'action' => 'omitir_whatsapp', 'after_value' => PaymentReminderWhatsapp::OPTED_OUT])->exists()))->toBeTrue();

    $audit = collect($this->getJson("/api/v1/finance/receivables/{$receivable->code}")->assertOk()->json('data.audit'))->pluck('after')->filter()->implode(' | ');
    expect($audit)->toContain(PaymentReminderWhatsapp::OPTED_OUT);
});

it('duda 10: sin consentimiento de marketing el recordatorio sí sale por WhatsApp; con la baja, no (lo usan el envío manual y el job)', function () {
    $receivable = t16opsReceivable();
    withinTenant(tenantA(), fn () => DB::table('crm_clients')->where('id', $receivable->client_id)->update(['phone' => '+51 987 654 321']));
    t16opsWhatsapp();
    withinTenant(tenantA(), fn () => DB::table('mkt_consents')->where('subject_type', 'client')->where('subject_id', $receivable->client_id)->where('channel', 'whatsapp')->delete());

    $variables = ['cliente' => 'Rosa', 'reserva' => 'RES-1', 'monto' => 'S/ 100.00', 'fecha_viaje' => '', 'vendedor' => ''];
    $source = ['source_type' => 'fin_receivable', 'source_id' => $receivable->id, 'client_id' => $receivable->client_id, 'reservation_id' => null];
    $allowed = withinTenant(tenantA(), fn () => app(PaymentReminderWhatsapp::class)->send('+51 987 654 321', $variables, $source));
    expect($allowed['sent'])->toBeTrue();

    t16opsOptOut((string) $receivable->client_id);
    $skipped = withinTenant(tenantA(), fn () => app(PaymentReminderWhatsapp::class)->send('+51 987 654 321', $variables, $source));
    expect($skipped['sent'])->toBeFalse()->and($skipped['reason'])->toContain(PaymentReminderWhatsapp::OPTED_OUT);
});
