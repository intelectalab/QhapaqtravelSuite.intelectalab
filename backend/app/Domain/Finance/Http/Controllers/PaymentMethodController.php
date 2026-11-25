<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\PaymentMethodCatalog;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class PaymentMethodController
{
    use ResolvesActor;

    private const MESSAGES = ['label.required' => 'Escribe el nombre del medio de cobro.', 'label.min' => 'El nombre debe tener al menos 3 caracteres.', 'label.max' => 'El nombre no puede pasar de 80 caracteres.'];

    public function index(Request $request, PaymentMethodCatalog $catalog): JsonResponse
    {
        return response()->json(['data' => $catalog->list($this->actor($request))]);
    }

    public function store(Request $request, PaymentMethodCatalog $catalog): JsonResponse
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'min:3', 'max:80'],
            'requires_reference' => ['sometimes', 'boolean'],
        ], self::MESSAGES);

        return response()->json(['data' => ['code' => $catalog->create($data, $this->actor($request))]], 201);
    }

    public function update(Request $request, string $code, PaymentMethodCatalog $catalog): JsonResponse
    {
        $data = $request->validate([
            'label' => ['sometimes', 'string', 'min:3', 'max:80'],
            'requires_reference' => ['sometimes', 'boolean'],
            'active' => ['sometimes', 'boolean'],
        ], self::MESSAGES);

        return response()->json(['data' => ['code' => $catalog->update($code, $data, $this->actor($request))]]);
    }

    public function destroy(string $code, PaymentMethodCatalog $catalog): Response
    {
        $catalog->delete($code);

        return response()->noContent();
    }
}
