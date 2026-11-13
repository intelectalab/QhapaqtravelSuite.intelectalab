<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

function claimsContractAudited(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

beforeEach(fn () => lockTreasury());

it('GET /treasury/movements pagina por cursor y filtra por cuenta, dirección y fechas', function () {
    actingAsSeed('U07');

    $page = $this->getJson('/api/v1/treasury/movements?filter[account]=CTA-01&page[size]=5')->assertOk()->json();
    $out = $this->getJson('/api/v1/treasury/movements?filter[direction]=out&filter[from]=2026-01-01&page[size]=100')->assertOk()->json('data');

    expect($page['data'])->not->toBeEmpty()
        ->and(collect($page['data'])->pluck('account.code')->unique()->all())->toBe(['CTA-01'])
        ->and($page['meta'])->toHaveKeys(['per_page', 'next_cursor'])
        ->and(collect($out)->pluck('direction')->unique()->reject(fn ($direction) => $direction === 'out')->all())->toBe([]);
    expect($this->getJson('/api/v1/treasury/movements?filter[direction]=lateral'))->toBeApiError(422);
});

it('GET /crm/claim-book/{id} muestra la hoja por código, número de libro o 404', function () {
    actingAsSeed('U02');

    $this->getJson('/api/v1/crm/claim-book/REC-0021')->assertOk()->assertJsonPath('data.book_number', 'LR-CUS-2026-000011');
    $this->getJson('/api/v1/crm/claim-book/LR-CUS-2026-000011')->assertOk()->assertJsonPath('data.code', 'REC-0021');
    expect($this->getJson('/api/v1/crm/claim-book/REC-9999'))->toBeApiError(404);
});

it('GET /crm/claim-book/settings y /reports devuelven parámetros y la relación agrupada', function () {
    actingAsSeed('U02');

    expect($this->getJson('/api/v1/crm/claim-book/settings')->assertOk()->json('data'))->toHaveKeys(['response_days', 'alert_days', 'retention_years', 'holidays']);
    $report = $this->getJson('/api/v1/crm/claim-book/reports?group=sede&year=2026')->assertOk()->json('data');

    expect($report['group'])->toBe('sede')
        ->and(collect($report['rows'])->sum('total'))->toBe($report['total'])
        ->and($report['total'])->toBeGreaterThan(0);
    expect($this->getJson('/api/v1/crm/claim-book/reports?group=canal'))->toBeApiError(422);
});

it('GET /crm/claim-book/{id}/certificate genera la constancia PDF y responde la URL firmada', function () {
    Storage::fake('local');
    Storage::disk('local')->buildTemporaryUrlsUsing(fn (string $path, DateTimeInterface $expiration): string => "https://archivos.prueba/{$path}");
    actingAsSeed('U02');

    $data = $this->getJson('/api/v1/crm/claim-book/REC-0018/certificate')->assertOk()->json('data');

    expect($data['file_name'])->toBe('constancia-LR-CUS-2026-000010.pdf')
        ->and($data['url'])->toStartWith('https://archivos.prueba/')
        ->and(claimsContractAudited(['entity' => 'Libro de reclamaciones', 'entity_id' => 'LR-CUS-2026-000010', 'action' => 'descargar_constancia']))->toBeTrue();
});

it('POST /crm/claim-book/exports genera la relación anual y queda auditada', function () {
    Storage::fake('local');
    actingAsSeed('U02');

    $data = $this->postJson('/api/v1/crm/claim-book/exports', ['year' => 2026, 'format' => 'CSV'], critical())->assertStatus(202)->json('data');

    expect($data['status'])->toBe('disponible')
        ->and($data['rows'])->toBeGreaterThan(0)
        ->and(claimsContractAudited(['entity' => 'Exportación', 'entity_id' => $data['code'], 'action' => 'exportar']))->toBeTrue();

    actingAsSeed('U07');
    $response = $this->postJson('/api/v1/crm/claim-book/exports', ['year' => 2026], critical());
    expect($response)->toBeApiError(403)->and($response->json('required_permissions'))->toContain('crm.claims.manage');
});

it('PATCH /crm/claim-book/{id}/links vincula y desvincula cliente y reserva', function () {
    actingAsSeed('U02');
    $reservation = withinTenant(tenantA(), fn () => DB::table('booking_reservations as b')->join('crm_cases as k', 'k.client_id', '=', 'b.client_id')->where('k.code', 'REC-0020')->whereNull('b.deleted_at')->value('b.code'));

    $this->patchJson('/api/v1/crm/claim-book/REC-0020/links', ['client' => null, 'reservation' => null])->assertOk()->assertJsonPath('data.client', null);
    expect(rowOf('crm_cases', 'REC-0020')->client_id)->toBeNull();

    if ($reservation !== null) {
        $this->patchJson('/api/v1/crm/claim-book/REC-0020/links', ['client' => null, 'reservation' => $reservation])->assertOk()->assertJsonPath('data.reservation', $reservation);
    }

    expect(claimsContractAudited(['entity' => 'Libro de reclamaciones', 'entity_id' => 'LR-LIM-2026-000007', 'action' => 'vincular']))->toBeTrue();
    expect($this->patchJson('/api/v1/crm/claim-book/REC-0015/links', ['client' => null, 'reservation' => null]))->toBeApiError(409, 'LR-STATE');
});

it('el cliente registra una hoja desde el portal y la ve en "Mis hojas"; el pasajero solo ve las suyas', function () {
    actingAsSeed('U14');
    $sede = (string) withinTenant(tenantA(), fn () => DB::table('iam_sedes')->where('status', 'activa')->orderBy('code')->value('id'));

    $created = $this->postJson('/api/v1/portal/claim-book', [
        'name' => 'Gabriela Ríos Montoya',
        'doc_type' => 'DNI',
        'doc_number' => '45879632',
        'phone' => '987654321',
        'address' => 'Av. Larco 123, Miraflores',
        'sede_id' => $sede,
        'good_kind' => 'servicio',
        'good_description' => 'Tour al Valle Sagrado',
        'type' => 'queja',
        'detail' => 'El guía llegó con una hora de retraso al punto de encuentro.',
        'request' => 'Que se tomen medidas con el proveedor.',
        'declaration' => true,
    ], critical())->assertCreated()->json('data');

    expect($created['channel'])->toBe('customer_portal')
        ->and(rowOf('crm_cases', $created['code'])->client_id)->toBe(seedUser('U14')->client_id);
    expect(collect($this->getJson('/api/v1/portal/claim-book?page[size]=100')->assertOk()->json('data'))->pluck('number'))->toContain($created['number']);

    actingAsSeed('U15');
    expect(collect($this->getJson('/api/v1/portal/claim-book')->assertOk()->json('data'))->pluck('number'))->not->toContain($created['number']);
});
