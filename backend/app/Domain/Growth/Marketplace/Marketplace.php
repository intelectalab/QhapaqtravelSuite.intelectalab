<?php

declare(strict_types=1);

namespace App\Domain\Growth\Marketplace;

use App\Domain\Growth\Shared\GrowthRules;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class Marketplace
{
    public const CONNECTION = 'pgsql_platform';

    public const LISTING_STATUSES = ['borrador' => 'Borrador', 'publicado' => 'Publicado', 'pausado' => 'Pausado', 'retirado' => 'Retirado'];

    public const PARTNERSHIP_STATUSES = ['solicitada' => 'Solicitada', 'activa' => 'Activa', 'rechazada' => 'Rechazada', 'suspendida' => 'Suspendida', 'terminada' => 'Terminada'];

    public const ORDER_STATUSES = ['solicitada' => 'Solicitada', 'confirmada' => 'Confirmada', 'rechazada' => 'Rechazada', 'cancelada' => 'Cancelada', 'liquidada' => 'Liquidada'];

    public const DECISIONS = ['aceptar', 'rechazar', 'suspender', 'reactivar', 'terminar'];

    public const PERMISSION = 'channels.marketplace.manage';

    public function __construct(
        private readonly GrowthRules $rules,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function listings(array $filters): array
    {
        $me = $this->me();
        $mine = ($filters['scope'] ?? 'network') === 'mine';
        $partnerships = $this->db()->table('platform_marketplace_partnerships')->where('reseller_tenant_id', $me)->pluck('status', 'seller_tenant_id');
        $rows = $this->db()->table('platform_marketplace_listings as l')->join('tenants as t', 't.id', '=', 'l.seller_tenant_id')
            ->when($mine, fn ($query) => $query->where('l.seller_tenant_id', $me), fn ($query) => $query->where('l.seller_tenant_id', '<>', $me)->where('l.status', 'publicado'))
            ->when($filters['destination'] ?? null, fn ($query, $destination) => $query->whereRaw('lower(l.destination) like ?', ['%'.Str::lower($destination).'%']))
            ->when($filters['q'] ?? null, fn ($query, $term) => $query->whereRaw('lower(l.title) like ?', ['%'.Str::lower($term).'%']))
            ->orderBy('l.title')->limit(200)
            ->get(['l.*', 't.commercial_name as seller_name'])
            ->map(fn (object $row): array => [...$this->listing($row, $mine), 'partnership' => $mine ? null : ($partnerships[$row->seller_tenant_id] ?? null)])
            ->values();

        $listed = $this->db()->table('platform_marketplace_listings')->where('seller_tenant_id', $me)->pluck('product_ref')->map(fn ($id): string => (string) $id)->all();

        return [
            'enabled' => $this->rules->enabled('R-MARKETPLACE'),
            'scope' => $mine ? 'mine' : 'network',
            'kpis' => $this->kpis(),
            'listings' => $rows->all(),
            'products' => $mine ? DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->whereNotIn('id', $listed)->orderBy('name')->limit(500)->get(['code', 'name'])
                ->map(fn (object $row): array => ['value' => $row->code, 'label' => $row->name])->all() : [],
            'catalogs' => ['listing_statuses' => self::LISTING_STATUSES, 'partnership_statuses' => self::PARTNERSHIP_STATUSES, 'order_statuses' => self::ORDER_STATUSES],
        ];
    }

    public function publish(array $data, User $actor): array
    {
        $this->rules->ensure('R-MARKETPLACE', self::PERMISSION);
        $product = DB::table('catalog_products as p')->leftJoin('catalog_destinations as d', 'd.id', '=', 'p.primary_destination_id')
            ->whereNull('p.deleted_at')->where('p.code', $data['product'])->first(['p.id', 'p.code', 'p.name', 'p.short_description', 'p.status', 'd.name as destination'])
            ?? throw ApiException::notFound('El producto no existe.');

        if ($product->status !== 'ACTIVE') {
            throw ApiException::unprocessable('SC-11', 'Solo se publican productos activos.');
        }

        if ($this->db()->table('platform_marketplace_listings')->where('seller_tenant_id', $this->me())->where('product_ref', $product->id)->exists()) {
            throw ApiException::conflict('MKT-DUPLICATE', 'Ese producto ya está publicado en el marketplace.');
        }

        [$price, $currency] = $this->fromPrice((string) $product->id);
        $publish = (bool) ($data['publish'] ?? true);
        $id = (string) Str::uuid7();
        $this->db()->table('platform_marketplace_listings')->insert([
            'id' => $id,
            'seller_tenant_id' => $this->me(),
            'product_ref' => $product->id,
            'product_code' => $product->code,
            'title' => Str::limit((string) ($data['title'] ?? $product->name), 200, ''),
            'destination' => $product->destination,
            'summary' => $data['summary'] ?? $product->short_description,
            'currency' => $currency,
            'from_price' => $price,
            'reseller_commission_pct' => (string) $data['reseller_commission_pct'],
            'status' => $publish ? 'publicado' : 'borrador',
            'published_at' => $publish ? now() : null,
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);
        $this->audit->log('Marketplace', $product->code, 'publicar', null, ($publish ? 'publicado' : 'borrador').' · comisión '.$data['reseller_commission_pct'].' %');

        return $this->ownListing($id);
    }

    public function updateListing(string $id, array $data, User $actor): array
    {
        $this->rules->ensure('R-MARKETPLACE', self::PERMISSION);
        $listing = $this->ownListingRow($id);

        if ($listing->status === 'retirado') {
            throw ApiException::conflict('MKT-STATUS', 'Una publicación retirada ya no se edita. Publica el producto de nuevo.');
        }

        $values = array_intersect_key($data, array_flip(['title', 'summary', 'reseller_commission_pct']));

        if (isset($data['status'])) {
            $values['status'] = $data['status'];
            $values['published_at'] = $data['status'] === 'publicado' ? ($listing->published_at ?? now()) : $listing->published_at;
        }

        if ($data['refresh_price'] ?? false) {
            [$values['from_price'], $values['currency']] = $this->fromPrice((string) $listing->product_ref);
        }

        $this->db()->table('platform_marketplace_listings')->where('id', $listing->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Marketplace', (string) $listing->product_code, isset($data['status']) ? $this->statusAction((string) $data['status']) : 'editar', (string) $listing->status, ($values['status'] ?? $listing->status).(isset($values['reseller_commission_pct']) ? ' · comisión '.$values['reseller_commission_pct'].' %' : ''));

        return $this->ownListing($id);
    }

    public function partnerships(): array
    {
        $me = $this->me();
        $rows = $this->db()->table('platform_marketplace_partnerships as p')
            ->join('tenants as s', 's.id', '=', 'p.seller_tenant_id')->join('tenants as r', 'r.id', '=', 'p.reseller_tenant_id')
            ->where(fn ($query) => $query->where('p.seller_tenant_id', $me)->orWhere('p.reseller_tenant_id', $me))
            ->orderByDesc('p.created_at')
            ->get(['p.*', 's.commercial_name as seller_name', 'r.commercial_name as reseller_name'])
            ->map(fn (object $row): array => $this->partnership($row))
            ->values();

        return [
            'enabled' => $this->rules->enabled('R-MARKETPLACE'),
            'kpis' => $this->kpis(),
            'partnerships' => $rows->all(),
            'catalogs' => ['statuses' => self::PARTNERSHIP_STATUSES, 'decisions' => self::DECISIONS],
        ];
    }

    public function requestPartnership(array $data, User $actor): array
    {
        $this->rules->ensure('R-MARKETPLACE', self::PERMISSION);
        $me = $this->me();
        $listing = (Str::isUuid((string) $data['listing']) ? $this->db()->table('platform_marketplace_listings')->where('id', $data['listing'])->where('status', 'publicado')->first() : null)
            ?? throw ApiException::notFound('La publicación no existe o ya no está disponible.');

        if ((string) $listing->seller_tenant_id === $me) {
            throw ApiException::unprocessable('SC-11', 'No puedes aliarte con tu propia agencia.');
        }

        $existing = $this->db()->table('platform_marketplace_partnerships')->where('seller_tenant_id', $listing->seller_tenant_id)->where('reseller_tenant_id', $me)->first();

        if ($existing !== null && ! in_array($existing->status, ['rechazada', 'terminada'], true)) {
            throw ApiException::conflict('MKT-PARTNERSHIP', 'Ya tienes una alianza '.Str::lower(self::PARTNERSHIP_STATUSES[$existing->status]).' con esta agencia.');
        }

        $values = [
            'status' => 'solicitada',
            'commission_pct' => (string) $listing->reseller_commission_pct,
            'payment_terms' => $data['payment_terms'] ?? 'prepago',
            'credit_limit' => ($data['payment_terms'] ?? 'prepago') === 'credito' ? (string) Decimal::money((string) ($data['credit_limit'] ?? '0')) : '0',
            'requested_by' => $actor->getKey(),
            'decided_by' => null,
            'decided_at' => null,
            'updated_at' => now(),
        ];
        $id = $existing->id ?? (string) Str::uuid7();

        if ($existing === null) {
            $this->db()->table('platform_marketplace_partnerships')->insert([...$values, 'id' => $id, 'seller_tenant_id' => $listing->seller_tenant_id, 'reseller_tenant_id' => $me]);
        } else {
            $this->db()->table('platform_marketplace_partnerships')->where('id', $id)->update($values);
        }

        $this->audit->log('Alianza marketplace', (string) $id, 'solicitar', $existing->status ?? null, 'solicitada · '.$this->tenantName((string) $listing->seller_tenant_id));

        return $this->findPartnership((string) $id);
    }

    public function decide(string $id, string $decision, User $actor): array
    {
        $this->rules->ensure('R-MARKETPLACE', self::PERMISSION);
        $me = $this->me();
        $row = (Str::isUuid($id) ? $this->db()->table('platform_marketplace_partnerships')->where('id', $id)->where(fn ($query) => $query->where('seller_tenant_id', $me)->orWhere('reseller_tenant_id', $me))->first() : null)
            ?? throw ApiException::notFound('La alianza no existe.');
        $seller = (string) $row->seller_tenant_id === $me;

        $next = match (true) {
            $decision === 'aceptar' && $seller && $row->status === 'solicitada' => 'activa',
            $decision === 'rechazar' && $seller && $row->status === 'solicitada' => 'rechazada',
            $decision === 'suspender' && $seller && $row->status === 'activa' => 'suspendida',
            $decision === 'reactivar' && $seller && $row->status === 'suspendida' => 'activa',
            $decision === 'terminar' && in_array($row->status, ['activa', 'suspendida'], true) => 'terminada',
            default => throw ApiException::conflict('MKT-PARTNERSHIP', $seller || $decision === 'terminar' ? 'La alianza no admite esa acción en su estado actual.' : 'Solo la agencia que vende decide sobre la alianza.'),
        };

        $this->db()->table('platform_marketplace_partnerships')->where('id', $row->id)->update(['status' => $next, 'decided_by' => $actor->getKey(), 'decided_at' => now(), 'updated_at' => now()]);
        $this->audit->log('Alianza marketplace', (string) $row->id, $decision, (string) $row->status, $next.' · '.$this->tenantName((string) ($seller ? $row->reseller_tenant_id : $row->seller_tenant_id)));

        return $this->findPartnership((string) $row->id);
    }

    public function orders(array $filters): array
    {
        $me = $this->me();
        $rows = $this->db()->table('platform_marketplace_orders as o')->join('platform_marketplace_listings as l', 'l.id', '=', 'o.listing_id')
            ->join('tenants as s', 's.id', '=', 'o.seller_tenant_id')->join('tenants as r', 'r.id', '=', 'o.reseller_tenant_id')
            ->where(fn ($query) => $query->where('o.seller_tenant_id', $me)->orWhere('o.reseller_tenant_id', $me))
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('o.status', $status))
            ->when(($filters['role'] ?? null) === 'venta', fn ($query) => $query->where('o.seller_tenant_id', $me))
            ->when(($filters['role'] ?? null) === 'compra', fn ($query) => $query->where('o.reseller_tenant_id', $me))
            ->orderByDesc('o.created_at')->limit(300)
            ->get(['o.*', 'l.title', 'l.destination', 's.commercial_name as seller_name', 'r.commercial_name as reseller_name'])
            ->map(fn (object $row): array => $this->order($row))
            ->values();

        return [
            'enabled' => $this->rules->enabled('R-MARKETPLACE'),
            'kpis' => $this->kpis(),
            'orders' => $rows->all(),
            'catalogs' => ['statuses' => self::ORDER_STATUSES],
        ];
    }

    public function sell(array $data, string $idempotencyKey, User $actor): array
    {
        $this->rules->ensure('R-MARKETPLACE', self::PERMISSION);
        $me = $this->me();
        $existing = $this->db()->table('platform_marketplace_orders')->where('reseller_tenant_id', $me)->where('idempotency_key', $idempotencyKey)->value('id');

        if ($existing !== null) {
            return $this->findOrder((string) $existing);
        }

        $listing = (Str::isUuid((string) $data['listing']) ? $this->db()->table('platform_marketplace_listings')->where('id', $data['listing'])->where('status', 'publicado')->where('seller_tenant_id', '<>', $me)->first() : null)
            ?? throw ApiException::notFound('La publicación no existe o ya no está disponible.');
        $partnership = $this->db()->table('platform_marketplace_partnerships')->where('seller_tenant_id', $listing->seller_tenant_id)->where('reseller_tenant_id', $me)->where('status', 'activa')->first()
            ?? throw ApiException::unprocessable('SC-11', 'Necesitas una alianza activa con la agencia que vende este producto.');

        $gross = isset($data['gross_amount'])
            ? Decimal::money((string) $data['gross_amount'])
            : ($listing->from_price !== null ? Decimal::money((string) $listing->from_price)->multipliedBy((int) $data['pax'])->toScale(2, RoundingMode::HALF_UP) : throw ApiException::unprocessable('VALIDATION_ERROR', 'La publicación no tiene precio desde: indica el monto de la venta.', ['field' => 'gross_amount']));
        $commission = $gross->multipliedBy((string) $partnership->commission_pct)->dividedBy(100, 2, RoundingMode::HALF_UP);
        $fee = $gross->multipliedBy((string) $partnership->platform_fee_pct)->dividedBy(100, 2, RoundingMode::HALF_UP);

        if ($partnership->payment_terms === 'credito') {
            $open = BigDecimal::of((string) $this->db()->table('platform_marketplace_orders')->where('partnership_id', $partnership->id)->whereIn('status', ['solicitada', 'confirmada'])->sum('gross_amount'));

            if ($open->plus($gross)->isGreaterThan((string) $partnership->credit_limit)) {
                throw ApiException::unprocessable('SC-11', 'La venta supera la línea de crédito acordada con la agencia.');
            }
        }

        $id = $this->db()->transaction(function () use ($listing, $partnership, $gross, $commission, $fee, $idempotencyKey, $me): string {
            $this->db()->select('select pg_advisory_xact_lock(hashtext(?))', ['platform:platform_marketplace_orders:code']);
            $last = (int) $this->db()->table('platform_marketplace_orders')->selectRaw("max(cast(substring(code from '([0-9]+)$') as bigint)) as n")->value('n');
            $id = (string) Str::uuid7();
            $this->db()->table('platform_marketplace_orders')->insert([
                'id' => $id,
                'code' => 'MKP-'.str_pad((string) ($last + 1), 5, '0', STR_PAD_LEFT),
                'partnership_id' => $partnership->id,
                'listing_id' => $listing->id,
                'seller_tenant_id' => $listing->seller_tenant_id,
                'reseller_tenant_id' => $me,
                'gross_amount' => (string) $gross,
                'commission_amount' => (string) $commission,
                'platform_fee_amount' => (string) $fee,
                'currency' => $listing->currency,
                'status' => 'solicitada',
                'idempotency_key' => $idempotencyKey,
            ]);

            return $id;
        });

        $order = $this->findOrder($id);
        $this->audit->log('Venta marketplace', $order['code'], 'vender', null, $listing->title.' · '.$data['pax'].' pax · '.$listing->currency.' '.$gross);

        return [...$order, 'travel_date' => $data['travel_date'] ?? null, 'pax' => (int) $data['pax']];
    }

    private function kpis(): array
    {
        $me = $this->me();
        $month = Carbon::now($this->context->timezone())->startOfMonth()->utc();

        return [
            'published' => $this->db()->table('platform_marketplace_listings')->where('seller_tenant_id', $me)->where('status', 'publicado')->count(),
            'partners' => $this->db()->table('platform_marketplace_partnerships')->where('status', 'activa')->where(fn ($query) => $query->where('seller_tenant_id', $me)->orWhere('reseller_tenant_id', $me))->count(),
            'pending' => $this->db()->table('platform_marketplace_partnerships')->where('status', 'solicitada')->where('seller_tenant_id', $me)->count(),
            'sold_month' => $this->db()->table('platform_marketplace_orders')->where('seller_tenant_id', $me)->where('created_at', '>=', $month)->whereNotIn('status', ['rechazada', 'cancelada'])->count(),
            'bought_month' => $this->db()->table('platform_marketplace_orders')->where('reseller_tenant_id', $me)->where('created_at', '>=', $month)->whereNotIn('status', ['rechazada', 'cancelada'])->count(),
        ];
    }

    private function fromPrice(string $productId): array
    {
        $rate = DB::table('catalog_rates')->where('product_id', $productId)->where('status', 'vigente')->whereIn('segment', ['Adulto', 'Pasajero'])
            ->where('valid_to', '>=', Carbon::now($this->context->timezone())->toDateString())->orderBy('price')->first(['price', 'currency']);

        return $rate === null ? [null, (string) ($this->context->tenant()->base_currency ?? 'PEN')] : [(string) $rate->price, (string) $rate->currency];
    }

    private function statusAction(string $status): string
    {
        return ['publicado' => 'publicar', 'pausado' => 'pausar', 'retirado' => 'retirar', 'borrador' => 'despublicar'][$status] ?? 'editar';
    }

    private function ownListingRow(string $id): object
    {
        return (Str::isUuid($id) ? $this->db()->table('platform_marketplace_listings')->where('id', $id)->where('seller_tenant_id', $this->me())->first() : null)
            ?? throw ApiException::notFound('La publicación no existe.');
    }

    private function ownListing(string $id): array
    {
        $row = $this->db()->table('platform_marketplace_listings as l')->join('tenants as t', 't.id', '=', 'l.seller_tenant_id')->where('l.id', $id)->first(['l.*', 't.commercial_name as seller_name']);

        return $this->listing($row, true);
    }

    private function findPartnership(string $id): array
    {
        $row = $this->db()->table('platform_marketplace_partnerships as p')->join('tenants as s', 's.id', '=', 'p.seller_tenant_id')->join('tenants as r', 'r.id', '=', 'p.reseller_tenant_id')
            ->where('p.id', $id)->first(['p.*', 's.commercial_name as seller_name', 'r.commercial_name as reseller_name']);

        return $this->partnership($row);
    }

    private function findOrder(string $id): array
    {
        $row = $this->db()->table('platform_marketplace_orders as o')->join('platform_marketplace_listings as l', 'l.id', '=', 'o.listing_id')
            ->join('tenants as s', 's.id', '=', 'o.seller_tenant_id')->join('tenants as r', 'r.id', '=', 'o.reseller_tenant_id')
            ->where('o.id', $id)->first(['o.*', 'l.title', 'l.destination', 's.commercial_name as seller_name', 'r.commercial_name as reseller_name']);

        return $this->order($row);
    }

    private function listing(object $row, bool $mine): array
    {
        $net = $row->from_price === null ? null : Decimal::money((string) $row->from_price)->multipliedBy(BigDecimal::of(100)->minus((string) $row->reseller_commission_pct))->dividedBy(100, 2, RoundingMode::HALF_UP);

        return [
            'id' => (string) $row->id,
            'title' => $row->title,
            'destination' => $row->destination,
            'summary' => $row->summary,
            'currency' => $row->currency,
            'from_price' => Decimal::toApi($row->from_price),
            'net_price' => Decimal::toApi($net),
            'reseller_commission_pct' => (string) $row->reseller_commission_pct,
            'status' => $row->status,
            'status_label' => self::LISTING_STATUSES[$row->status] ?? $row->status,
            'seller' => $mine ? null : $row->seller_name,
            'product_code' => $mine ? $row->product_code : null,
            'published_at' => $row->published_at,
        ];
    }

    private function partnership(object $row): array
    {
        $seller = (string) $row->seller_tenant_id === $this->me();

        return [
            'id' => (string) $row->id,
            'role' => $seller ? 'vendedor' : 'revendedor',
            'partner' => $seller ? $row->reseller_name : $row->seller_name,
            'status' => $row->status,
            'status_label' => self::PARTNERSHIP_STATUSES[$row->status] ?? $row->status,
            'commission_pct' => (string) $row->commission_pct,
            'platform_fee_pct' => (string) $row->platform_fee_pct,
            'payment_terms' => $row->payment_terms,
            'credit_limit' => Decimal::toApi($row->credit_limit),
            'requested_at' => $row->created_at,
            'decided_at' => $row->decided_at,
            'actions' => array_values(array_filter([
                $seller && $row->status === 'solicitada' ? 'aceptar' : null,
                $seller && $row->status === 'solicitada' ? 'rechazar' : null,
                $seller && $row->status === 'activa' ? 'suspender' : null,
                $seller && $row->status === 'suspendida' ? 'reactivar' : null,
                in_array($row->status, ['activa', 'suspendida'], true) ? 'terminar' : null,
            ])),
        ];
    }

    private function order(object $row): array
    {
        $seller = (string) $row->seller_tenant_id === $this->me();

        return [
            'id' => (string) $row->id,
            'code' => $row->code,
            'role' => $seller ? 'venta' : 'compra',
            'partner' => $seller ? $row->reseller_name : $row->seller_name,
            'listing' => ['title' => $row->title, 'destination' => $row->destination],
            'gross_amount' => Decimal::toApi($row->gross_amount),
            'commission_amount' => Decimal::toApi($row->commission_amount),
            'platform_fee_amount' => Decimal::toApi($row->platform_fee_amount),
            'currency' => $row->currency,
            'status' => $row->status,
            'status_label' => self::ORDER_STATUSES[$row->status] ?? $row->status,
            'created_at' => $row->created_at,
        ];
    }

    private function tenantName(string $id): string
    {
        return (string) $this->db()->table('tenants')->where('id', $id)->value('commercial_name');
    }

    private function me(): string
    {
        return $this->context->idOrFail();
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
