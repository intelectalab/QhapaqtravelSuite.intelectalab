<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Http\Controllers;

use App\Domain\Showcase\Actions\ManageAccessPasses;
use App\Domain\Showcase\Support\AccessPassDirectory;
use App\Domain\Showcase\Support\ShowcaseRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AccessPassController
{
    public function index(AccessPassDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview()]);
    }

    public function store(Request $request, ManageAccessPasses $passes): JsonResponse
    {
        $data = $request->validate([
            'tenant' => ['required', 'string', 'max:20'],
            'days' => ['required', 'integer', 'between:1,'.ShowcaseRules::PASS_MAX_DAYS],
            'price' => ['nullable', 'numeric', 'min:0', 'max:99999'],
            'features' => ['required', 'array', 'min:1'],
            'features.*' => ['string', 'max:50'],
            'reason' => ['required', 'string', 'min:5', 'max:200'],
            'convert_to' => ['nullable', 'string', 'max:30'],
            'source' => ['nullable', 'in:consola,vitrina,ventas'],
        ], [
            'tenant.*' => 'Elige la agencia.',
            'days.*' => 'El pase dura de 1 a 60 días.',
            'price.*' => 'El precio debe ser 0 (cortesía) o un monto positivo.',
            'features.*' => 'Elige al menos una función para el pase.',
            'reason.*' => 'Explica el motivo del pase.',
        ]);

        return response()->json(['data' => $passes->create($data, PlatformShowcaseController::user($request))]);
    }

    public function extend(Request $request, string $code, ManageAccessPasses $passes): JsonResponse
    {
        $data = $request->validate(['days' => ['required', 'integer', 'between:1,59']], ['days.*' => 'Indica cuántos días extender.']);

        return response()->json(['data' => $passes->extend($code, (int) $data['days'], PlatformShowcaseController::user($request))]);
    }

    public function convert(Request $request, string $code, ManageAccessPasses $passes): JsonResponse
    {
        $data = $request->validate(['plan' => ['nullable', 'string', 'max:30']]);

        return response()->json(['data' => $passes->convert($code, $data['plan'] ?? null, PlatformShowcaseController::user($request))]);
    }

    public function revoke(Request $request, string $code, ManageAccessPasses $passes): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:200']]);

        return response()->json(['data' => $passes->revoke($code, $data['reason'] ?? null, PlatformShowcaseController::user($request))]);
    }

    public function billing(Request $request, string $code, ManageAccessPasses $passes): JsonResponse
    {
        $data = $request->validate([
            'billing_mode' => ['required', 'in:mensual,unico,ambos'],
            'price_once' => ['nullable', 'numeric', 'min:0', 'max:999999'],
            'price_month' => ['nullable', 'numeric', 'min:0', 'max:999999'],
        ], ['billing_mode.*' => 'Elige pago único, mensual o ambos.']);

        return response()->json(['data' => $passes->billing($code, $data, PlatformShowcaseController::user($request))]);
    }
}
