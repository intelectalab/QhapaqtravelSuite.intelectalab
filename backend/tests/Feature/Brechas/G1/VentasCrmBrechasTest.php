<?php

use App\Domain\Booking\Rules\RuleResolver;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

function g1Lead(array $extra = []): string
{
    return (string) test()->postJson('/api/v1/crm/leads', [
        'name' => 'Brecha G1 '.Str::random(5),
        'email' => 'g1.'.Str::lower(Str::random(10)).'@prueba.pe',
        'channel' => 'web',
        'source' => 'formulario_web',
        'interest' => 'paquete',
        'pax' => 2,
        ...$extra,
    ])->assertCreated()->json('data.code');
}

function g1Qualify(string $code): void
{
    test()->postJson("/api/v1/crm/leads/{$code}/qualify", ['budget' => 25, 'authority' => 25, 'need' => 18, 'timeline' => 18, 'mark_qualified' => true, 'lock_version' => (int) rowOf('crm_leads', $code)->lock_version])->assertOk();
}

function g1Convert(string $code, array $body): array
{
    return test()->postJson("/api/v1/crm/leads/{$code}/convert", [
        'opportunity_title' => 'Conversión G1', 'amount' => 2500, 'currency' => 'PEN', 'expected_close_date' => '2026-12-20',
        'lock_version' => (int) rowOf('crm_leads', $code)->lock_version,
        ...$body,
    ], critical())->assertOk()->json('data');
}

it('G1-01: la vista previa de la cotización devuelve el itinerario resumido de los productos elegidos', function () {
    actingAsSeed('U03');

    $body = [
        'client_code' => 'CLI-0003', 'title' => 'Itinerario G1', 'currency' => 'USD', 'travel_from' => '2026-09-30', 'travel_to' => '2026-10-04',
        'pax_adt' => 2, 'pax_chd' => 0, 'pax_inf' => 0, 'discount_pct' => 0, 'tax_pct' => 18,
        'items' => [['product_code' => 'CUS-PKG-5D4N', 'date' => '2026-09-30', 'qty' => 1, 'pax' => 2, 'segment' => 'Adulto', 'unit_price' => '500.00']],
    ];
    $itinerary = $this->postJson('/api/v1/quotes/pricing/preview', $body)->assertOk()->json('data.itinerary');

    expect($itinerary)->toHaveCount(1)
        ->and($itinerary[0]['product']['code'])->toBe('CUS-PKG-5D4N')
        ->and($itinerary[0]['start'])->toBe('2026-09-30')
        ->and($itinerary[0])->toHaveKey('days');
});

it('G1-02: cada versión de la cotización trae su itinerario, sus condiciones y su aprobación interna', function () {
    actingAsSeed('U01');
    $code = withinTenant(tenantA(), fn () => DB::table('quote_quotes')->whereNull('deleted_at')->orderBy('code')->value('code'));

    $versions = $this->getJson("/api/v1/quotes/{$code}")->assertOk()->json('data.versions');

    expect($versions)->not->toBeEmpty()
        ->and($versions[0])->toHaveKeys(['itinerary', 'conditions', 'markup_pct', 'internal_status', 'notes', 'snapshot']);
});

it('G1-23: la reserva web marca las reglas que hoy están inactivas y la ficha avisa si R-PAX-FEEDBACK está apagada', function () {
    actingAsSeed('U01');
    $tenant = tenantA();
    $code = withinTenant($tenant, function (): string {
        $reservation = DB::table('booking_reservations')->whereNull('deleted_at')->where('code', 'RES-2026-000350')->first(['id', 'code', 'travel_from']);
        DB::table('booking_reservation_web_snapshots')->insert(['id' => (string) Str::uuid7(), 'reservation_id' => $reservation->id, 'product_id' => DB::table('catalog_products')->value('id'), 'service_date' => $reservation->travel_from, 'pax_adt' => 2, 'pax_chd' => 0, 'pax_inf' => 0, 'currency_display' => 'PEN', 'charge_currency' => 'PEN', 'fx_rate' => 1, 'lines' => '[]', 'total' => 0, 'payment_mode' => 'total', 'comments' => 'Celebramos un aniversario', 'rules_applied' => '{R-COMMENTS}']);

        return (string) $reservation->code;
    });

    expect($this->getJson("/api/v1/reservations/{$code}/web-snapshot")->assertOk()->json('data.rules_inactive'))->not->toContain('R-COMMENTS');

    withinTenant($tenant, fn () => DB::table('sys_booking_rules')->whereIn('code', ['R-COMMENTS', 'R-PAX-FEEDBACK'])->update(['enabled' => false]));
    RuleResolver::invalidate((string) $tenant->id);

    expect($this->getJson("/api/v1/reservations/{$code}/web-snapshot")->assertOk()->json('data.rules_inactive'))->toContain('R-COMMENTS')
        ->and($this->getJson("/api/v1/reservations/{$code}")->assertOk()->json('data.pax_feedback_on'))->toBeFalse();
});

