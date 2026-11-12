<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Catalog\Support\RateDirectory;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProductVersions
{
    private const CHILDREN = ['catalog_product_items', 'catalog_product_inclusions', 'catalog_product_requirements', 'catalog_product_policies', 'catalog_product_destinations', 'catalog_product_faqs', 'catalog_product_media', 'catalog_product_seasons'];

    private const SKIP = ['id', 'tenant_id', 'product_id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'lock_version'];

    public function __construct(private readonly CodeSequence $codes, private readonly AuditLogger $audit) {}

    public function snapshot(string $productId): array
    {
        $product = (array) DB::table('catalog_products')->where('id', $productId)->first();
        $itinerary = DB::table('catalog_itineraries')->where('product_id', $productId)->where('is_default', true)->value('id');
        $days = $itinerary ? DB::table('catalog_itinerary_days')->where('itinerary_id', $itinerary)->orderBy('day_number')->get() : collect();
        $items = $days->isEmpty() ? collect() : DB::table('catalog_itinerary_items')->whereIn('day_id', $days->pluck('id'))->orderByRaw('start_time nulls last')->orderBy('activity')->get()->groupBy('day_id');

        return [
            'product' => self::clean($product),
            'components' => DB::table('catalog_product_items')->where('product_id', $productId)->orderBy('sort_order')->get()->map(fn (object $row): array => self::clean((array) $row))->all(),
            'itinerary' => $days->map(fn (object $day): array => [...self::clean((array) $day), 'items' => collect($items[$day->id] ?? [])->map(fn (object $item): array => self::clean((array) $item))->values()->all()])->all(),
            'rates' => DB::table('catalog_rates')->where('product_id', $productId)->orderBy('ref')->get()->map(fn (object $row): array => self::clean((array) $row))->all(),
            'policies' => self::clean((array) (DB::table('catalog_product_policies')->where('product_id', $productId)->first() ?? [])),
            'inclusions' => DB::table('catalog_product_inclusions')->where('product_id', $productId)->orderBy('kind')->get(['kind', 'text'])->map(fn (object $row): array => (array) $row)->all(),
            'fx_usd' => (string) (DB::table('fin_fx_rates')->where('currency_code', 'USD')->orderByDesc('rate_date')->orderByDesc('effective_at')->value('rate_pen') ?? ''),
        ];
    }

    public function create(string $code, string $kind, string $validFrom, string $reason, User $actor): string
    {
        $product = DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->first(['id', 'code', 'status']) ?? throw ApiException::notFound('El producto no existe.');

        if ($product->status === 'ARCHIVED') {
            throw ApiException::conflict('PRD-ARCHIVED', 'Un producto archivado no se edita ni recibe versiones nuevas.');
        }

        $last = DB::table('catalog_product_versions')->where('product_id', $product->id)->where('status', '<>', 'historica')->orderByDesc('created_at')->value('version')
            ?? DB::table('catalog_product_versions')->where('product_id', $product->id)->orderByDesc('created_at')->value('version') ?? '0.0';
        [$major, $minor] = array_map('intval', explode('.', (string) $last) + [0, 0]);
        $version = $kind === 'major' ? ($major + 1).'.0' : "{$major}.".($minor + 1);

        if (DB::table('catalog_product_versions')->where('product_id', $product->id)->where('version', $version)->exists()) {
            throw ApiException::conflict('CAT-BR-31', "La versión {$version} ya existe.");
        }

        $status = match ($product->status) {
            'DRAFT' => 'borrador',
            'REVIEW' => 'en_revision',
            default => 'vigente',
        };

        return DB::transaction(function () use ($product, $version, $status, $validFrom, $reason, $actor): string {
            DB::table('catalog_product_versions')->where('product_id', $product->id)->where('status', '<>', 'historica')->update(['status' => 'historica']);
            $id = (string) Str::uuid7();
            DB::table('catalog_product_versions')->insert(['id' => $id, 'product_id' => $product->id, 'version' => $version, 'status' => $status, 'valid_from' => $validFrom, 'reason' => $reason, 'snapshot' => json_encode($this->snapshot((string) $product->id), JSON_UNESCAPED_UNICODE), 'created_by' => $actor->getKey()]);
            DB::table('catalog_products')->where('id', $product->id)->update(['current_version_id' => $id, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Producto', $product->code, 'nueva_version', null, "v{$version} · desde {$validFrom} · {$reason}");

            return $version;
        });
    }

    public function show(string $code, string $version): array
    {
        $row = DB::table('catalog_product_versions as v')->join('catalog_products as p', 'p.id', '=', 'v.product_id')->where('p.code', $code)->where('v.version', $version)
            ->first(['v.version', 'v.status', 'v.valid_from', 'v.reason', 'v.snapshot', 'v.created_at']) ?? throw ApiException::notFound('La versión no existe.');

        return ['version' => $row->version, 'status' => $row->status, 'valid_from' => $row->valid_from, 'reason' => $row->reason, 'created_at' => $row->created_at, 'snapshot' => json_decode((string) $row->snapshot, true) ?: []];
    }

    public function compare(string $code, string $from, string $to): array
    {
        $a = self::flatten($this->show($code, $from)['snapshot']);
        $b = self::flatten($this->show($code, $to)['snapshot']);
        $keys = array_unique([...array_keys($a), ...array_keys($b)]);
        sort($keys);

        return ['from' => $from, 'to' => $to, 'changes' => array_values(array_filter(array_map(fn (string $key): ?array => ($a[$key] ?? null) === ($b[$key] ?? null) ? null : ['field' => $key, 'before' => $a[$key] ?? null, 'after' => $b[$key] ?? null], $keys)))];
    }

    public function duplicate(string $code, User $actor): string
    {
        $source = DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->first() ?? throw ApiException::notFound('El producto no existe.');

        return DB::transaction(function () use ($source, $actor): string {
            $n = 1;
            while (DB::table('catalog_products')->whereRaw('lower(code) = ?', [Str::lower("{$source->code}-C".str_pad((string) $n, 2, '0', STR_PAD_LEFT))])->exists()) {
                $n++;
            }

            $newCode = "{$source->code}-C".str_pad((string) $n, 2, '0', STR_PAD_LEFT);
            $id = (string) Str::uuid7();
            $values = array_diff_key((array) $source, array_flip(['id', 'created_at', 'updated_at', 'lock_version', 'current_version_id', 'deleted_at']));
            DB::table('catalog_products')->insert([...$values, 'id' => $id, 'code' => $newCode, 'ref' => $this->codes->next('catalog_products', 'PRD-', 3, 'ref'), 'sku' => $source->sku ? Str::limit("{$source->sku}-C", 40, '') : null, 'name' => Str::limit("{$source->name} (copia)", 200, ''), 'slug' => Str::slug("{$source->name} copia {$newCode}"), 'status' => 'DRAFT', 'is_ecommerce' => false, 'is_b2b' => false, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);

            foreach (self::CHILDREN as $table) {
                foreach (DB::table($table)->where('product_id', $source->id)->get() as $row) {
                    DB::table($table)->insert([...array_diff_key((array) $row, array_flip(self::SKIP)), 'id' => (string) Str::uuid7(), 'product_id' => $id]);
                }
            }

            foreach (DB::table('catalog_rates')->where('product_id', $source->id)->get() as $rate) {
                DB::table('catalog_rates')->insert([...array_diff_key((array) $rate, array_flip(['id', 'tenant_id', 'created_at', 'updated_at', 'lock_version'])), 'id' => (string) Str::uuid7(), 'product_id' => $id, 'ref' => $this->codes->next('catalog_rates', 'TAR-', 3, 'ref'), 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            }

            $this->copyItineraries((string) $source->id, $id);
            DB::table('catalog_product_channels')->insert(['id' => (string) Str::uuid7(), 'product_id' => $id, 'channel' => 'erp', 'is_published' => true, 'published_at' => now(), 'published_by' => $actor->getKey(), 'created_by' => $actor->getKey()]);
            $versionId = (string) Str::uuid7();
            DB::table('catalog_product_versions')->insert(['id' => $versionId, 'product_id' => $id, 'version' => '0.1', 'status' => 'borrador', 'valid_from' => now()->toDateString(), 'reason' => "Copia de {$source->code}", 'snapshot' => json_encode($this->snapshot($id), JSON_UNESCAPED_UNICODE), 'created_by' => $actor->getKey()]);
            DB::table('catalog_products')->where('id', $id)->update(['current_version_id' => $versionId]);
            $this->audit->log('Producto', $newCode, 'duplicar', $source->code, 'borrador');

            return $newCode;
        });
    }

    public function resolveRate(string $code, string $date, string $segment, string $channel, User $viewer): array
    {
        $product = DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->first(['id']) ?? throw ApiException::notFound('El producto no existe.');
        $seasons = DB::table('catalog_seasons')->where('status', 'activa')->where('date_from', '<=', $date)->where('date_to', '>=', $date)->pluck('id')->map(fn ($id): string => (string) $id)->all();
        $rows = DB::table('catalog_rates')->where('product_id', $product->id)->orderBy('ref')->get(['ref', 'rate_type', 'segment', 'channel', 'currency', 'price', 'valid_from', 'valid_to', 'season_id', 'status'])
            ->filter(fn (object $rate) => CatalogAccess::seesNetRates($viewer) || ! RateDirectory::isNet($rate->rate_type, $rate->channel))
            ->map(function (object $rate) use ($date, $segment, $channel, $seasons): array {
                $reason = match (true) {
                    $rate->status !== 'vigente' => 'Inactiva',
                    $rate->valid_to < $date || $rate->valid_from > $date => 'Fuera de vigencia en la fecha',
                    $rate->segment !== $segment => "Es para {$rate->segment}",
                    $rate->channel !== $channel && $rate->channel !== 'Todos' => "Es del canal {$rate->channel}",
                    default => null,
                };

                return ['ref' => $rate->ref, 'type' => $rate->rate_type, 'segment' => $rate->segment, 'channel' => $rate->channel, 'currency' => trim($rate->currency), 'price' => $rate->price, 'selectable' => $reason === null, 'reason' => $reason, 'season' => $rate->season_id !== null && in_array((string) $rate->season_id, $seasons, true)];
            })->values();
        $chosen = $rows->where('selectable', true)->sortByDesc(fn (array $rate): int => $rate['season'] ? 1 : 0)->first();

        return ['date' => $date, 'segment' => $segment, 'channel' => $channel, 'chosen' => $chosen['ref'] ?? null, 'rates' => $rows->all()];
    }

    private function copyItineraries(string $sourceId, string $targetId): void
    {
        foreach (DB::table('catalog_itineraries')->where('product_id', $sourceId)->get() as $itinerary) {
            $newItinerary = (string) Str::uuid7();
            DB::table('catalog_itineraries')->insert([...array_diff_key((array) $itinerary, array_flip(self::SKIP)), 'id' => $newItinerary, 'product_id' => $targetId]);

            foreach (DB::table('catalog_itinerary_days')->where('itinerary_id', $itinerary->id)->get() as $day) {
                $newDay = (string) Str::uuid7();
                DB::table('catalog_itinerary_days')->insert([...array_diff_key((array) $day, array_flip([...self::SKIP, 'itinerary_id'])), 'id' => $newDay, 'itinerary_id' => $newItinerary]);

                foreach (DB::table('catalog_itinerary_items')->where('day_id', $day->id)->get() as $item) {
                    DB::table('catalog_itinerary_items')->insert([...array_diff_key((array) $item, array_flip([...self::SKIP, 'day_id'])), 'id' => (string) Str::uuid7(), 'day_id' => $newDay]);
                }
            }
        }
    }

    private static function clean(array $row): array
    {
        return array_diff_key($row, array_flip(['tenant_id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'lock_version']));
    }

    private static function flatten(array $data, string $prefix = ''): array
    {
        $flat = [];

        foreach ($data as $key => $value) {
            $path = $prefix === '' ? (string) $key : "{$prefix}.{$key}";
            is_array($value) ? $flat += self::flatten($value, $path) : $flat[$path] = is_scalar($value) || $value === null ? $value : json_encode($value);
        }

        return $flat;
    }
}
