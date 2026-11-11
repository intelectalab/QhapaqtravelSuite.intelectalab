<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

function vincCnvVersion(string $code): int
{
    return (int) rowOf('collab_conversations', $code)->lock_version;
}

function vincCnvAuditada(string $code, string $action, ?string $after = null): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Conversación')->where('entity_id', $code)->where('action', $action)->exists());
}

function vincCnvUltimoMensaje(string $code): object
{
    $id = rowOf('collab_conversations', $code)->id;

    return withinTenant(tenantA(), fn () => DB::table('collab_messages')->where('conversation_id', $id)->orderByDesc('sent_at')->first());
}

function vincCnvReservaDe(string $owner): object
{
    $id = seedUser($owner)->id;

    return withinTenant(tenantA(), fn () => DB::table('booking_reservations')->whereNull('deleted_at')->where('owner_id', $id)->whereNotNull('client_id')->orderBy('code')->first());
}

it('Ventas vincula la conversación a un cliente de su cartera y queda en el hilo y la auditoría', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/inbox/conversations/CNV-0104/link', ['kind' => 'client', 'code' => 'CLI-0006'], critical(vincCnvVersion('CNV-0104')))->assertOk();

    expect(rowOf('collab_conversations', 'CNV-0104')->client_id)->toBe(idOf('crm_clients', 'CLI-0006'))
        ->and(vincCnvUltimoMensaje('CNV-0104')->direction)->toBe('system')
        ->and(vincCnvUltimoMensaje('CNV-0104')->body)->toContain('CLI-0006')
        ->and(vincCnvAuditada('CNV-0104', 'vincular_cliente'))->toBeTrue()
        ->and($this->getJson('/api/v1/inbox/conversations/CNV-0104')->json('data.card.client.code'))->toBe('CLI-0006');

    expect($this->postJson('/api/v1/inbox/conversations/CNV-0104/link', ['kind' => 'client', 'code' => 'CLI-0006'], critical(vincCnvVersion('CNV-0104'))))->toBeApiError(409, 'INB-BR-06');
});

it('la búsqueda de registros respeta la cartera y no se vincula un cliente ajeno', function () {
    actingAsSeed('U03');

    $found = collect($this->getJson('/api/v1/inbox/conversations/CNV-0104/link-options?kind=client&q=sophie')->assertOk()->json('data'));
    expect($found->pluck('code'))->toContain('CLI-0006');
    expect(collect($this->getJson('/api/v1/inbox/conversations/CNV-0104/link-options?kind=client&q=gabriela')->assertOk()->json('data'))->pluck('code'))->not->toContain('CLI-0001');
    expect(collect($this->getJson('/api/v1/inbox/conversations/CNV-0104/link-options?kind=client')->json('data'))->firstWhere('code', 'CLI-0004')['linked'] ?? false)->toBeTrue();

    expect($this->postJson('/api/v1/inbox/conversations/CNV-0104/link', ['kind' => 'client', 'code' => 'CLI-0001'], critical(vincCnvVersion('CNV-0104'))))->toBeApiError(403, 'SEC-BR-09');
    expect($this->postJson('/api/v1/inbox/conversations/CNV-0104/link', ['kind' => 'client', 'code' => 'CLI-9999'], critical(vincCnvVersion('CNV-0104'))))->toBeApiError(404);
    expect($this->getJson('/api/v1/inbox/conversations/CNV-0103/link-options?kind=client'))->toBeApiError(404);
    $this->getJson('/api/v1/inbox/conversations/CNV-0104/link-options?kind=ticket')->assertStatus(422)->assertJsonValidationErrors('kind');
    expect(rowOf('collab_conversations', 'CNV-0104')->client_id)->toBe(idOf('crm_clients', 'CLI-0004'));
});

it('vincular una reserva completa el cliente si faltaba y desvincularla lo deja registrado', function () {
    actingAsSeed('U03');
    $reservation = vincCnvReservaDe('U03');

    $this->postJson('/api/v1/inbox/conversations/CNV-0105/link', ['kind' => 'reservation', 'code' => $reservation->code], critical(vincCnvVersion('CNV-0105')))->assertOk();

    $linked = rowOf('collab_conversations', 'CNV-0105');
    expect($linked->reservation_id)->toBe($reservation->id)
        ->and($linked->client_id)->toBe($reservation->client_id)
        ->and(vincCnvAuditada('CNV-0105', 'vincular_reserva'))->toBeTrue();

    $this->postJson('/api/v1/inbox/conversations/CNV-0105/unlink', ['kind' => 'reservation'], critical(vincCnvVersion('CNV-0105')))->assertOk();
    expect(rowOf('collab_conversations', 'CNV-0105')->reservation_id)->toBeNull()
        ->and(rowOf('collab_conversations', 'CNV-0105')->client_id)->toBe($reservation->client_id)
        ->and(vincCnvAuditada('CNV-0105', 'desvincular_reserva'))->toBeTrue();

    expect($this->postJson('/api/v1/inbox/conversations/CNV-0105/unlink', ['kind' => 'reservation'], critical(vincCnvVersion('CNV-0105'))))->toBeApiError(409, 'INB-BR-06');
});

it('desvincular el lead lo quita de la ficha', function () {
    actingAsSeed('U02');

    $this->postJson('/api/v1/inbox/conversations/CNV-0105/unlink', ['kind' => 'lead'], critical(vincCnvVersion('CNV-0105')))->assertOk();

    expect(rowOf('collab_conversations', 'CNV-0105')->lead_id)->toBeNull()
        ->and($this->getJson('/api/v1/inbox/conversations/CNV-0105')->json('data.card.lead'))->toBeNull()
        ->and(vincCnvAuditada('CNV-0105', 'desvincular_lead'))->toBeTrue();
});

it('Operaciones vincula reservas pero no clientes, y una versión vieja no se aplica', function () {
    actingAsSeed('U05');

    $response = $this->postJson('/api/v1/inbox/conversations/CNV-0103/link', ['kind' => 'client', 'code' => 'CLI-0003'], critical(vincCnvVersion('CNV-0103')));
    expect($response)->toBeApiError(403, 'INB-BR-06')
        ->and($response->json('required_permissions'))->toBe(['crm.clients.manage'])
        ->and($this->getJson('/api/v1/inbox/conversations')->json('data.can.link'))->toBe(['reservation']);

    $version = vincCnvVersion('CNV-0103');
    expect($this->postJson('/api/v1/inbox/conversations/CNV-0103/unlink', ['kind' => 'reservation'], critical($version + 3)))->toBeApiError(409, 'STALE_VERSION');
    $this->postJson('/api/v1/inbox/conversations/CNV-0103/unlink', ['kind' => 'reservation'], critical($version))->assertOk();
    expect(rowOf('collab_conversations', 'CNV-0103')->reservation_id)->toBeNull();
});
