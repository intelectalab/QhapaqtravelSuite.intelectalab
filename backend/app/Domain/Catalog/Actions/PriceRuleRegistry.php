<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Support\PricingRules;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

final class PriceRuleRegistry
{
    public function __construct(private readonly AuditLogger $audit, private readonly CodeSequence $codes, private readonly PricingRules $rules) {}

    public function create(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $ref = $this->codes->next('catalog_price_rules', 'PR-', 2, 'ref');
            $values = $this->values($data);
            DB::table('catalog_price_rules')->insert([...$values, 'ref' => $ref, 'status' => 'activa', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->audit->log('Regla de precio', $ref, 'crear', after: $this->summary($values));

            return $ref;
        });
    }

    public function update(string $ref, array $data, User $actor): void
    {
        DB::transaction(function () use ($ref, $data, $actor): void {
            $rule = $this->rules->find($ref);
            $values = $this->values($data);
            DB::table('catalog_price_rules')->where('id', $rule->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Regla de precio', $ref, 'modificar', $this->summary((array) $rule), $this->summary($values));
        });
    }

    public function setActive(string $ref, bool $active, User $actor): void
    {
        DB::transaction(function () use ($ref, $active, $actor): void {
            $rule = $this->rules->find($ref);
            $status = $active ? 'activa' : 'inactiva';
            DB::table('catalog_price_rules')->where('id', $rule->id)->update(['status' => $status, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Regla de precio', $ref, 'cambio_estado', $rule->status, $status);
        });
    }

    public function delete(string $ref, string $reason, User $actor): void
    {
        DB::transaction(function () use ($ref, $reason): void {
            $rule = $this->rules->find($ref);
            DB::table('catalog_price_rules')->where('id', $rule->id)->delete();
            $this->audit->log('Regla de precio', $ref, 'eliminar', $this->summary((array) $rule), $reason);
        });
    }

    private function values(array $data): array
    {
        return [
            'name' => trim($data['name']),
            'kind' => $data['kind'],
            'value' => number_format((float) $data['value'], 4, '.', ''),
            'scope' => trim($data['scope']),
            'channel' => $data['channel'] ?? null,
            'min_pax' => isset($data['min_pax']) ? (int) $data['min_pax'] : null,
            'customer_residency' => $data['residency'] ?? null,
            'product_id' => $data['product_id'] ?? null,
            'currency' => $data['currency'] ?? null,
            'priority' => (int) ($data['priority'] ?? 100),
        ];
    }

    private function summary(array $values): string
    {
        return "{$values['name']} · {$values['kind']} ".rtrim(rtrim((string) $values['value'], '0'), '.')." · {$values['scope']} · prioridad {$values['priority']}";
    }
}
