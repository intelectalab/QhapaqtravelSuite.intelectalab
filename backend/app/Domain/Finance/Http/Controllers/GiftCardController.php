<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\GiftCards;
use App\Domain\Finance\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Finance\Support\GiftCardDirectory;
use App\Domain\Finance\Support\GrowthFeatureGate;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class GiftCardController
{
    use ResolvesActor;

    public function index(Request $request, GiftCardDirectory $directory, GiftCards $cards, GrowthFeatureGate $gate): JsonResponse
    {
        $gate->require(GiftCards::RULE);
        $cards->expireDue();

        return response()->json($directory->list($request));
    }

    public function show(string $code, GiftCardDirectory $directory, GiftCards $cards, GrowthFeatureGate $gate): JsonResponse
    {
        $gate->require(GiftCards::RULE);
        $cards->expireDue();

        return response()->json(['data' => $directory->detail($code) ?? throw ApiException::notFound('El vale no existe.')]);
    }

    public function store(Request $request, GiftCards $cards): JsonResponse
    {
        $data = $request->validate(GiftCards::issueRules(), GiftCards::messages());

        return response()->json(['data' => $cards->issue($data, $this->actor($request))]);
    }

    public function redeem(Request $request, string $code, GiftCards $cards): JsonResponse
    {
        $data = $request->validate([
            'redeem_code' => ['required', 'string', 'max:40'],
            'amount' => ['required', 'regex:/^\d{1,8}(\.\d{1,2})?$/'],
            'receivable_id' => ['nullable', 'string', 'max:40', 'required_without:reservation_id'],
            'reservation_id' => ['nullable', 'string', 'max:40', 'required_without:receivable_id'],
        ], [
            ...GiftCards::messages(),
            'amount.*' => 'Escribe el monto a canjear con hasta dos decimales.',
            'receivable_id.required_without' => 'Elige la cuota o la reserva que se paga con el vale.',
            'reservation_id.required_without' => 'Elige la cuota o la reserva que se paga con el vale.',
        ]);

        return response()->json(['data' => $cards->redeem($code, $data, $this->actor($request))]);
    }

    public function void(Request $request, string $code, GiftCards $cards): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:300']], ['reason.*' => 'El motivo admite hasta 300 caracteres.']);

        return response()->json(['data' => $cards->void($code, $data['reason'] ?? null, $this->actor($request))]);
    }
}
