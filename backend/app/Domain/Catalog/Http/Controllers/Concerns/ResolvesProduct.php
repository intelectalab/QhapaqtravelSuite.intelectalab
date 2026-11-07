<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers\Concerns;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

trait ResolvesProduct
{
    private function productId(string $product): string
    {
        $id = DB::table('catalog_products')->whereNull('deleted_at')->where(Str::isUuid($product) ? 'id' : 'code', $product)->value('id');

        return $id !== null ? (string) $id : throw ApiException::notFound('El producto no existe.');
    }

    private function ensureOwnedBy(string $product, string $table, string $column, string $value, string $missing): void
    {
        if (! DB::table($table)->where($column, $value)->where('product_id', $this->productId($product))->exists()) {
            throw ApiException::notFound($missing);
        }
    }
}
