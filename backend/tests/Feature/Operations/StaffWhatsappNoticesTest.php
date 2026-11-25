<?php

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Fake\FakeMessagingChannel;
use App\Domain\Platform\Support\IntegrationSecrets;
use App\Jobs\SendNotificationWhatsapp;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    lockSeededBookings();
});

function swnConnect(): void
{
    withinTenant(tenantA(), function (): void {
        $account = DB::table('collab_channel_accounts')->where('channel', 'whatsapp')->orderBy('created_at')->value('id');
        DB::table('collab_channel_accounts')->where('id', $account)->update(['status' => 'activo', 'phone_number_id' => '133344455566', 'connected_at' => now(), 'connection_mode' => 'plataforma', 'credentials_encrypted' => IntegrationSecrets::seal(['access_token' => 'SIMULADO-token-de-la-agencia'])]);
    });
}

function swnDisconnect(): void
{
    withinTenant(tenantA(), fn () => DB::table('collab_channel_accounts')->where('channel', 'whatsapp')->update(['connected_at' => null]));
}

function swnBusyAssignment(): object
{
    return withinTenant(tenantA(), function (): object {
        $assignment = DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')->whereNull('o.deleted_at')->whereNotIn('o.status', ['completada', 'cancelada'])
            ->whereIn('a.status', ['asignada', 'confirmada'])->whereNotNull('a.guide_id')->orderBy('a.service_date')->first(['a.*']) ?? throw new RuntimeException('No hay asignaciones con guía.');
        DB::table('ops_guides')->where('id', $assignment->guide_id)->update(['phone' => '987 111 222']);

        return $assignment;
    });
}

function swnWhatsapp(string $event, string $sourceId): Collection
{
    return withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', $event)->where('source_id', $sourceId)->where('channel', 'whatsapp')->get());
}

function swnCriticalIncident(object $test): string
{
    return $test->postJson('/api/v1/ops/incidents', [
        'order_code' => 'OP-2026-0413',
        'type' => 'Horario',
        'severity' => 'critica',
        'title' => 'Pasajero extraviado en la ruta',
        'description' => 'El guía reporta un pasajero que no regresó al punto de encuentro.',
    ], critical())->assertCreated()->json('data.code');
}

it('liberar recursos encola un WhatsApp al guía con la cuenta de la agencia y sale por el conector (OPS-BR-29)', function () {
    Queue::fake();
    swnConnect();
    actingAsSeed('U05');
    $busy = swnBusyAssignment();

    $this->postJson("/api/v1/ops/assignments/{$busy->id}/release", [], critical((int) $busy->lock_version))->assertOk();

    $row = swnWhatsapp('asignacion.liberada', (string) $busy->id)->firstWhere('recipient_address', '+51987111222');
    expect($row)->not->toBeNull()
        ->and($row->status)->toBe('pendiente')
        ->and($row->body_rendered)->toContain('ya no está a tu cargo');
    Queue::assertPushed(SendNotificationWhatsapp::class, fn (SendNotificationWhatsapp $job) => $job->messageId === (string) $row->id);

    $fake = new FakeMessagingChannel;
    app()->instance(MessagingChannel::class, $fake);
    withinTenant(tenantA(), fn () => app()->call([(new SendNotificationWhatsapp((string) $row->id))->forTenant((string) tenantA()->getKey()), 'handle']));

    $sent = swnWhatsapp('asignacion.liberada', (string) $busy->id)->firstWhere('id', $row->id);
    expect($sent->status)->toBe('enviado')
        ->and($sent->provider_message_id)->toStartWith('FAKE-MSG-')
        ->and($fake->sent)->toHaveCount(1)
        ->and($fake->sent[0]->to)->toBe('+51987111222')
        ->and($fake->sent[0]->sender['phone_number_id'])->toBe('133344455566')
        ->and(DB::connection('pgsql_platform')->table('usage_events')->where('tenant_id', tenantA()->getKey())->where('metric', 'whatsapp_month')->whereNull('processed_at')->exists())->toBeTrue();
});

