<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Catalog\Actions\ProductPromotions;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class PromotionDirectory
{
    public function all(): array
    {
        $rows = $this->query()->get();
        $uses = $this->uses($rows->pluck('promo_code')->filter()->unique()->values()->all());
        $today = CatalogAccess::today();

        return [
            'rows' => $rows->map(fn (object $row): array => $this->row($row, $uses, $today))->values()->all(),
            'products' => DB::table('catalog_products')->whereNull('deleted_at')->whereNotIn('status', ['ARCHIVED'])->orderBy('name')->get(['code', 'name', 'status'])->all(),
            'kinds' => ProductPromotions::KINDS,
            'percent_kinds' => ProductPromotions::PERCENT_KINDS,
            'channels' => ProductPromotions::CHANNELS,
            'max_percent' => ProductPromotions::MAX_PERCENT,
            'today' => $today,
        ];
    }

    public function forProduct(string $code): array
    {
        $productId = DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->value('id')
            ?? throw ApiException::notFound('El producto no existe.');
        $rows = $this->query()->where('p.product_id', $productId)->get();
        $uses = $this->uses($rows->pluck('promo_code')->filter()->unique()->values()->all());
        $today = CatalogAccess::today();

        return $rows->map(fn (object $row): array => $this->row($row, $uses, $today))->values()->all();
    }

    private function query(): Builder
    {
        return DB::table('catalog_product_promotions as p')
            ->join('catalog_products as c', 'c.id', '=', 'p.product_id')
            ->whereNull('p.deleted_at')
            ->orderByDesc('p.date_to')
            ->orderBy('p.ref')
            ->select(['p.ref', 'p.name', 'p.kind', 'p.value', 'p.channel', 'p.promo_code', 'p.min_pax', 'p.date_from', 'p.date_to', 'p.status', 'p.updated_at', 'c.code as product_code', 'c.name as product_name', 'c.status as product_status']);
    }

    private function uses(array $codes): array
    {
        if ($codes === []) {
            return [];
        }

        return DB::table('channel_ecom_orders')->whereIn(DB::raw('upper(promo_code)'), $codes)->groupBy(DB::raw('upper(promo_code)'))->selectRaw('upper(promo_code) as code, count(*) as n')->pluck('n', 'code')->map(fn ($n): int => (int) $n)->all();
    }

    private function row(object $row, array $uses, string $today): array
    {
        $state = match (true) {
            $row->status !== 'activa' => 'pausada',
            $row->date_to < $today => 'vencida',
            $row->date_from > $today => 'programada',
            default => 'vigente',
        };

        return [
            'ref' => $row->ref,
            'name' => $row->name,
            'kind' => $row->kind,
            'value' => (float) $row->value,
            'percent' => in_array($row->kind, ProductPromotions::PERCENT_KINDS, true),
            'label' => ProductPromotions::label($row->kind, (string) $row->value),
            'channel' => $row->channel,
            'promo_code' => $row->promo_code,
            'min_pax' => $row->min_pax === null ? null : (int) $row->min_pax,
            'valid_from' => $row->date_from,
            'valid_to' => $row->date_to,
            'status' => $row->status,
            'state' => $state,
            'uses' => $row->promo_code ? ($uses[strtoupper($row->promo_code)] ?? 0) : null,
            'product' => ['code' => $row->product_code, 'name' => $row->product_name, 'status' => $row->product_status],
        ];
    }
}
