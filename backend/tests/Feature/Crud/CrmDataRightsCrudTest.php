<?php

use App\Domain\Crm\Actions\AfterSalesWorkflow;
use App\Domain\Crm\Actions\AnonymizeClient;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

function arcoTenant(Closure $fn): mixed
{
    return withinTenant(tenantA(), $fn);
}

it('el cliente envía una solicitud ARCO desde el portal: queda como caso de Postventa con plazo legal y avisa a Gerencia', function () {
    actingAsSeed('U14');

    expect($this->postJson('/api/v1/public/me/arco-requests', ['type' => 'cancelacion', 'detail' => 'Quiero que eliminen mis datos personales.']))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');

    $data = $this->postJson('/api/v1/public/me/arco-requests', ['type' => 'cancelacion', 'detail' => 'Quiero que eliminen mis datos personales.'], critical())->assertOk()->json('data');
    $case = arcoTenant(fn () => DB::table('crm_cases')->where('code', $data['code'])->first());

    expect($case->type_code)->toBe('arco')
        ->and($case->subject)->toBe('Solicitud ARCO · Cancelación')
        ->and($case->priority)->toBe('alta')
        ->and($case->status)->toBe('abierta')
        ->and($case->client_id)->toBe(rowOf('crm_clients', 'CLI-0001')->id)
        ->and($case->response_days)->toBe(10)
        ->and($case->due_date)->toBe($data['due_date'])
        ->and(arcoTenant(fn () => DB::table('crm_catalog_items')->where('kind', 'case_type')->where('code', 'arco')->exists()))->toBeTrue()
        ->and(arcoTenant(fn () => DB::table('notif_messages')->where('event_code', 'arco.solicitud')->where('source_id', $case->id)->where('recipient_user_id', seedUser('U02')->id)->exists()))->toBeTrue();
});

it('la solicitud de acceso tiene 20 días hábiles y el tipo y el detalle son obligatorios', function () {
    actingAsSeed('U14');

    expect($this->postJson('/api/v1/public/me/arco-requests', ['type' => 'acceso', 'detail' => 'Quiero saber qué datos míos guardan.'], critical())->assertOk()->json('data.response_days'))->toBe(20);
    $this->postJson('/api/v1/public/me/arco-requests', ['type' => 'borrar-todo', 'detail' => 'corto'], critical())->assertStatus(422)->assertJsonValidationErrors(['type', 'detail']);
});

it('el personal de la agencia no usa la solicitud ARCO del portal', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/public/me/arco-requests', ['type' => 'acceso', 'detail' => 'Quiero saber qué datos guardan.'], critical()))->toBeApiError(403);
});

it('la supresión anonimiza al cliente, sus pasajeros y consentimientos, conserva sus reservas y queda auditada', function () {
    actingAsSeed('U01');
    $client = rowOf('crm_clients', 'CLI-0006');
    $reservations = arcoTenant(fn () => DB::table('booking_reservations')->where('client_id', $client->id)->pluck('id'));

    $data = $this->postJson('/api/v1/crm/clients/CLI-0006/anonymize', ['reason' => 'Solicitud de cancelación del titular por correo.', 'confirm' => true], critical())->assertOk()->json('data');
    $after = arcoTenant(fn () => DB::table('crm_clients')->where('id', $client->id)->first());
    $passengers = arcoTenant(fn () => DB::table('booking_passengers')->whereIn('reservation_id', $reservations)->get());

    expect($data['passengers'])->toBe(2)
        ->and($data['consents_revoked'])->toBe(1)
        ->and($after->name)->toBe(AnonymizeClient::NAME.' CLI-0006')
        ->and($after->doc_number)->toBe(AnonymizeClient::DOC)
        ->and($after->email)->toEndWith('@anonimizado.invalid')
        ->and($after->phone)->toBeNull()
        ->and($after->birth_date)->toBeNull()
        ->and($after->deleted_at)->not->toBeNull()
        ->and($passengers->pluck('full_name')->unique()->all())->toBe(['Pasajero anonimizado'])
        ->and($passengers->pluck('doc_number')->filter()->all())->toBe([])
        ->and(arcoTenant(fn () => DB::table('booking_reservations')->where('client_id', $client->id)->count()))->toBe($reservations->count())
        ->and(arcoTenant(fn () => DB::table('mkt_consents')->where('subject_id', $client->id)->where('status', 'otorgado')->exists()))->toBeFalse()
        ->and(arcoTenant(fn () => DB::table('audit_events')->where(['entity' => 'Cliente', 'entity_id' => 'CLI-0006', 'action' => 'anonimizar'])->exists()))->toBeTrue();

    $this->getJson('/api/v1/crm/clients/CLI-0006')->assertNotFound();
    expect($this->postJson('/api/v1/crm/clients/CLI-0006/anonymize', ['reason' => 'Segundo intento de supresión.', 'confirm' => true], critical()))->toBeApiError(404);
});

it('la supresión cierra el acceso al portal del cliente y resuelve su solicitud ARCO', function () {
    Mail::fake();
    actingAsSeed('U01');
    $this->postJson('/api/v1/crm/clients/CLI-0008/portal-access', [], critical())->assertCreated();
    $portalUser = arcoTenant(fn () => DB::table('iam_users')->where('client_id', rowOf('crm_clients', 'CLI-0008')->id)->first());
    $case = arcoTenant(function () {
        DB::table('crm_catalog_items')->insertOrIgnore(['kind' => 'case_type', 'code' => 'arco', 'label' => 'Solicitud ARCO (datos personales)']);

        return app(AfterSalesWorkflow::class)->openCase(['client_id' => rowOf('crm_clients', 'CLI-0008')->id, 'origin' => 'manual', 'type_code' => 'arco', 'priority' => 'alta', 'subject' => 'Solicitud ARCO · Cancelación', 'description' => 'Pedido del cliente.', 'owner_id' => seedUser('U01')->id], seedUser('U01'), 'Solicitud registrada');
    });

    $data = $this->postJson('/api/v1/crm/clients/CLI-0008/anonymize', ['reason' => 'Solicitud ARCO de cancelación del cliente.', 'case' => $case, 'confirm' => true], critical())->assertOk()->json('data');
    $user = arcoTenant(fn () => DB::table('iam_users')->where('id', $portalUser->id)->first());

    expect($data['portal_users'])->toBe(1)
        ->and($data['case'])->toBe($case)
        ->and($user->status)->toBe('inactivo')
        ->and($user->email)->toEndWith('@anonimizado.invalid')
        ->and($user->deleted_at)->not->toBeNull()
        ->and(arcoTenant(fn () => DB::table('crm_cases')->where('code', $case)->value('status')))->toBe('resuelta');
});

it('no se suprimen los datos de un cliente con viajes vigentes', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/crm/clients/CLI-0001/anonymize', ['reason' => 'Solicitud del cliente por correo.', 'confirm' => true], critical()))->toBeApiError(409, 'ARCO-01')
        ->and(rowOf('crm_clients', 'CLI-0001')->deleted_at)->toBeNull();
});

it('Ventas no ejecuta la supresión y la confirmación y el motivo son obligatorios', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/crm/clients/CLI-0016/anonymize', ['reason' => 'corto'], critical())->assertStatus(422)->assertJsonValidationErrors(['reason', 'confirm']);

    actingAsSeed('U03');
    expect($this->postJson('/api/v1/crm/clients/CLI-0016/anonymize', ['reason' => 'Solicitud del cliente por correo.', 'confirm' => true], critical()))->toBeApiError(403);
});
