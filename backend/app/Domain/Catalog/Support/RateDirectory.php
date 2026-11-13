<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class RateDirectory
{
    public const TYPES = ['Proveedor', 'Costo', 'Venta', 'Retail', 'B2B', 'Mayorista', 'Corporativa', 'VIP', 'Promocional', 'Especial', 'Grupal'];

    public const SEGMENTS = ['Adulto', 'Niño', 'Infante', 'Pasajero', 'Grupo'];

    public const CHANNELS = ['Directo', 'B2B', 'Corporativo', 'E-commerce', 'Mayorista', 'Todos'];

    public const BASES = ['Por persona', 'Precio fijo', 'Por grupo', 'Por habitación', 'Por unidad'];

    public const SEASON_TYPES = ['Alta', 'Media', 'Baja', 'Feriado', 'Fecha especial', 'Personalizada'];

    private const NET_TYPES = ['Proveedor', 'Costo', 'B2B', 'Mayorista'];

    private const NET_CHANNELS = ['B2B', 'Mayorista'];

    public static function state(object $rate, string $today): string
    {
        return match (true) {
            $rate->status === 'inactiva' => 'inactiva',
            $rate->valid_to < $today => 'vencida',
            $rate->valid_from > $today => 'programada',
            default => 'vigente',
        };
    }

    public static function isNet(string $type, string $channel): bool
    {
        return in_array($type, self::NET_TYPES, true) || in_array($channel, self::NET_CHANNELS, true);
    }

    public static function withoutNet(Builder $query): Builder
    {
        return $query->whereNotIn('r.rate_type', self::NET_TYPES)->whereNotIn('r.channel', self::NET_CHANNELS);
    }

    public static function rateQuery(): Builder
    {
        return DB::table('catalog_rates as r')
            ->join('catalog_products as p', 'p.id', '=', 'r.product_id')
            ->leftJoin('catalog_seasons as s', 's.id', '=', 'r.season_id')
            ->whereNull('p.deleted_at')
            ->select(['r.*', 'p.code as product_code', 'p.name as product_name', 'p.status as product_status', 's.ref as season_ref', 's.name as season_name']);
    }

    public static function presentRate(object $rate, string $today, bool $seesCost, bool $seesMargin): array
    {
        return [
            'id' => $rate->id,
            'ref' => $rate->ref,
            'product' => ['id' => $rate->product_id, 'code' => $rate->product_code, 'name' => $rate->product_name, 'status' => $rate->product_status ?? null],
            'type' => $rate->rate_type,
            'segment' => $rate->segment,
            'channel' => $rate->channel,
            'currency' => trim($rate->currency),
            'basis' => $rate->price_basis,
            'cost' => $seesCost ? $rate->cost : null,
            'price' => $rate->price,
            'min_price' => $rate->min_price,
            'max_price' => $rate->max_price,
            'margin_pct' => $seesMargin ? CatalogAccess::marginPct($rate->price, $rate->cost) : null,
            'valid_from' => $rate->valid_from,
            'valid_to' => $rate->valid_to,
            'season' => $rate->season_id ? ['id' => $rate->season_id, 'ref' => $rate->season_ref, 'name' => $rate->season_name] : null,
            'conditions' => $rate->conditions,
            'status' => $rate->status,
            'state' => self::state($rate, $today),
            'lock_version' => (int) $rate->lock_version,
        ];
    }

    public static function presentSeason(object $season, string $today, int $rates, int $products): array
    {
        return [
            'id' => $season->id,
            'ref' => $season->ref,
            'name' => $season->name,
            'type' => $season->type,
            'date_from' => $season->date_from,
            'date_to' => $season->date_to,
            'priority' => (int) $season->priority,
            'factor' => (float) $season->factor,
            'status' => $season->status,
            'phase' => match (true) {
                $season->date_to < $today => 'pasada',
                $season->date_from > $today => 'proxima',
                default => 'en_curso',
            },
            'rates' => $rates,
            'products' => $products,
        ];
    }

    public static function seasonUsage(): array
    {
        return [
            DB::table('catalog_rates')->whereNotNull('season_id')->selectRaw('season_id, count(*) as total')->groupBy('season_id')->pluck('total', 'season_id'),
            DB::table('catalog_product_seasons')->selectRaw('season_id, count(*) as total')->groupBy('season_id')->pluck('total', 'season_id'),
        ];
    }

    public function overview(User $viewer): array
    {
        $today = CatalogAccess::today();
        $seesCost = CatalogAccess::seesCost($viewer);
        $seesMargin = CatalogAccess::seesMargin($viewer);
        $seesNet = CatalogAccess::seesNetRates($viewer);
        $seasons = $this->seasons($today);

        $rates = self::rateQuery()->orderBy('p.name')->orderBy('r.ref')->get()
            ->filter(fn (object $rate) => $seesNet || ! self::isNet($rate->rate_type, $rate->channel))
            ->map(fn (object $rate) => self::presentRate($rate, $today, $seesCost, $seesMargin))
            ->values();

        return [
            'today' => $today,
            'rates' => $rates,
            'seasons' => $seasons,
            'overlaps' => $this->overlaps($seasons),
            'current_season' => $seasons->first(fn (array $season) => $season['status'] === 'activa' && $season['date_from'] <= $today && $season['date_to'] >= $today),
            'options' => [
                'products' => DB::table('catalog_products')->whereNull('deleted_at')->where('status', '<>', 'ARCHIVED')->orderBy('name')->get(['id', 'code', 'name']),
                'types' => $seesNet ? self::TYPES : array_values(array_diff(self::TYPES, self::NET_TYPES)),
                'segments' => self::SEGMENTS,
                'channels' => $seesNet ? self::CHANNELS : array_values(array_diff(self::CHANNELS, self::NET_CHANNELS)),
                'bases' => self::BASES,
                'currencies' => CatalogAccess::CURRENCIES,
                'season_types' => self::SEASON_TYPES,
            ],
            'can' => [
                'manage' => $viewer->can('catalog.products.manage_rates'),
                'see_cost' => $seesCost,
                'see_margin' => $seesMargin,
            ],
        ];
    }

    public function seasons(string $today): Collection
    {
        [$rates, $products] = self::seasonUsage();

        return DB::table('catalog_seasons')->whereNull('deleted_at')->orderBy('date_from')->orderBy('priority')->get()
            ->map(fn (object $season) => self::presentSeason($season, $today, (int) ($rates[$season->id] ?? 0), (int) ($products[$season->id] ?? 0)));
    }

    public function overlaps(Collection $seasons): array
    {
        $active = $seasons->where('status', 'activa')->values();
        $pairs = [];

        foreach ($active as $index => $a) {
            foreach ($active->slice($index + 1) as $b) {
                if ($a['date_from'] <= $b['date_to'] && $b['date_from'] <= $a['date_to']) {
                    $winner = $a['priority'] <= $b['priority'] ? $a : $b;
                    $pairs[] = [
                        'a' => $a['ref'],
                        'b' => $b['ref'],
                        'from' => max($a['date_from'], $b['date_from']),
                        'to' => min($a['date_to'], $b['date_to']),
                        'winner' => $winner['ref'],
                    ];
                }
            }
        }

        return $pairs;
    }
}
