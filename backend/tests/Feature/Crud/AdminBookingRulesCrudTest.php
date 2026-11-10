<?php

use App\Domain\Admin\Support\RuleDirectory;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

function adminRule(string $code): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->where('code', $code)->first());
}

function adminNewRule(array $overrides = []): TestResponse
{
    return test()->postJson('/api/v1/admin/booking-rules', ['name' => 'Seguro obligatorio de viaje', 'description' => 'Exige seguro para viajes de aventura', 'group' => adminRuleGroup(), ...$overrides], critical());
}

function adminRuleGroup(): string
{
    return RuleDirectory::GROUPS[0];
}

function adminRuleAudit(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Regla de reserva', 'entity_id' => $code, 'action' => $action])->exists());
}

it('crea una regla personalizada inactiva, la lista y la audita', function () {
    actingAsSeed('U01');

    $code = adminNewRule()->assertCreated()->json('data.code');
    $rule = adminRule($code);
    $listed = collect($this->getJson('/api/v1/admin/booking-rules')->assertOk()->json('data.rules'))->firstWhere('code', $code);

    expect($code)->toBe('R-X-SEGURO-OBLIGATORIO-DE-VI')
        ->and((bool) $rule->enabled)->toBeFalse()
        ->and((bool) $rule->is_custom)->toBeTrue()
        ->and($rule->rule_group)->toBe(adminRuleGroup())
        ->and($rule->min_plan)->toBe('Starter')
        ->and($listed)->not->toBeNull()
        ->and(adminRuleAudit($code, 'crear'))->toBeTrue();
});

it('dos reglas con el mismo nombre reciben códigos distintos', function () {
    actingAsSeed('U01');

    $first = adminNewRule()->assertCreated()->json('data.code');
    $second = adminNewRule()->assertCreated()->json('data.code');

    expect($second)->not->toBe($first)->toEndWith('-2');
});

it('la regla nueva exige Idempotency-Key y valida sus campos', function (array $body, string $field) {
    actingAsSeed('U01');

    adminNewRule($body)->assertStatus(422)->assertJsonValidationErrors($field);
})->with([
    'nombre corto' => [['name' => 'ab'], 'name'],
    'descripción corta' => [['description' => 'corta'], 'description'],
    'grupo inexistente' => [['group' => 'otro'], 'group'],
]);

it('sin Idempotency-Key no se crea la regla', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/admin/booking-rules', ['name' => 'Regla sin llave', 'description' => 'No debería crearse', 'group' => adminRuleGroup()]))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');
});

it('elimina una regla personalizada inactiva con If-Match y deja de listarse', function () {
    actingAsSeed('U01');
    $code = adminNewRule()->json('data.code');

    $this->deleteJson("/api/v1/admin/booking-rules/{$code}")->assertStatus(428);
    $this->deleteJson("/api/v1/admin/booking-rules/{$code}", [], critical((int) adminRule($code)->lock_version))->assertOk();

    expect(adminRule($code))->toBeNull()
        ->and(collect($this->getJson('/api/v1/admin/booking-rules')->json('data.rules'))->pluck('code'))->not->toContain($code)
        ->and(adminRuleAudit($code, 'eliminar'))->toBeTrue();
});

it('CR-04: no se elimina una regla estándar ni una personalizada activa', function () {
    actingAsSeed('U01');
    $code = adminNewRule()->json('data.code');
    $this->patchJson("/api/v1/admin/booking-rules/{$code}", ['enabled' => true], critical((int) adminRule($code)->lock_version))->assertOk();

    expect($this->deleteJson("/api/v1/admin/booking-rules/{$code}", [], critical((int) adminRule($code)->lock_version)))->toBeApiError(422, 'CR-04')
        ->and($this->deleteJson('/api/v1/admin/booking-rules/R-LODGING', [], critical((int) adminRule('R-LODGING')->lock_version)))->toBeApiError(422, 'CR-04');
    expect(adminRule($code))->not->toBeNull()
        ->and(adminRule('R-LODGING'))->not->toBeNull();
});

it('eliminar con una versión vieja responde 409 y no borra', function () {
    actingAsSeed('U01');
    $code = adminNewRule()->json('data.code');
    $stale = (int) adminRule($code)->lock_version;
    $this->patchJson("/api/v1/admin/booking-rules/{$code}", ['enabled' => true], critical($stale))->assertOk();
    $this->patchJson("/api/v1/admin/booking-rules/{$code}", ['enabled' => false], critical((int) adminRule($code)->lock_version))->assertOk();

    expect($this->deleteJson("/api/v1/admin/booking-rules/{$code}", [], critical($stale))->status())->toBe(409);
    expect(adminRule($code))->not->toBeNull();
});

it('solo quien gestiona la configuración crea o elimina reglas', function () {
    actingAsSeed('U02');

    expect(adminNewRule())->toBeApiError(403)
        ->and($this->deleteJson('/api/v1/admin/booking-rules/R-LODGING', [], critical(1)))->toBeApiError(403);
});
