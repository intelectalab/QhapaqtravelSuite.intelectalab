<?php

declare(strict_types=1);

namespace App\Domain\Booking\Data;

final readonly class RuleSet
{
    public function __construct(
        private array $rules,
        private string $plan,
        private array $planOrder = ['Starter', 'Professional', 'Enterprise'],
    ) {}

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

    public function withPlan(string $plan): self
    {
        return new self($this->rules, $plan, $this->planOrder);
    }

    public function summary(): array
    {
        $out = [];
        foreach ($this->rules as $code => $r) {
            $out[$code] = ['enabled' => $r['enabled'], 'effective' => $this->on($code)];
        }

        return $out;
    }
}
