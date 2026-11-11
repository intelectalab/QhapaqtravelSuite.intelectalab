<?php

use App\Domain\Admin\Support\RuleTemplates;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

function sectionRules(): array
{
    return withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->pluck('enabled', 'code')->map(fn ($enabled) => (bool) $enabled)->all());
}

it('las reglas traen las plantillas por tipo de negocio con su diferencia contra la configuración actual', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/admin/booking-rules')->assertOk()->json('data');
    $templates = collect($data['templates']);

    expect($templates->pluck('code')->all())->toBe(array_keys(RuleTemplates::TEMPLATES))
        ->and($templates->first())->toHaveKeys(['name', 'description', 'active', 'inactive', 'enable', 'disable', 'blocked'])
        ->and($data)->toHaveKey('template_applied');
});

it('CR-03: aplicar una plantilla solo cambia el estado de las reglas estándar, lo audita y queda como aplicada', function () {
    actingAsSeed('U01');
    $preview = collect($this->getJson('/api/v1/admin/booking-rules')->json('data.templates'))->firstWhere('code', 'aventura');
    $params = withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->orderBy('code')->pluck('params', 'code')->all());

    $result = $this->postJson('/api/v1/admin/booking-rules/apply-template', ['template' => 'aventura'], critical())->assertOk()->json('data');
    $rules = sectionRules();

    expect($result['enabled'])->toBe(array_column($preview['enable'], 'code'))
        ->and($result['disabled'])->toBe(array_column($preview['disable'], 'code'));

    foreach ($result['enabled'] as $code) {
        expect($rules[$code])->toBeTrue();
    }

    foreach ($result['disabled'] as $code) {
        expect($rules[$code])->toBeFalse();
    }

    $after = $this->getJson('/api/v1/admin/booking-rules')->json('data');

    expect(withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->orderBy('code')->pluck('params', 'code')->all()))->toBe($params)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Regla de reserva', 'entity_id' => 'aventura', 'action' => 'aplicar_plantilla'])->exists()))->toBeTrue()
        ->and($after['template_applied']['code'])->toBe('aventura')
        ->and(collect($after['templates'])->firstWhere('code', 'aventura')['enable'])->toBe([])
        ->and(collect($after['templates'])->firstWhere('code', 'aventura')['disable'])->toBe([]);
});

it('CR-03: aplicar dos veces la misma plantilla no cambia nada y una plantilla inexistente no se acepta', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/admin/booking-rules/apply-template', ['template' => 'b2b'], critical())->assertOk();

    expect($this->postJson('/api/v1/admin/booking-rules/apply-template', ['template' => 'b2b'], critical()))->toBeApiError(422, 'CR-03');
    $this->postJson('/api/v1/admin/booking-rules/apply-template', ['template' => 'crucero'], critical())->assertStatus(422)->assertJsonValidationErrors('template');
});

it('operaciones no aplica plantillas de reglas', function () {
    actingAsSeed('U05');

    expect($this->postJson('/api/v1/admin/booking-rules/apply-template', ['template' => 'b2b'], critical()))->toBeApiError(403);
    $this->getJson('/api/v1/admin/booking-rules/audit')->assertForbidden()->assertJsonPath('required_permissions', ['admin.settings.manage']);
});

it('el historial de reglas lista sus cambios del más reciente al más antiguo y filtra por acción', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/admin/booking-rules/apply-template', ['template' => 'minorista'], critical())->assertOk();

    $page = $this->getJson('/api/v1/admin/booking-rules/audit?page[size]=100')->assertOk()->json();
    $filtered = collect($this->getJson('/api/v1/admin/booking-rules/audit?filter[action]=aplicar_plantilla')->assertOk()->json('data'));

    expect($page['data'][0]['action'])->toBe('aplicar_plantilla')
        ->and($page['data'][0]['entity_id'])->toBe('minorista')
        ->and(collect($page['data'])->pluck('entity')->unique()->diff(['Regla de reserva', 'Producto'])->all())->toBe([])
        ->and($filtered->pluck('action')->unique()->all())->toBe(['aplicar_plantilla'])
        ->and($page['meta'])->toHaveKey('next_cursor');
});

it('los mensajes al pasajero se listan por estado y canal sin mezclar agencias', function () {
    actingAsSeed('U01');
    $codesA = withinTenant(tenantA(), fn () => DB::table('notif_pax_messages')->pluck('code')->all());

    $all = collect($this->getJson('/api/v1/notifications/pax-messages?page[size]=100')->assertOk()->json('data'));
    $scheduled = collect($this->getJson('/api/v1/notifications/pax-messages?filter[status]=programado&page[size]=100')->assertOk()->json('data'));
    $email = collect($this->getJson('/api/v1/notifications/pax-messages?filter[channel]=email&page[size]=100')->assertOk()->json('data'));

    expect($codesA)->not->toBeEmpty()
        ->and($all->count())->toBe(min(100, count($codesA)))
        ->and($all->first())->toHaveKeys(['reservation', 'template_name', 'channel', 'recipient', 'status', 'scheduled_at', 'sent_at', 'read_at', 'attempts', 'at'])
        ->and($scheduled->pluck('status')->unique()->diff(['programado'])->all())->toBe([])
        ->and($email->pluck('channel')->unique()->diff(['email'])->all())->toBe([]);

    actingAsSeed('U05');
    $this->getJson('/api/v1/notifications/pax-messages')->assertOk();

    actingAsTenantBAdmin();
    $json = json_encode($this->getJson('/api/v1/notifications/pax-messages?page[size]=100')->assertOk()->json());

    foreach ($codesA as $code) {
        expect($json)->not->toContain('"'.$code.'"');
    }
});

it('ventas no ve los mensajes al pasajero', function () {
    actingAsSeed('U03');

    $this->getJson('/api/v1/notifications/pax-messages')->assertForbidden()->assertJsonPath('required_permissions', ['admin.settings.manage', 'operations.assign']);
});

it('la API de la agencia trae el consumo mensual de llamadas y la versión vigente', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/admin/api')->assertOk()->json('data');

    expect($data['calls_history'])->toBeArray()
        ->and(count($data['calls_history']))->toBeLessThanOrEqual(6)
        ->and($data['api_version'])->toBeString();

    if ($data['calls_history'] !== []) {
        expect(end($data['calls_history'])['value'])->toBe($data['calls_month']);
    }
});
