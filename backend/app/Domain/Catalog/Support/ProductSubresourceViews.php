<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Catalog\Actions\ProductSections;
use App\Domain\Catalog\Actions\ProductSubresources;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProductSubresourceViews
{
    public const AUDIT_ENTITIES = ['producto' => 'Producto', 'tarifa' => 'Tarifa', 'salida' => 'Salida'];

    private const AUDIT_SORTS = ['occurred_at' => 'e.occurred_at', 'action' => 'e.action', 'entity' => 'e.entity'];

    public function __construct(private readonly ProductSections $sections) {}

    public function product(string $reference): object
    {
        return DB::table('catalog_products')->whereNull('deleted_at')->where(Str::isUuid($reference) ? 'id' : 'code', $reference)->first()
            ?? throw ApiException::notFound('El producto no existe.');
    }

    public function content(object $product): array
    {
        $texts = DB::table('catalog_product_inclusions')->where('product_id', $product->id)->orderBy('sort_order')->get(['id', 'kind', 'text', 'sort_order']);

        return [
            'code' => $product->code,
            'lock_version' => (int) $product->lock_version,
            'short_description' => $product->short_description,
            'long_description' => $product->long_description,
            'features' => json_decode((string) ($product->features ?? 'null'), true),
            'video_url' => $product->video_url,
            'seo_title' => $product->seo_title,
            'seo_description' => $product->seo_description,
            'slug' => $product->slug,
            'inclusions' => $texts->where('kind', 'include')->map(fn (object $row) => $this->inclusion($row))->values(),
            'exclusions' => $texts->where('kind', 'exclude')->map(fn (object $row) => $this->inclusion($row))->values(),
            'requirements' => $this->requirements($product),
            'faqs' => DB::table('catalog_product_faqs')->where('product_id', $product->id)->orderBy('sort_order')->get(['id', 'question', 'answer', 'sort_order']),
            'media' => $this->media($product),
        ];
    }

    public function inclusions(object $product, ?string $kind): array
    {
        if ($kind !== null && ! isset(ProductSubresources::KIND_LABELS[$kind])) {
            throw ApiException::unprocessable('VALIDATION_FAILED', 'El tipo de línea es include o exclude.');
        }

        return DB::table('catalog_product_inclusions')->where('product_id', $product->id)->when($kind, fn (Builder $query) => $query->where('kind', $kind))
            ->orderBy('kind')->orderBy('sort_order')->get(['id', 'kind', 'text', 'sort_order'])->map(fn (object $row) => $this->inclusion($row))->all();
    }

    private function inclusion(object $row): array
    {
        return ['id' => $row->id, 'kind' => $row->kind, 'text' => $row->text, 'sort_order' => (int) $row->sort_order];
    }

    public function requirements(object $product): array
    {
        return DB::table('catalog_product_requirements')->where('product_id', $product->id)->orderBy('created_at')->orderBy('id')->get(['id', 'category', 'text'])
            ->map(fn (object $row) => ['id' => $row->id, 'category' => $row->category, 'text' => $row->text])->all();
    }

    public function media(object $product): array
    {
        return DB::table('catalog_product_media')->where('product_id', $product->id)->orderByDesc('is_main')->orderBy('sort_order')->get(['id', 'storage_path', 'alt_text', 'is_main', 'sort_order', 'width', 'height'])
            ->map(fn (object $row) => ['id' => $row->id, 'url' => $row->storage_path, 'alt_text' => $row->alt_text, 'is_main' => (bool) $row->is_main, 'sort_order' => (int) $row->sort_order, 'width' => $row->width, 'height' => $row->height])->all();
    }

    public function itineraries(object $product, User $viewer): array
    {
        $id = $this->sections->itineraryId($product->id);

        if ($id === null) {
            return [];
        }

        $seesCost = CatalogAccess::seesCost($viewer);
        $days = array_map(fn (array $day, int $index): array => [
            ...$day,
            'day_number' => $index + 1,
            'items' => array_map(fn (array $item): array => [...$item, 'cost' => $seesCost ? $item['cost'] : null, 'price' => $seesCost ? $item['price'] : null], $day['items']),
        ], $days = $this->sections->currentItinerary($product->id), array_keys($days));

        return [['id' => $id, 'name' => (string) DB::table('catalog_itineraries')->where('id', $id)->value('name'), 'is_default' => true, 'days' => $days]];
    }

    public function related(object $product): array
    {
        $columns = ['r.id', 'r.relation', 'p.id as product_id', 'p.code', 'p.name', 'p.status'];
        $map = fn (object $row): array => ['id' => $row->id, 'relation' => $row->relation, 'product' => ['id' => $row->product_id, 'code' => $row->code, 'name' => $row->name, 'status' => $row->status]];

        return [
            'related' => array_map($map, DB::table('catalog_product_related as r')->join('catalog_products as p', 'p.id', '=', 'r.related_product_id')->where('r.product_id', $product->id)->whereNull('p.deleted_at')
                ->orderBy('p.name')->get($columns)->all()),
            'referenced_by' => array_map($map, DB::table('catalog_product_related as r')->join('catalog_products as p', 'p.id', '=', 'r.product_id')->where('r.related_product_id', $product->id)->whereNull('p.deleted_at')
                ->orderBy('p.name')->get($columns)->all()),
        ];
    }

    public function configGroups(object $product): array
    {
        $groups = DB::table('catalog_product_config_groups')->where('product_id', $product->id)->orderBy('sort_order')->get(['id', 'name', 'sort_order']);
        $options = DB::table('catalog_product_config_options')->whereIn('group_id', $groups->pluck('id'))->orderBy('sort_order')->get(['id', 'group_id', 'label', 'price_delta', 'sort_order'])->groupBy('group_id');

        $result = [];
        foreach ($groups as $group) {
            $items = [];
            foreach ($options[$group->id] ?? [] as $option) {
                $items[] = ['id' => $option->id, 'label' => $option->label, 'price_delta' => (string) $option->price_delta, 'sort_order' => (int) $option->sort_order];
            }
            $result[] = ['id' => $group->id, 'name' => $group->name, 'sort_order' => (int) $group->sort_order, 'options' => $items];
        }

        return $result;
    }

    public function channels(object $product): array
    {
        $rows = DB::table('catalog_product_channels')->where('product_id', $product->id)->get(['channel', 'is_published', 'published_at'])->keyBy('channel');
        $active = $product->status === 'ACTIVE';

        return array_map(function (string $channel) use ($rows, $active): array {
            $row = $rows[$channel] ?? null;
            $on = $channel === 'erp' || (bool) ($row->is_published ?? false);

            return [
                'channel' => $channel,
                'label' => ProductSections::CHANNEL_LABELS[$channel],
                'is_published' => $on && ($active || $channel === 'erp'),
                'state' => match (true) {
                    ! $on => 'no_publicado',
                    $active || $channel === 'erp' => 'publicado',
                    default => 'solicitado',
                },
                'published_at' => $row->published_at ?? null,
            ];
        }, ProductSectionRules::CHANNELS);
    }

    public function audit(Request $request, object $product): array
    {
        $filters = CursorPage::filters($request);
        $entity = isset($filters['entity']) ? (self::AUDIT_ENTITIES[mb_strtolower($filters['entity'])] ?? throw ApiException::unprocessable('VALIDATION_FAILED', 'La entidad del historial es producto, tarifa o salida.')) : null;
        $rates = DB::table('catalog_rates')->where('product_id', $product->id)->pluck('ref')->all();
        $departures = DB::table('catalog_product_departures')->where('product_id', $product->id)->pluck('ref')->all();
        $query = DB::table('audit_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')
            ->where(fn (Builder $scope) => $scope->where(fn (Builder $own) => $own->where('e.entity', 'Producto')->where('e.entity_id', $product->code))
                ->orWhere(fn (Builder $own) => $own->where('e.entity', 'Tarifa')->whereIn('e.entity_id', $rates))
                ->orWhere(fn (Builder $own) => $own->where('e.entity', 'Salida')->whereIn('e.entity_id', $departures)))
            ->when($entity, fn (Builder $query) => $query->where('e.entity', $entity))
            ->when($filters['action'] ?? null, fn (Builder $query, string $action) => $query->where('e.action', $action))
            ->select(['e.code', 'e.entity', 'e.entity_id', 'e.action', 'e.before_value', 'e.after_value', 'e.occurred_at', 'e.actor_role', 'u.name as actor']);

        return CursorPage::respond($request, $query, self::AUDIT_SORTS, '-occurred_at', fn (object $row): array => [
            'code' => $row->code,
            'entity' => $row->entity,
            'entity_id' => $row->entity_id,
            'action' => $row->action,
            'before' => $row->before_value,
            'after' => $row->after_value,
            'actor' => $row->actor,
            'actor_role' => $row->actor_role,
            'occurred_at' => $row->occurred_at,
        ], ['product' => $product->code]);
    }

    public function kpis(User $viewer): array
    {
        $today = CatalogAccess::today();
        $statuses = DB::table('catalog_products')->whereNull('deleted_at')->groupBy('status')->selectRaw('status, count(*) as total')->pluck('total', 'status')->map(fn ($value) => (int) $value);
        $count = fn (array $keys) => array_sum(array_map(fn (string $key) => $statuses[$key] ?? 0, $keys));
        $margin = null;

        if (CatalogAccess::seesMargin($viewer)) {
            $value = DB::table('catalog_rates as r')->join('catalog_products as p', 'p.id', '=', 'r.product_id')->whereNull('p.deleted_at')->where('p.status', 'ACTIVE')
                ->where('r.status', 'vigente')->where('r.rate_type', 'Venta')->where('r.valid_from', '<=', $today)->where('r.valid_to', '>=', $today)->where('r.price', '>', 0)
                ->selectRaw('avg((r.price - r.cost) / r.price * 100) as margin')->value('margin');
            $margin = $value === null ? null : round((float) $value, 1);
        }

        return [
            'total' => $statuses->sum(),
            'active' => $count(['ACTIVE']),
            'in_progress' => $count(['DRAFT', 'REVIEW', 'APPROVED']),
            'paused' => $count(['SUSPENDED', 'INACTIVE']),
            'archived' => $count(['ARCHIVED']),
            'by_status' => $statuses->all(),
            'sellable' => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->where('is_bookable', true)->count(),
            'featured' => DB::table('catalog_products')->whereNull('deleted_at')->where('is_featured', true)->count(),
            'with_future_departures' => DB::table('catalog_product_departures as d')->join('catalog_products as p', 'p.id', '=', 'd.product_id')->whereNull('p.deleted_at')
                ->where('d.departure_date', '>=', $today)->whereIn('d.status', ['abierta', 'completa'])->distinct()->count('d.product_id'),
            'avg_margin_pct' => $margin,
        ];
    }
}
