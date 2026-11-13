<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class DestinationDirectory
{
    public const RANKS = ['País' => 0, 'Región' => 1, 'Departamento' => 2, 'Provincia' => 3, 'Ciudad' => 4, 'Zona' => 4, 'Lugar' => 5, 'Atracción' => 6, 'Ruta' => 6];

    public function overview(User $viewer): array
    {
        return [
            'destinations' => $this->tree($viewer)->values(),
            'options' => ['types' => array_keys(self::RANKS)],
            'can' => ['manage' => $viewer->can('catalog.products.update')],
        ];
    }

    public function find(string $ref): array
    {
        $tree = $this->tree()->keyBy('id');
        $node = $tree->first(fn (array $destination) => $destination['id'] === $ref || $destination['ref'] === $ref) ?? throw ApiException::notFound('El destino no existe.');
        $ancestors = [];

        for ($parent = $node['parent']['id'] ?? null; $parent !== null && isset($tree[$parent]) && count($ancestors) < 12; $parent = $tree[$parent]['parent']['id'] ?? null) {
            array_unshift($ancestors, array_intersect_key($tree[$parent], array_flip(['id', 'ref', 'name', 'type', 'level'])));
        }

        return [
            ...$node,
            'ancestors' => $ancestors,
            'children' => $tree->where('parent.id', $node['id'])->map(fn (array $child) => array_intersect_key($child, array_flip(['id', 'ref', 'name', 'type', 'level', 'children', 'direct_products'])))->values(),
            'children_count' => $node['children'],
        ];
    }

    private function tree(?User $viewer = null): Collection
    {
        $prices = ProductDirectory::pricesFrom($viewer);
        $nodes = DB::table('catalog_destinations as d')
            ->leftJoin('catalog_destinations as parent', 'parent.id', '=', 'd.parent_id')
            ->whereNull('d.deleted_at')
            ->orderBy('d.path')
            ->get(['d.*', 'parent.ref as parent_ref', 'parent.name as parent_name']);

        $links = DB::table('catalog_products as p')->whereNull('p.deleted_at')->get(['p.id', 'p.code', 'p.name', 'p.status', 'p.primary_destination_id as destination_id'])
            ->map(fn (object $product) => [...(array) $product, 'role' => 'principal'])
            ->merge(DB::table('catalog_product_destinations as pd')->join('catalog_products as p', 'p.id', '=', 'pd.product_id')->whereNull('p.deleted_at')
                ->get(['p.id', 'p.code', 'p.name', 'p.status', 'pd.destination_id'])->map(fn (object $product) => [...(array) $product, 'role' => 'secundario']));
        $paths = $nodes->pluck('path', 'id');

        return $nodes->map(function (object $node) use ($nodes, $links, $paths, $prices) {
            $direct = $links->where('destination_id', $node->id);
            $within = $links->filter(fn (array $link) => isset($paths[$link['destination_id']]) && ($paths[$link['destination_id']] === $node->path || str_starts_with((string) $paths[$link['destination_id']], $node->path.' / ')));

            return [
                'id' => $node->id,
                'ref' => $node->ref,
                'name' => $node->name,
                'type' => $node->type,
                'level' => (int) $node->level,
                'depth' => substr_count($node->path, ' / '),
                'path' => $node->path,
                'parent' => $node->parent_id ? ['id' => $node->parent_id, 'ref' => $node->parent_ref, 'name' => $node->parent_name] : null,
                'lat' => $node->lat === null ? null : (float) $node->lat,
                'lng' => $node->lng === null ? null : (float) $node->lng,
                'description' => $node->description,
                'children' => $nodes->where('parent_id', $node->id)->count(),
                'direct_products' => $direct->pluck('code')->unique()->count(),
                'products' => $within->sortBy(fn (array $link) => $link['destination_id'] === $node->id ? ($link['role'] === 'principal' ? 0 : 1) : 2)->unique('code')->map(fn (array $link) => [
                    'code' => $link['code'],
                    'name' => $link['name'],
                    'status' => $link['status'],
                    'relation' => $link['destination_id'] === $node->id ? $link['role'] : 'subdestino',
                    'price_from' => $prices[$link['id']] ?? null,
                ])->values(),
            ];
        });
    }
}
