<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class DestinationDirectory
{
    public const RANKS = ['País' => 0, 'Región' => 1, 'Departamento' => 2, 'Provincia' => 3, 'Ciudad' => 4, 'Zona' => 4, 'Lugar' => 5, 'Atracción' => 6, 'Ruta' => 6];

    public function overview(User $viewer): array
    {
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

        $destinations = $nodes->map(function (object $node) use ($nodes, $links, $paths) {
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
                'products' => $within->unique('code')->map(fn (array $link) => ['code' => $link['code'], 'name' => $link['name'], 'status' => $link['status']])->values(),
            ];
        });

        return [
            'destinations' => $destinations->values(),
            'options' => ['types' => array_keys(self::RANKS)],
            'can' => ['manage' => $viewer->can('catalog.products.update')],
        ];
    }
}
