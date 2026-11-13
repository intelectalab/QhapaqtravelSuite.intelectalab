<?php

declare(strict_types=1);

namespace App\Domain\Growth\DynamicPricing;

use App\Domain\Growth\Shared\GrowthRules;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class DynamicPriceRules
{
    public const PERMISSION = 'catalog.products.dynamic_pricing';

    public function __construct(
        private readonly GrowthRules $rules,
        private readonly DynamicPriceCalculator $calculator,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function index(Request $request): array
    {
        $filters = CursorPage::filters($request);
        $query = $this->query()
            ->when(isset($filters['active']), fn ($query) => $query->where('r.active', in_array($filters['active'], ['1', 'true'], true)))
            ->when($filters['basis'] ?? null, fn ($query, $basis) => $query->where('r.basis', $basis))
            ->when($filters['product'] ?? null, fn ($query, $product) => $query->where('p.code', $product));
        $counts = DB::table('catalog_dynamic_price_rules')->selectRaw('count(*) as total, count(*) filter (where active) as active')->first();

        return CursorPage::respond($request, $query, ['priority' => 'r.priority', 'code' => 'r.code', 'updated_at' => 'r.updated_at'], 'priority,code', fn (object $row): array => $this->present($row), [
            'enabled' => $this->rules->enabled('R-DYNAMIC-PRICING'),
            'counts' => ['total' => (int) $counts->total, 'active' => (int) $counts->active, 'inactive' => (int) $counts->total - (int) $counts->active],
            'catalogs' => ['bases' => DynamicPriceCalculator::BASES, 'channels' => DynamicPriceCalculator::CHANNELS, 'conditions' => DynamicPriceCalculator::CONDITION_KEYS],
            'products' => DB::table('catalog_products')->whereNull('deleted_at')->whereIn('status', ['ACTIVE', 'APPROVED', 'DRAFT'])->orderBy('name')->limit(500)->get(['code', 'name'])->map(fn (object $row): array => ['value' => $row->code, 'label' => $row->name])->all(),
        ]);
    }

    public function create(array $data, User $actor): array
    {
        $this->rules->ensure('R-DYNAMIC-PRICING', self::PERMISSION);
        $values = $this->values($data, null);

        return DB::transaction(function () use ($values, $actor): array {
            $code = $this->sequences->next('dynamic_price_rule');
            DB::table('catalog_dynamic_price_rules')->insert([...$values, 'id' => (string) Str::uuid7(), 'code' => $code, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->audit->log('Precio dinámico', $code, 'crear', null, "{$values['name']} · {$values['adjust_pct']} %", ['despues' => $this->auditable($values)]);

            return $this->find($code);
        });
    }

    public function update(string $code, array $data, User $actor): array
    {
        $this->rules->ensure('R-DYNAMIC-PRICING', self::PERMISSION);

        return DB::transaction(function () use ($code, $data, $actor): array {
            $rule = DB::table('catalog_dynamic_price_rules')->where('code', $code)->lock('for no key update')->first() ?? throw ApiException::notFound('La regla de precio no existe.');
            $current = $this->current($rule);
            $before = $this->values([], $current);
            $values = $this->values($data, $current);
            $changed = array_filter($values, fn ($value, string $field): bool => (string) $value !== (string) $before[$field], ARRAY_FILTER_USE_BOTH);

            if ($changed !== []) {
                DB::table('catalog_dynamic_price_rules')->where('id', $rule->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
                $action = array_keys($changed) === ['active'] ? ($values['active'] ? 'activar' : 'desactivar') : 'editar';
                $this->audit->log('Precio dinámico', $code, $action, $before['active'] ? 'activa' : 'inactiva', $values['active'] ? 'activa' : 'inactiva', [
                    'antes' => $this->auditable(array_intersect_key($before, $changed)),
                    'despues' => $this->auditable($changed),
                ]);
            }

            return $this->find($code);
        });
    }

    public function simulate(array $data): array
    {
        $product = null;

        if (! empty($data['product'])) {
            $product = DB::table('catalog_products')->whereNull('deleted_at')->where('code', $data['product'])->first(['id', 'code', 'name']) ?? throw ApiException::notFound('El producto no existe.');
        }

        [$base, $currency] = $this->basePrice($product?->id, $data);
        $rules = $this->query()->get()->map(fn (object $row): array => $this->current($row) + ['code' => $row->code])->all();
        $result = $this->calculator->calculate($rules, $base, [
            'date' => $data['date'],
            'today' => Carbon::now($this->context->timezone())->toDateString(),
            'channel' => $data['channel'],
            'occupancy' => $data['occupancy'] ?? 0,
            'demand' => $data['demand'] ?? 0,
            'product_id' => $product?->id,
            'include_inactive' => (bool) ($data['include_inactive'] ?? false),
        ]);

        return [...$result, 'currency' => $currency, 'product' => $product === null ? null : ['code' => $product->code, 'name' => $product->name], 'date' => $data['date'], 'channel' => $data['channel']];
    }

    private function basePrice(?string $productId, array $data): array
    {
        if (! empty($data['base_price'])) {
            return [(string) $data['base_price'], (string) ($data['currency'] ?? 'PEN')];
        }

        if ($productId === null) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un producto o escribe el precio base.', ['field' => 'base_price']);
        }

        $rate = DB::table('catalog_rates')->where('product_id', $productId)->where('status', 'vigente')->whereIn('segment', ['Adulto', 'Pasajero'])
            ->where('valid_from', '<=', $data['date'])->where('valid_to', '>=', $data['date'])->orderBy('price')->first(['price', 'currency']);

        if ($rate === null) {
            throw ApiException::unprocessable('DPR-NO-RATE', 'El producto no tiene una tarifa vigente para esa fecha. Escribe el precio base para simular.', ['field' => 'base_price']);
        }

        return [(string) $rate->price, (string) $rate->currency];
    }

    private function values(array $data, ?array $current): array
    {
        $merged = [...($current ?? ['product_id' => null, 'floor_pct' => -30, 'ceiling_pct' => 50, 'priority' => 100, 'channels' => array_keys(DynamicPriceCalculator::CHANNELS), 'valid_from' => null, 'valid_to' => null, 'active' => false]), ...array_diff_key($data, ['product' => true])];

        if (array_key_exists('product', $data)) {
            $merged['product_id'] = $data['product'] === null || $data['product'] === ''
                ? null
                : (DB::table('catalog_products')->whereNull('deleted_at')->where('code', $data['product'])->value('id') ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'El producto no existe.', ['field' => 'product']));
        }

        $conditions = is_array($merged['conditions']) ? $merged['conditions'] : (array) json_decode((string) $merged['conditions'], true);
        $error = $this->calculator->conditionsError((string) $merged['basis'], $conditions);

        if ($error !== null) {
            throw ApiException::unprocessable('VALIDATION_ERROR', $error, ['field' => 'conditions']);
        }

        if ((float) $merged['floor_pct'] > (float) $merged['ceiling_pct']) {
            throw ApiException::unprocessable('SC-12', 'El piso del ajuste no puede superar al techo.', ['field' => 'floor_pct']);
        }

        if ($merged['valid_from'] !== null && $merged['valid_to'] !== null && $merged['valid_to'] < $merged['valid_from']) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La vigencia termina antes de empezar.', ['field' => 'valid_to']);
        }

        $channels = array_values(array_unique((array) $merged['channels']));

        return [
            'name' => (string) $merged['name'],
            'product_id' => $merged['product_id'],
            'basis' => (string) $merged['basis'],
            'conditions' => json_encode($conditions),
            'adjust_pct' => (string) $merged['adjust_pct'],
            'floor_pct' => (string) $merged['floor_pct'],
            'ceiling_pct' => (string) $merged['ceiling_pct'],
            'priority' => (int) $merged['priority'],
            'channels' => '{'.implode(',', $channels).'}',
            'valid_from' => $merged['valid_from'],
            'valid_to' => $merged['valid_to'],
            'active' => (bool) $merged['active'],
        ];
    }

    private function current(object $row): array
    {
        return [
            'name' => $row->name,
            'product_id' => $row->product_id,
            'basis' => $row->basis,
            'conditions' => (array) json_decode((string) $row->conditions, true),
            'adjust_pct' => (string) $row->adjust_pct,
            'floor_pct' => (string) $row->floor_pct,
            'ceiling_pct' => (string) $row->ceiling_pct,
            'priority' => (int) $row->priority,
            'channels' => $this->channels((string) $row->channels),
            'valid_from' => $row->valid_from,
            'valid_to' => $row->valid_to,
            'active' => (bool) $row->active,
        ];
    }

    private function auditable(array $values): array
    {
        return collect($values)->map(fn ($value) => is_string($value) && str_starts_with($value, '{') && ! str_starts_with($value, '{"') ? $this->channels($value) : (is_string($value) && str_starts_with($value, '{"') ? json_decode($value, true) : $value))->all();
    }

    private function channels(string $value): array
    {
        return array_values(array_filter(explode(',', trim($value, '{}'))));
    }

    private function query()
    {
        return DB::table('catalog_dynamic_price_rules as r')->leftJoin('catalog_products as p', 'p.id', '=', 'r.product_id')->select(['r.*', 'p.code as product_code', 'p.name as product_name']);
    }

    private function find(string $code): array
    {
        return $this->present($this->query()->where('r.code', $code)->first() ?? throw ApiException::notFound('La regla de precio no existe.'));
    }

    private function present(object $row): array
    {
        return [
            'code' => $row->code,
            'name' => $row->name,
            'product' => $row->product_code === null ? null : ['code' => $row->product_code, 'name' => $row->product_name],
            'basis' => $row->basis,
            'basis_label' => DynamicPriceCalculator::BASES[$row->basis] ?? $row->basis,
            'conditions' => (array) json_decode((string) $row->conditions, true),
            'adjust_pct' => (string) $row->adjust_pct,
            'floor_pct' => (string) $row->floor_pct,
            'ceiling_pct' => (string) $row->ceiling_pct,
            'priority' => (int) $row->priority,
            'channels' => $this->channels((string) $row->channels),
            'valid_from' => $row->valid_from,
            'valid_to' => $row->valid_to,
            'active' => (bool) $row->active,
            'lock_version' => (int) $row->lock_version,
            'updated_at' => $row->updated_at,
        ];
    }
}