it('sin WhatsApp conectado el aviso se omite, no se simula y el historial dice por qué', function () {
    Queue::fake();
    swnDisconnect();
    actingAsSeed('U05');
    $busy = swnBusyAssignment();

    $this->postJson("/api/v1/ops/assignments/{$busy->id}/release", [], critical((int) $busy->lock_version))->assertOk();

    $row = swnWhatsapp('asignacion.liberada', (string) $busy->id)->first();
    expect($row->status)->toBe('fallido')
        ->and($row->last_error)->toBe(StaffNotices::WHATSAPP_MISSING)
        ->and($row->last_error)->toStartWith('Conecta tu WhatsApp');
    Queue::assertNotPushed(SendNotificationWhatsapp::class);
});

it('asignar con la casilla de WhatsApp avisa al guía por ese canal; sin la casilla, no', function () {
    Queue::fake();
    swnConnect();
    actingAsSeed('U05');
    $busy = swnBusyAssignment();
    $guide = (string) $busy->guide_id;

    $this->postJson("/api/v1/ops/assignments/{$busy->id}/release", [], critical((int) $busy->lock_version))->assertOk();
    $version = fn () => (int) rowOf('ops_assignments', (string) $busy->id, column: 'id')->lock_version;

    $this->putJson("/api/v1/ops/assignments/{$busy->id}/resources", ['guide_id' => $guide, 'ack_warnings' => true, 'notify' => ['push']], critical($version()))->assertOk();
    expect(swnWhatsapp('asignacion.creada', (string) $busy->id))->toHaveCount(0);

    $this->postJson("/api/v1/ops/assignments/{$busy->id}/release", [], critical($version()))->assertOk();
    $this->putJson("/api/v1/ops/assignments/{$busy->id}/resources", ['guide_id' => $guide, 'ack_warnings' => true, 'notify' => ['push', 'whatsapp']], critical($version()))->assertOk();

    $rows = swnWhatsapp('asignacion.creada', (string) $busy->id);
    expect($rows)->toHaveCount(1)->and($rows->first()->status)->toBe('pendiente')->and($rows->first()->body_rendered)->toContain('Tienes un servicio asignado');
});

it('una incidencia crítica avisa a gerencia por WhatsApp y lo deja en la bitácora (OPS-BR-61)', function () {
    Queue::fake();
    swnConnect();
    withinTenant(tenantA(), fn () => DB::table('iam_users')->where('code', 'U02')->update(['phone' => '+51 987 331 902']));
    actingAsSeed('U05');

    $code = swnCriticalIncident($this);
    $incident = rowOf('ops_incidents', $code);
    $rows = swnWhatsapp('incidencia.critica', (string) $incident->id);

    expect($rows->pluck('recipient_address'))->toContain('+51987331902')
        ->and($rows->firstWhere('recipient_address', '+51987331902')->status)->toBe('pendiente')
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_incident_logs')->where('incident_id', $incident->id)->where('kind', 'alerta')->where('message', 'like', 'WhatsApp a gerencia en cola%')->exists()))->toBeTrue();
    Queue::assertPushed(SendNotificationWhatsapp::class);
});

it('una incidencia crítica sin WhatsApp conectado deja el motivo en la bitácora', function () {
    Queue::fake();
    swnDisconnect();
    actingAsSeed('U05');

    $code = swnCriticalIncident($this);
    $incident = rowOf('ops_incidents', $code);

    expect(withinTenant(tenantA(), fn () => DB::table('ops_incident_logs')->where('incident_id', $incident->id)->where('kind', 'alerta')->where('message', 'WhatsApp a gerencia no enviado: '.StaffNotices::WHATSAPP_MISSING)->exists()))->toBeTrue()
        ->and(swnWhatsapp('incidencia.critica', (string) $incident->id)->pluck('status')->unique()->all())->toBe(['fallido']);
    Queue::assertNotPushed(SendNotificationWhatsapp::class);
});
