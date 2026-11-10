<?php

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

function intHookBody(array $overrides = []): array
{
    return ['url' => 'https://93.184.216.34/qhapaq/hooks', 'description' => 'Sincroniza reservas con el ERP', 'events' => ['reservation.confirmed', 'payment.applied'], ...$overrides];
}

function intHookCodes(): array
{
    return collect(test()->getJson('/api/v1/integrations/webhooks')->assertOk()->json('data'))->pluck('code')->all();
}

function intHookUsage(): int
{
    return (int) collect(test()->getJson('/api/v1/billing/subscription')->assertOk()->json('data.usage'))->firstWhere('metric', 'webhooks')['used'];
}

function intHookAudit(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Webhook', 'entity_id' => $code, 'action' => $action])->exists());
}

it('crear un webhook lo deja activo, entrega el secreto una sola vez y cuenta en el uso del plan', function () {
    actingAsSeed('U01');
    $usage = intHookUsage();

    $data = $this->postJson('/api/v1/integrations/webhooks', intHookBody())->assertCreated()->json('data');
    $row = rowOf('integration_webhooks', $data['code']);

    expect($data['code'])->toBe('WH-0004')
        ->and($data['secret'])->toStartWith('whsec_')
        ->and($row->status)->toBe('active')
        ->and($row->url)->toBe('https://93.184.216.34/qhapaq/hooks')
        ->and($row->events)->toBe('{reservation.confirmed,payment.applied}')
        ->and($row->secret_prefix)->toBe(substr($data['secret'], 0, 10))
        ->and(Crypt::decryptString($row->secret_encrypted))->toBe($data['secret'])
        ->and(intHookCodes())->toContain('WH-0004')
        ->and(collect($this->getJson('/api/v1/integrations/webhooks')->json('data'))->firstWhere('code', 'WH-0004')['secret'])->toBe(substr($data['secret'], 0, 10).'••••')
        ->and(intHookUsage())->toBe($usage + 1)
        ->and(intHookAudit('WH-0004', 'crear'))->toBeTrue();
});

it('API-BR-05 / API-BR-06: la URL debe ser https pública y los eventos de la lista', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/integrations/webhooks', intHookBody(['url' => 'http://93.184.216.34/qhapaq']))->assertStatus(422)->assertJsonValidationErrors(['url']);
    $this->postJson('/api/v1/integrations/webhooks', intHookBody(['url' => 'https://localhost/hook']))->assertStatus(422)->assertJsonValidationErrors(['url']);
    $this->postJson('/api/v1/integrations/webhooks', intHookBody(['url' => 'https://erp.empresa.internal/hook']))->assertStatus(422)->assertJsonValidationErrors(['url']);
    $this->postJson('/api/v1/integrations/webhooks', intHookBody(['url' => 'https://10.0.0.5/hook']))->assertStatus(422)->assertJsonValidationErrors(['url']);
    $this->postJson('/api/v1/integrations/webhooks', intHookBody(['events' => ['factura.pagada']]))->assertStatus(422)->assertJsonValidationErrors(['events.0']);
    $this->postJson('/api/v1/integrations/webhooks', intHookBody(['events' => []]))->assertStatus(422)->assertJsonValidationErrors(['events']);

    expect(intHookCodes())->toBe(['WH-0001', 'WH-0002', 'WH-0003']);
});

it('eliminar un webhook es lógico: deja de figurar, deja de contar en el plan y no se elimina dos veces', function () {
    actingAsSeed('U01');
    $usage = intHookUsage();

    $this->deleteJson('/api/v1/integrations/webhooks/WH-0002')->assertOk()->assertJsonPath('data.code', 'WH-0002');

    $row = rowOf('integration_webhooks', 'WH-0002');
    expect($row->status)->toBe('deleted')
        ->and($row->deleted_at)->not->toBeNull()
        ->and(intHookCodes())->not->toContain('WH-0002')
        ->and(intHookUsage())->toBe($usage - 1)
        ->and(intHookAudit('WH-0002', 'eliminar'))->toBeTrue()
        ->and($this->deleteJson('/api/v1/integrations/webhooks/WH-0002'))->toBeApiError(404)
        ->and($this->patchJson('/api/v1/integrations/webhooks/WH-0002', ['status' => 'paused']))->toBeApiError(404);
});

it('API-BR-04: al llegar al límite del plan no se crean más webhooks y eliminar uno libera el cupo', function () {
    actingAsSeed('U01');
    for ($i = 4; $i <= 20; $i++) {
        $this->postJson('/api/v1/integrations/webhooks', intHookBody(['url' => "https://93.184.216.34/qhapaq/hook-{$i}"]))->assertCreated();
    }

    expect($this->postJson('/api/v1/integrations/webhooks', intHookBody(['url' => 'https://93.184.216.34/qhapaq/extra'])))->toBeApiError(409, 'API-BR-04');

    $this->deleteJson('/api/v1/integrations/webhooks/WH-0003')->assertOk();
    $this->postJson('/api/v1/integrations/webhooks', intHookBody(['url' => 'https://93.184.216.34/qhapaq/extra']))->assertCreated()->assertJsonPath('data.code', 'WH-0021');
});

it('solo la Administración crea o elimina webhooks', function (string $user) {
    actingAsSeed($user);

    expect($this->postJson('/api/v1/integrations/webhooks', intHookBody()))->toBeApiError(403)
        ->and($this->deleteJson('/api/v1/integrations/webhooks/WH-0001'))->toBeApiError(403)
        ->and(rowOf('integration_webhooks', 'WH-0001')->status)->toBe('active');
})->with(['U02', 'U07']);
