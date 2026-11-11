<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\ProductB2bRates;
use App\Domain\Catalog\Support\B2bRateDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class B2bRateController
{
    public function __construct(private readonly ProductB2bRates $rates, private readonly B2bRateDirectory $directory) {}

    public function overview(): JsonResponse
    {
        return response()->json(['data' => $this->directory->overview()]);
    }

    public function priceLists(): JsonResponse
    {
        return response()->json(['data' => $this->directory->priceLists()]);
    }

    public function index(string $code): JsonResponse
    {
        $id = DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->value('id') ?? throw ApiException::notFound('El producto no existe.');

        return response()->json(['data' => $this->directory->forProduct((string) $id)]);
    }

    public function store(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([...ProductB2bRates::rules(false), 'agency' => ['required', 'string', 'max:30']], ProductB2bRates::messages());
        $this->rates->save($code, $data['agency'], $data, $this->user($request), 'create');

        return response()->json(['data' => ['product' => $code, 'agency' => $data['agency']]], 201);
    }

    public function replace(Request $request, string $code, string $agency): JsonResponse
    {
        $data = $request->validate(ProductB2bRates::rules(false), ProductB2bRates::messages());
        $this->rates->save($code, $agency, $data, $this->user($request), 'upsert');

        return response()->json(['data' => ['product' => $code, 'agency' => $agency]]);
    }

    public function update(Request $request, string $code, string $agency): JsonResponse
    {
        $data = $request->validate(ProductB2bRates::rules(true), ProductB2bRates::messages());
        $this->rates->save($code, $agency, $data, $this->user($request), 'update');

        return response()->json(['data' => ['product' => $code, 'agency' => $agency]]);
    }

    public function destroy(Request $request, string $code, string $agency): JsonResponse
    {
        $this->rates->remove($code, $agency, $this->user($request));

        return response()->json(null, 204);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