it('G1-19: al vincular un cliente existente el correo del lead queda como contacto no principal y la etapa por defecto es descubrimiento', function () {
    actingAsSeed('U02');
    $code = g1Lead(['owner_id' => seedUser('U03')->id]);
    g1Qualify($code);
    $email = rowOf('crm_leads', $code)->email;

    $result = g1Convert($code, ['client_mode' => 'existing', 'client_code' => 'CLI-0003']);
    $client = rowOf('crm_clients', 'CLI-0003');
    $contact = withinTenant(tenantA(), fn () => DB::table('crm_client_contacts')->where('client_id', $client->id)->where('email', $email)->first());

    expect(rowOf('crm_opportunities', $result['opportunity'])->stage)->toBe('descubrimiento')
        ->and($contact)->not->toBeNull()
        ->and((bool) $contact->is_primary)->toBeFalse();

    $again = g1Lead(['email' => $email, 'owner_id' => seedUser('U03')->id, 'duplicate_resolution' => 'create_new']);
    g1Qualify($again);
    g1Convert($again, ['client_mode' => 'existing', 'client_code' => 'CLI-0003']);

    expect(withinTenant(tenantA(), fn () => DB::table('crm_client_contacts')->where('client_id', $client->id)->where('email', $email)->count()))->toBe(1);
});

it('G1-19: una empresa nueva toma a la persona del lead como contacto principal y el segmento sugerido sale del lead', function () {
    actingAsSeed('U02');
    $code = g1Lead(['owner_id' => seedUser('U03')->id, 'pax' => 12, 'company' => 'Grupo G1 SAC']);
    g1Qualify($code);
    $lead = rowOf('crm_leads', $code);

    $result = g1Convert($code, ['kind' => 'empresa', 'name' => 'Grupo G1 SAC', 'doc_type' => 'RUC', 'doc_number' => '20'.random_int(100000000, 999999999)]);
    $client = rowOf('crm_clients', $result['client']);
    $contact = withinTenant(tenantA(), fn () => DB::table('crm_client_contacts')->where('client_id', $client->id)->first());

    expect($client->segment_code)->toBe('Grupos')
        ->and($contact->name)->toBe($lead->full_name)
        ->and((bool) $contact->is_primary)->toBeTrue();
});

it('G1-25: los destinos visitados suman las oportunidades ganadas y se agrupan por departamento', function () {
    actingAsSeed('U01');
    $client = rowOf('crm_clients', 'CLI-0005');
    withinTenant(tenantA(), fn () => DB::table('crm_opportunities')->where('client_id', $client->id)->whereNull('deleted_at')->limit(1)->update(['stage' => 'ganada', 'probability' => 100, 'closed_at' => now(), 'destination_label' => 'Destino G1 / Varios']));

    $destinations = collect($this->getJson('/api/v1/crm/clients/CLI-0005')->assertOk()->json('data.destinations'));

    expect($destinations->firstWhere('name', 'Destino G1'))->toMatchArray(['trips' => 0, 'won' => 1])
        ->and($destinations->pluck('name'))->not->toContain('Varios')
        ->and($destinations->first())->toHaveKeys(['name', 'trips', 'won']);
})->skip(fn () => withinTenant(tenantA(), fn () => DB::table('crm_opportunities')->where('client_id', rowOf('crm_clients', 'CLI-0005')->id)->whereNull('deleted_at')->doesntExist()), 'El cliente semilla no tiene oportunidades.');

it('G1-13: postventa ofrece las reservas de cada cliente y el responsable de cada viaje', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/crm/after-sales')->assertOk()->json('data');

    expect($data['reservations'])->not->toBeEmpty()
        ->and($data['reservations'][0])->toHaveKeys(['value', 'label', 'hint', 'client'])
        ->and(collect($data['trips'])->every(fn (array $trip): bool => array_key_exists('owner_id', $trip)))->toBeTrue();
});

it('G1-13: Ventas solo ve en la lista las reservas de los clientes de su cartera', function () {
    actingAsSeed('U03');
    $clients = collect($this->getJson('/api/v1/crm/after-sales')->assertOk()->json('data.clients'))->pluck('value');
    $reservations = collect($this->getJson('/api/v1/crm/after-sales')->json('data.reservations'));

    expect($reservations->pluck('client')->unique()->diff($clients))->toBeEmpty();
});

it('G1-14: el panel de gerencia trae las cotizaciones fuera de política que el usuario puede aprobar', function () {
    actingAsSeed('U02');

    $home = $this->getJson('/api/v1/dashboard/home')->assertOk()->json('data');
    $manager = $home['data']['manager'] ?? null;

    expect($manager)->not->toBeNull()
        ->and($manager)->toHaveKey('quote_approvals');
    foreach ($manager['quote_approvals'] as $item) {
        expect($item['type'])->toBe('quote')->and($item['can_decide'])->toBeTrue()->and($item)->toHaveKeys(['target', 'version_no', 'lock_version']);
    }
});
