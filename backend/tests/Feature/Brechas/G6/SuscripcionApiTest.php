<?php

use App\Domain\Admin\Support\IpRange;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => lockPlatformBilling());

it('la suscripción trae los intentos de cobro, el «Facturar a» de cada factura y la disponibilidad de los complementos', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/billing/subscription')->assertOk()->json('data');
    $invoice = $data['invoices'][0];
    $addon = collect($data['addon_catalog'])->firstWhere('code', 'b2b_full');

    expect($invoice)->toHaveKeys(['attempts', 'bill_to', 'sunat_hash'])
        ->and($addon['available_in'])->toContain('Professional')
        ->and($addon['included_in'])->toContain('Enterprise')
        ->and($addon['description'])->not->toBeNull()
        ->and($addon['feature'])->not->toBeNull();
});

it('acepta IP y rangos CIDR válidos en las llaves de API y rechaza rangos con bits de host', function () {
    actingAsSeed('U01');

    $code = $this->postJson('/api/v1/integrations/api-keys', ['name' => 'ERP con rango', 'environment' => 'test', 'scopes' => ['catalog:read'], 'ips' => ['200.48.22.17', '161.132.8.0/24', '2001:db8::/32']], critical())->assertCreated()->json('data.code');
    $key = collect($this->getJson('/api/v1/admin/api')->assertOk()->json('data.keys'))->firstWhere('code', $code);

    expect($key['ips'])->toContain('161.132.8.0/24')
        ->and(collect($this->getJson('/api/v1/admin/api')->json('data.key_history'))->pluck('entity_id'))->toContain($code);

    $this->postJson('/api/v1/integrations/api-keys', ['name' => 'ERP con rango malo', 'environment' => 'test', 'scopes' => ['catalog:read'], 'ips' => ['161.132.8.5/24']], critical())->assertStatus(422)->assertJsonValidationErrors('ips.0');
});

it('valida direcciones y rangos de IP', function (string $value, bool $valid) {
    expect(IpRange::valid($value))->toBe($valid);
})->with([
    'IPv4' => ['10.0.0.1', true],
    'red /24' => ['10.0.0.0/24', true],
    'host con máscara' => ['10.0.0.1/24', false],
    'máscara fuera de rango' => ['10.0.0.0/33', false],
    'IPv6 /64' => ['2001:db8:1::/64', true],
    'texto' => ['intranet', false],
]);

it('cada webhook informa el tope de fallos y la última rotación del secreto', function () {
    actingAsSeed('U01');
    $hook = (string) withinTenant(tenantA(), fn () => DB::table('integration_webhooks')->where('status', 'active')->orderBy('code')->value('code'));

    $this->postJson("/api/v1/integrations/webhooks/{$hook}/rotate-secret", [], critical())->assertOk();
    $row = collect($this->getJson('/api/v1/admin/api')->assertOk()->json('data.webhooks'))->firstWhere('code', $hook);

    expect($row['failure_limit'])->toBe(10)
        ->and($row['rotated_at'])->not->toBeNull();
});
