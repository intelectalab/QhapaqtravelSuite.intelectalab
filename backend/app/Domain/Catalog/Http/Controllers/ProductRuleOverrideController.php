<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Support\ProductBookingConfig;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

final class ProductRuleOverrideController
{
    public function show(string $product, string $rule, ProductBookingConfig $config): JsonResponse
    {
        $row = $config->product($product);
        $item = collect($config->ruleOverrides((string) $row->id))->firstWhere('code', strtoupper($rule)) ?? throw ApiException::notFound('La regla no existe.');
        $override = DB::table('catalog_product_rule_overrides')->where('product_id', $row->id)->where('rule_code', $item['code'])->first(['updated_at', 'updated_by']);

        return response()->json(['data' => [...$item, 'product' => $row->code, 'updated_at' => $override?->updated_at], 'meta' => ['editable' => $item['product_override']]]);
    }
}
