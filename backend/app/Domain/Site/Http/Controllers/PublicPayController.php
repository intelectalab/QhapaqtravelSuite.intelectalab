<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Finance\Actions\GiftCards;
use App\Domain\Finance\Actions\PaymentLinks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PublicPayController
{
    public function show(string $token, PaymentLinks $links): JsonResponse
    {
        return response()->json(['data' => $links->publicView($token)]);
    }

    public function checkout(Request $request, string $token, PaymentLinks $links): JsonResponse
    {
        $data = $request->validate([
            'method' => ['required', 'in:'.implode(',', array_keys(PaymentLinks::METHODS))],
            'card_token' => ['required_if:method,card', 'nullable', 'string', 'max:120'],
            'installments' => ['nullable', 'integer', 'between:1,24'],
            'email' => ['nullable', 'email:rfc', 'max:190'],
        ], [
            'method.*' => 'Elige un medio de pago.',
            'card_token.*' => 'Completa los datos de la tarjeta.',
            'installments.*' => 'Elige de 1 a 24 cuotas.',
            'email.*' => 'Escribe un correo válido para enviarte el comprobante.',
        ]);

        return response()->json(['data' => $links->checkout($token, $data)]);
    }

    public function buyGiftCard(Request $request, GiftCards $cards): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'regex:/^\d{1,8}(\.\d{1,2})?$/'],
            'currency' => ['required', 'in:PEN,USD'],
            'buyer_name' => ['required', 'string', 'min:3', 'max:160'],
            'buyer_email' => ['required', 'email:rfc', 'max:190'],
            'recipient_name' => ['nullable', 'string', 'max:160'],
            'recipient_email' => ['nullable', 'email:rfc', 'max:190'],
            'message' => ['nullable', 'string', 'max:500'],
            'card_token' => ['required', 'string', 'max:120'],
        ], GiftCards::messages());

        return response()->json(['data' => $cards->purchase($data)]);
    }

    public function giftCardBalance(Request $request, GiftCards $cards): JsonResponse
    {
        $data = $request->validate(['redeem_code' => ['required', 'string', 'min:12', 'max:40']], GiftCards::messages());

        return response()->json(['data' => $cards->balance($data['redeem_code'])]);
    }
}
