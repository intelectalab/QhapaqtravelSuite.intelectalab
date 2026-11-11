<?php

use App\Jobs\SendNotificationEmail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

it('showCrmClientsByCodeByTab entrega cada pestaña del cliente 360', function () {
    actingAsSeed('U01');

    foreach (['leads', 'opportunities', 'quotes', 'reservations', 'passengers', 'receivables', 'payments', 'invoices', 'vouchers', 'communications', 'activities', 'timeline', 'audit'] as $tab) {
        $this->getJson("/api/v1/crm/clients/CLI-0005/{$tab}")->assertOk()->assertJsonStructure(['data']);
    }

    $reservations = $this->getJson('/api/v1/crm/clients/CLI-0005/reservations')->json('data');
    $timeline = $this->getJson('/api/v1/crm/clients/CLI-0005/timeline')->json('data');
    $client = $this->getJson('/api/v1/crm/clients/CLI-0005')->json('data');

    expect($reservations)->not->toBeEmpty()
        ->and($reservations[0])->toHaveKeys(['code', 'pax', 'paid', 'total', 'channel'])
        ->and(collect($timeline)->pluck('kind'))->toContain('alta', 'reserva')
        ->and($client)->toHaveKeys(['contacts', 'open_opportunities', 'next_activities', 'satisfaction_detail', 'destinations', 'open_cases', 'cancelled_trips']);
    $this->getJson('/api/v1/crm/clients/CLI-0005/inventada')->assertNotFound();
});

it('createCrmClientsContacts agrega, edita, hace principal y quita contactos', function () {
    actingAsSeed('U01');

    $first = $this->postJson('/api/v1/crm/clients/CLI-0002/contacts', ['name' => 'Úrsula Benavides', 'role' => 'Jefa de RR. HH.', 'email' => 'ursula@mcblanca.com.pe'])->assertCreated()->json('data.id');
    $second = $this->postJson('/api/v1/crm/clients/CLI-0002/contacts', ['name' => 'Pedro Ríos', 'phone' => '987 111 222'])->assertCreated()->json('data.id');

    $contacts = collect($this->getJson('/api/v1/crm/clients/CLI-0002')->json('data.contacts'));
    expect($contacts->firstWhere('id', $first)['is_primary'])->toBeTrue()
        ->and($contacts->firstWhere('id', $second)['is_primary'])->toBeFalse();

    $this->postJson("/api/v1/crm/clients/CLI-0002/contacts/{$second}/make-primary")->assertOk();
    $this->patchJson("/api/v1/crm/clients/CLI-0002/contacts/{$second}", ['name' => 'Pedro Ríos Salas', 'role' => 'Gerente'])->assertOk();
    $this->deleteJson("/api/v1/crm/clients/CLI-0002/contacts/{$second}")->assertNoContent();

    $contacts = collect($this->getJson('/api/v1/crm/clients/CLI-0002')->json('data.contacts'));
    expect($contacts)->toHaveCount(1)
        ->and($contacts->first()['is_primary'])->toBeTrue()
        ->and(collect($this->getJson('/api/v1/crm/clients/CLI-0002/audit')->json('data'))->pluck('action'))->toContain('agregar_contacto', 'contacto_principal', 'quitar_contacto');
    expect($this->postJson('/api/v1/crm/clients/CLI-0002/contacts', ['name' => '']))->toBeApiError(422);
});

it('createCrmClientsCommunications registra el correo y lo encola', function () {
    actingAsSeed('U01');

    $code = $this->postJson('/api/v1/crm/clients/CLI-0005/communications', ['subject' => 'Tu viaje a Cusco', 'body' => 'Te escribimos para confirmar los detalles del viaje.'])->assertCreated()->json('data.code');

    $message = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('code', $code)->first());
    expect($message->status)->toBe('pendiente')
        ->and($message->audience)->toBe('client')
        ->and(collect($this->getJson('/api/v1/crm/clients/CLI-0005/communications')->json('data'))->pluck('code'))->toContain($code);
    Queue::assertPushed(SendNotificationEmail::class);
    expect($this->postJson('/api/v1/crm/clients/CLI-0005/communications', ['subject' => 'Hola', 'body' => 'Texto de prueba', 'recipient' => 'no-es-correo']))->toBeApiError(422);
});

it('las pestañas del cliente respetan la cartera del asesor', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/crm/clients/CLI-0005/reservations'))->toBeApiError(403);
});
