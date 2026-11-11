<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class CatalogInterest
{
    public const SELLABLE = ['ACTIVE', 'APPROVED'];

    public function destination(array $data): array
    {
        $id = $data['destination_id'] ?? null;

        if ($id === null || $id === '') {
            return ['destination_id' => null, 'destination_label' => trim((string) ($data['destination'] ?? '')) ?: null];
        }

        $name = DB::table('catalog_destinations')->where('id', $id)->whereNull('deleted_at')->value('name')
            ?? throw ApiException::unprocessable('CRM-BR-06', 'Elige un destino de la lista.');

        return ['destination_id' => $id, 'destination_label' => $name];
    }

    public function product(array $data, ?string $currentId = null): ?string
    {
        $id = $data['product_id'] ?? null;

        if ($id === null || $id === '' || $id === $currentId) {
            return $id ?: null;
        }

        $sellable = DB::table('catalog_products')->where('id', $id)->whereNull('deleted_at')->whereIn('status', self::SELLABLE)->exists();

        if (! $sellable) {
            throw ApiException::unprocessable('CRM-BR-06', 'Elige un producto activo del catálogo.');
        }

        return $id;
    }

    public function label(?string $productId): ?array
    {
        if ($productId === null) {
            return null;
        }

        $product = DB::table('catalog_products')->where('id', $productId)->first(['id', 'code', 'name']);

        return $product ? ['id' => $product->id, 'code' => $product->code, 'name' => $product->name] : null;
    }

    public function options(): array
    {
        return [
            'destinations' => DB::table('catalog_destinations')->whereNull('deleted_at')->orderBy('path')->get(['id', 'name', 'type', 'path'])
                ->map(fn (object $row) => ['id' => $row->id, 'name' => $row->name, 'type' => $row->type, 'path' => $row->path])->values(),
            'products' => $this->products(),
        ];
    }

    public function products(): Collection
    {
        return DB::table('catalog_products')->whereNull('deleted_at')->whereIn('status', self::SELLABLE)->orderBy('name')->get(['id', 'code', 'name'])->values();
    }
}
