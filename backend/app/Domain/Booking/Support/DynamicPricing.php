<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Booking\Inventory\DatabaseInventoryReader;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Growth\DynamicPricing\DynamicPriceCalculator;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class DynamicPricing
{
    public const RULE = 'R-DYNAMIC-PRICING';

    private const CHANNELS = ['Directo' => 'interno', 'Corporativo' => 'interno', 'Todos' => 'interno', 'B2B' => 'b2b', 'Mayorista' => 'b2b', 'E-commerce' => 'web'];

    private ?array $rules = null;

    private array $occupancy = [];

    public function __construct(
        private readonly RuleResolver $resolver,
        private readonly DynamicPriceCalculator $calculator,
        private readonly DatabaseInventoryReader $inventory,
        private readonly TenantContext $context,
    ) {}

    public static function channelFor(string $rateChannel): string
    {
        return self::CHANNELS[$rateChannel] ?? 'interno';
    }

    public function adjust(string $productId, string $date, string $channel, string $price): ?array
    {
        if (! $this->resolver->on(self::RULE)) {
            return null;
        }

        $candidates = array_values(array_filter($this->rules(), fn (array $rule): bool => $rule['basis'] !== 'demanda' && ($rule['product_id'] === null || $rule['product_id'] === $productId) && in_array($channel, $rule['channels'], true)));

        if ($candidates === []) {
            return null;
        }

        $needsOccupancy = in_array('ocupacion', array_column($candidates, 'basis'), true);
        $result = $this->calculator->calculate($candidates, $price, [
            'date' => $date,
            'today' => CarbonImmutable::now($this->context->timezone())->toDateString(),
            'channel' => $channel,
            'occupancy' => $needsOccupancy ? $this->occupancy($productId, $date) : 0,
            'demand' => 0,
            'product_id' => $productId,
        ]);

        if ($result['applied'] === []) {
            return null;
        }

        return [
            'channel' => $channel,
            'base_price' => $result['base_price'],
            'price' => $result['final_price'],
            'pct' => $result['final_pct'],
            'cumulative_pct' => $result['cumulative_pct'],
            'clamped' => $result['clamped'],
            'rules' => array_map(fn (array $rule): array => ['code' => $rule['code'], 'name' => $rule['name'], 'basis' => $rule['basis'], 'adjust_pct' => $rule['adjust_pct']], $result['applied']),
        ];
    }

    public static function label(?array $dynamic): ?string
    {
        if ($dynamic === null) {
            return null;
        }

        $pct = (float) $dynamic['pct'];
        $sign = $pct > 0 ? '+' : '';

        return implode(' · ', array_column($dynamic['rules'], 'name')).' ('.$sign.rtrim(rtrim($dynamic['pct'], '0'), '.').' %)';
    }

    private function rules(): array
    {
        return $this->rules ??= DB::table('catalog_dynamic_price_rules')->where('active', true)->orderBy('priority')->orderBy('code')->get()
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'name' => $row->name,
                'product_id' => $row->product_id === null ? null : (string) $row->product_id,
                'basis' => $row->basis,
                'conditions' => (array) json_decode((string) $row->conditions, true),
                'adjust_pct' => (string) $row->adjust_pct,
                'floor_pct' => (string) $row->floor_pct,
                'ceiling_pct' => (string) $row->ceiling_pct,
                'priority' => (int) $row->priority,
                'channels' => array_values(array_filter(explode(',', trim((string) $row->channels, '{}')))),
                'valid_from' => $row->valid_from,
                'valid_to' => $row->valid_to,
                'active' => true,
            ])->all();
    }

    private function occupancy(string $productId, string $date): float
    {
        $key = "{$productId}|{$date}";

        if (! array_key_exists($key, $this->occupancy)) {
            $this->occupancy[$key] = $this->measure($productId, $date);
        }

        return $this->occupancy[$key];
    }

    private function measure(string $productId, string $date): float
    {
        $departures = DB::table('catalog_product_departures')->where('product_id', $productId)->where('departure_date', $date)->where('status', '<>', 'cancelada')
            ->selectRaw('coalesce(sum(capacity), 0) as capacity, coalesce(sum(sold), 0) as sold')->first();

        if ($departures !== null && (int) $departures->capacity > 0) {
            return self::ratio((int) $departures->sold + $this->inventory->heldOn($productId, $date), (int) $departures->capacity);
        }

        $ranges = DB::table('catalog_availability_ranges')->where('product_id', $productId)->whereNull('deleted_at')
            ->where('date_from', '<=', $date)->where('date_to', '>=', $date)->get(['status', 'capacity_per_day']);

        if ($ranges->contains('status', 'agotado')) {
            return 1.0;
        }

        $capacity = (int) $ranges->where('status', 'disponible')->max('capacity_per_day');

        return $capacity > 0 ? self::ratio($this->inventory->soldOn($productId, $date) + $this->inventory->heldOn($productId, $date), $capacity) : 0.0;
    }

    private static function ratio(int $used, int $capacity): float
    {
        return round(max(0, min(1, $used / $capacity)), 4);
    }
}
