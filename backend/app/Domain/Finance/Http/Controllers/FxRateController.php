<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\RegisterFxRate;
use App\Domain\Finance\Support\FxDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class FxRateController
{
    public function index(Request $request, FxDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->list($this->user($request))]);
    }

    public function store(Request $request, RegisterFxRate $register): JsonResponse
    {
        $data = $request->validate([
            'currency' => ['required', 'in:'.implode(',', array_keys(FxDirectory::CURRENCIES))],
            'rate' => ['required', 'numeric', 'gt:0.5', 'lt:20'],
            'buy' => ['nullable', 'numeric', 'gt:0.5', 'lt:20'],
            'sell' => ['nullable', 'numeric', 'gt:0.5', 'lt:20'],
            'rate_date' => ['nullable', 'date', 'before_or_equal:today'],
            'source' => ['required', 'string', 'max:60'],
        ], [
            'currency.*' => 'Elige la moneda.',
            'rate.*' => 'El tipo de cambio debe estar entre 0.5 y 20 (CFG-BR-04).',
            'buy.*' => 'Revisa el precio de compra.',
            'sell.*' => 'Revisa el precio de venta.',
            'rate_date.before_or_equal' => 'La fecha no puede ser futura.',
            'source.*' => 'Indica la fuente.',
        ]);
        $register($data, $this->user($request));

        return response()->json(['data' => ['currency' => $data['currency']]], 201);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
