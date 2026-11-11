<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class B2bRateDirectory
{
    public function publicPrice(string $productId): ?object
    {
        return $this->rates($productId)->first(fn (object $rate): bool => $rate->rate_type !== 'B2B' && $rate->channel !== 'B2B');
    }

    public function generalB2b(string $productId): ?object
    {
        return $this->rates($productId)->first(fn (object $rate): bool => $rate->rate_type === 'B2B' || $rate->channel === 'B2B');
    }

    public function forProduct(string $productId): array
    {
        return $this->assignments()->where('r.product_id', $productId)->get()->map(fn (object $row): array => $this->assignment($row))->values()->all();
    }

    public function forAgency(string $agencyId): array
    {
        return $this->assignments()->where('r.agency_id', $agencyId)->get()->map(fn (object $row): array => $this->assignment($row))->values()->all();
    }

    public function overview(): array
    {
        $products = DB::table('catalog_products')->whereNull('deleted_at')->whereNotIn('status', ['ARCHIVED'])
            ->where(fn ($query) => $query->where('is_b2b', true)->orWhereExists(fn ($sub) => $sub->from('catalog_product_b2b_rates as r')->whereColumn('r.product_id', 'catalog_products.id')->whereNull('r.deleted_at')))
            ->orderBy('name')->get(['id', 'code', 'name', 'status', 'is_b2b']);
        $byProduct = [];
        foreach ($this->assignments()->whereIn('r.product_id', $products->pluck('id')->all())->get() as $row) {
            $byProduct[(string) $row->product_id][] = $this->assignment($row);
        }

        $rows = [];
        foreach ($products as $product) {
            $public = $this->publicPrice((string) $product->id);
            $general = $this->generalB2b((string) $product->id);
            $rows[] = [
                'code' => $product->code,
                'name' => $product->name,
                'status' => $product->status,
                'public' => $public ? ['price' => (float) $public->price, 'currency' => $public->currency] : null,
                'general' => $general ? ['price' => (float) $general->price, 'currency' => $general->currency] : null,
                'assignments' => $byProduct[(string) $product->id] ?? [],
            ];
        }

        return [
            'products' => $rows,
            'agencies' => DB::table('channel_b2b_agencies as a')->join('channel_b2b_price_lists as l', 'l.id', '=', 'a.price_list_id')->whereNull('a.deleted_at')->orderBy('a.legal_name')
                ->get(['a.code', 'a.legal_name', 'a.status', 'a.commission_pct', 'a.credit_limit', 'a.credit_currency', 'a.valid_to', 'l.name as price_list'])
                ->map(fn (object $agency): array => ['code' => $agency->code, 'name' => $agency->legal_name, 'status' => $agency->status, 'commission_pct' => (float) $agency->commission_pct, 'credit' => (float) $agency->credit_limit > 0, 'currency' => $agency->credit_currency, 'valid_to' => $agency->valid_to, 'price_list' => $agency->price_list])
                ->values()->all(),
        ];
    }

    public function priceLists(): array
    {
        return DB::table('channel_b2b_price_lists as l')
            ->leftJoin('channel_b2b_agencies as a', fn ($join) => $join->on('a.price_list_id', '=', 'l.id')->whereNull('a.deleted_at'))
            ->groupBy('l.id', 'l.name', 'l.year', 'l.status')
            ->orderBy('l.name')
            ->selectRaw('l.name, l.year, l.status, count(a.id) as agencies')
            ->get()
            ->map(fn (object $row): array => ['name' => $row->name, 'year' => $row->year === null ? null : (int) $row->year, 'status' => $row->status, 'agencies' => (int) $row->agencies])
            ->all();
    }

    private function rates(string $productId): Collection
    {
        $today = CatalogAccess::today();

        return DB::table('catalog_rates')->where('product_id', $productId)->where('status', 'vigente')
            ->where('valid_from', '<=', $today)->where('valid_to', '>=', $today)
            ->whereIn('segment', ['Adulto', 'Pasajero'])->whereNotIn('rate_type', ['Proveedor', 'Costo'])
            ->orderBy('price')
            ->get(['price', 'cost', 'currency', 'rate_type', 'channel']);
    }

    private function assignments(): Builder
    {
        return DB::table('catalog_product_b2b_rates as r')
            ->join('catalog_products as p', 'p.id', '=', 'r.product_id')
            ->join('channel_b2b_agencies as a', 'a.id', '=', 'r.agency_id')
            ->whereNull('r.deleted_at')
            ->orderBy('a.legal_name')
            ->select(['r.product_id', 'r.price', 'r.currency', 'r.commission_pct', 'r.is_credit', 'r.valid_to', 'r.price_list', 'r.conditions', 'r.restrictions', 'p.code as product_code', 'p.name as product_name', 'a.code as agency_code', 'a.legal_name as agency_name', 'a.status as agency_status']);
    }

    private function assignment(object $row): array
    {
        return [
            'product' => ['code' => $row->product_code, 'name' => $row->product_name],
            'agency' => ['code' => $row->agency_code, 'name' => $row->agency_name, 'status' => $row->agency_status],
            'net_price' => (float) $row->price,
            'currency' => $row->currency,
            'commission_pct' => (float) $row->commission_pct,
            'credit_allowed' => (bool) $row->is_credit,
            'valid_to' => $row->valid_to,
            'expired' => $row->valid_to !== null && $row->valid_to < CatalogAccess::today(),
            'price_list' => $row->price_list,
            'conditions' => $row->conditions,
            'restrictions' => $row->restrictions,
        ];
    }
}
