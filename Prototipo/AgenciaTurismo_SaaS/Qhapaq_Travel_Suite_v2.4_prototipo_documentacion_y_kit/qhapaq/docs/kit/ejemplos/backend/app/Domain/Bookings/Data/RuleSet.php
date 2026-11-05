<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Data;

/**
 * Reglas efectivas del centro de reglas, ya resueltas para un tenant (objeto PURO, sin BD).
 * Lo construye RuleResolver (producción) o RuleSet::fromArray (pruebas con kit-ia/seeds/settings.json › bookingRules).
 *
 * Regla efectiva (spec 17 §3.1 v2.2; prototipo `BE.on`):
 *     on(code, producto) = existe ? (enabled ∧ plan_allows(code) ∧ ¬(product_override ∧ override.disabled)) : true
 *  - Regla inexistente ⇒ true (el prototipo no bloquea comportamientos sin regla registrada).
 *  - Regla fuera del plan ⇒ false aunque enabled = true; la configuración se conserva (PLN-R-01).
 *  - Un producto solo puede DESACTIVAR una regla del tenant, nunca activarla (CAT-RL-02 / CR-02).
 * Parámetros: override del producto (si la regla admite override) ‖ parámetros del tenant.
 */
final readonly class RuleSet
{
    /**
     * @param  array<string, array{enabled:bool, params:array<string,mixed>, product_override:bool, min_plan:?string}>  $rules
     * @param  list<string>  $planOrder
     */
    public function __construct(
        private array $rules,
        private string $plan,
        private array $planOrder = ['Starter', 'Professional', 'Enterprise'],
    ) {
    }

    /**
     * Desde el formato de semillas (`id`, `enabled`, `params`, `productOverride`, `minPlan`).
     *
     * @param  list<array<string, mixed>>  $rules
     * @param  list<string>  $planOrder
     */
    public static function fromArray(array $rules, string $plan, array $planOrder = ['Starter', 'Professional', 'Enterprise']): self
    {
        $map = [];
        foreach ($rules as $r) {
            $code = (string) ($r['id'] ?? $r['code']);
            $map[$code] = [
                'enabled' => (bool) ($r['enabled'] ?? false),
                'params' => (array) ($r['params'] ?? []),
                'product_override' => (bool) ($r['productOverride'] ?? $r['product_override'] ?? false),
                'min_plan' => $r['minPlan'] ?? $r['min_plan'] ?? null,
            ];
        }

        return new self($map, $plan, $planOrder);
    }

    public function planAllows(string $code): bool
    {
        $min = $this->rules[$code]['min_plan'] ?? null;
        if ($min === null) {
            return true;
        }
        $have = array_search($this->plan, $this->planOrder, true);
        $need = array_search($min, $this->planOrder, true);

        return $have !== false && $need !== false && $have >= $need;
    }

    public function on(string $code, ?ProductData $product = null): bool
    {
        $rule = $this->rules[$code] ?? null;
        if ($rule === null) {
            return true;
        }
        if (! $rule['enabled'] || ! $this->planAllows($code)) {
            return false;
        }

        return ! ($product !== null && $rule['product_override'] && ($product->ruleOverrides[$code] ?? null) === false);
    }

    public function param(string $code, string $key, ?ProductData $product = null): mixed
    {
        $rule = $this->rules[$code] ?? null;
        $override = ($product !== null && ($rule['product_override'] ?? false)) ? ($product->ruleParams[$code][$key] ?? null) : null;

        return $override ?? ($rule['params'][$key] ?? null);
    }

    /** Lista para `GET /admin/booking-rules?plan=…` (vista previa por plan: no cambia la suscripción). */
    public function withPlan(string $plan): self
    {
        return new self($this->rules, $plan, $this->planOrder);
    }

    /** @return array<string, array{enabled:bool, effective:bool}> */
    public function summary(): array
    {
        $out = [];
        foreach ($this->rules as $code => $r) {
            $out[$code] = ['enabled' => $r['enabled'], 'effective' => $this->on($code)];
        }

        return $out;
    }
}
