<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Http\Controllers;

use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Support\QuoteableCatalog;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class QuotePickerController
{
    public function quoteable(Request $request, QuoteableCatalog $catalog): JsonResponse
    {
        $data = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
            'currency' => ['nullable', 'in:PEN,USD'],
        ], [
            'date.*' => 'Indica la fecha en formato AAAA-MM-DD.',
            'currency.*' => 'La moneda debe ser PEN o USD.',
        ]);

        return response()->json(['data' => $catalog->picker((string) ($data['date'] ?? CatalogAccess::today()), (string) ($data['currency'] ?? 'PEN'), $this->user($request))]);
    }

    public function rateSuggestion(Request $request, QuoteableCatalog $catalog, string $product): JsonResponse
    {
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'currency' => ['required', 'in:PEN,USD'],
            'client_id' => ['nullable', 'string', 'max:40'],
            'rate_id' => ['nullable', 'uuid'],
        ], [
            'date.*' => 'Indica la fecha del servicio en formato AAAA-MM-DD.',
            'currency.*' => 'La moneda debe ser PEN o USD.',
            'client_id.*' => 'Elige un cliente válido.',
            'rate_id.*' => 'Elige una tarifa válida.',
        ]);
        $row = DB::table('catalog_products')->whereNull('deleted_at')->where(Str::isUuid($product) ? 'id' : 'code', $product)->first(['id', 'code', 'name', 'status', 'is_quoteable'])
            ?? throw ApiException::notFound('El producto no existe.');

        return response()->json(['data' => $catalog->suggestion($row, $data, $this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
