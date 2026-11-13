<?php

use Illuminate\Support\Facades\DB;

beforeEach(fn () => lockShowcase());

if (! function_exists('vitrinaTenantAudit')) {
    function vitrinaTenantAudit(array $where): bool
    {
        return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
    }
}

function vitrinaListingPayload(array $extra = []): array
{
    return [
        'title' => 'Free tour de murales en Barranco',
        'city' => 'lima',
        'zone' => 'Barranco',
        'theme' => 'Arte urbano',
        'languages' => ['es', 'en'],
        'start_times' => ['10:00', '16:00'],
        'duration_hours' => 2,
        'meeting_point' => 'Parque Municipal de Barranco, frente a la biblioteca',
        'model' => 'propina',
        'capacity' => 18,
        'highlights' => ['Puente de los Suspiros', 'Murales de la bajada de baños'],
        'own_content' => true,
        ...$extra,
    ];
}

it('la agencia ve sus publicaciones, su plan y los beneficios; otro tenant no ve nada', function () {
    actingAsSeed('U01');
    $data = $this->getJson('/api/v1/channels/showcase/listings')->assertOk()->json('data');

    expect($data['agency']['code'])->toBe('SHA-01')
        ->and(collect($data['items'])->pluck('code')->all())->toContain('SHL-003')
        ->and($data['plan']['has_plan'])->toBeTrue()
        ->and($data['benefits'])->not->toBeEmpty();

    actingAsTenantBAdmin();
    expect($this->getJson('/api/v1/channels/showcase/listings')->assertOk()->json('data.items'))->toBe([]);
});

it('crear una publicación la envía a revisión y la audita; un tour de pago exige precio', function () {
    actingAsSeed('U02');

    expect($this->postJson('/api/v1/channels/showcase/listings', vitrinaListingPayload(['model' => 'pago', 'price' => 0]), critical()))->toBeApiError(422, 'VT-PRICE');
    $this->postJson('/api/v1/channels/showcase/listings', vitrinaListingPayload(['own_content' => false]), critical())->assertStatus(422)->assertJsonValidationErrors('own_content');

    $code = $this->postJson('/api/v1/channels/showcase/listings', vitrinaListingPayload(), critical())->assertOk()->json('data.code');
    $row = DB::connection('pgsql_platform')->table('platform_showcase_listings')->where('code', $code)->first();

    expect($row->status)->toBe('en_revision')
        ->and($row->slug)->toBe('free-tour-de-murales-en-barranco')
        ->and(vitrinaTenantAudit(['entity' => 'Vitrina', 'entity_id' => $code, 'action' => 'enviar_revision']))->toBeTrue();
});

it('editar vuelve a revisión y pausar o reanudar cambia la visibilidad', function () {
    actingAsSeed('U01');

    $this->patchJson('/api/v1/channels/showcase/listings/SHL-003', ['action' => 'pausar'])->assertOk()->assertJsonPath('data.status', 'despublicado');
    $this->patchJson('/api/v1/channels/showcase/listings/SHL-003', ['action' => 'reanudar'])->assertOk()->assertJsonPath('data.status', 'publicado');
    $this->patchJson('/api/v1/channels/showcase/listings/SHL-003', ['meeting_point' => 'Plaza San Martín, junto al monumento central'])->assertOk()->assertJsonPath('data.status', 'en_revision');

    expect(DB::connection('pgsql_platform')->table('platform_showcase_listings')->where('code', 'SHL-003')->value('meeting_point'))->toBe('Plaza San Martín, junto al monumento central');
    $this->patchJson('/api/v1/channels/showcase/listings/SHL-001', ['action' => 'pausar'])->assertNotFound();
});

it('marca asistencia desde el día de la salida y no permite repetirla', function () {
    actingAsSeed('U01');
    $bookings = collect($this->getJson('/api/v1/channels/showcase/bookings')->assertOk()->json('data.items'));
    $future = $bookings->firstWhere('code', 'SHB-0143');

    expect($future['can_mark'])->toBeFalse();
    expect($this->postJson('/api/v1/channels/showcase/bookings/SHB-0143/attendance', ['status' => 'asistio']))->toBeApiError(422, 'VT-ATTENDANCE');

    DB::connection('pgsql_platform')->table('platform_showcase_bookings')->where('code', 'SHB-0143')->update(['service_date' => '2026-09-29']);
    $this->postJson('/api/v1/channels/showcase/bookings/SHB-0143/attendance', ['status' => 'no_show'])->assertOk()->assertJsonPath('data.status', 'no_show');
    expect($this->postJson('/api/v1/channels/showcase/bookings/SHB-0143/attendance', ['status' => 'asistio']))->toBeApiError(409, 'VT-ATTENDANCE')
        ->and(vitrinaTenantAudit(['entity' => 'Vitrina reserva', 'entity_id' => 'SHB-0143', 'action' => 'asistencia']))->toBeTrue();
});

it('resume cargos y comisiones por mes', function () {
    actingAsSeed('U01');
    $fees = $this->getJson('/api/v1/channels/showcase/fees')->assertOk()->json('data');

    expect($fees['plan'])->toBe('enterprise')
        ->and($fees['months'])->not->toBeEmpty()
        ->and($fees['months'][0])->toHaveKeys(['bookings', 'attendees', 'commissions', 'total']);
});

it('sin channels.showcase.manage la vitrina responde 403 con el permiso requerido', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/channels/showcase/listings'))->toBeApiError(403)
        ->and($this->getJson('/api/v1/channels/showcase/listings')->json('required_permissions'))->toContain('channels.showcase.manage');
});
