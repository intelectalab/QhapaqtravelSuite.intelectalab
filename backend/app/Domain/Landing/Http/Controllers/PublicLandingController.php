<?php

declare(strict_types=1);

namespace App\Domain\Landing\Http\Controllers;

use App\Domain\Landing\Actions\CheckoutSignup;
use App\Domain\Landing\Actions\RegisterSalesLead;
use App\Domain\Landing\Actions\RegisterSignup;
use App\Domain\Landing\Contracts\RucLookup;
use App\Domain\Landing\Support\LandingPlans;
use App\Domain\Landing\Support\SignupDirectory;
use App\Domain\Landing\Support\SignupQuote;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PublicLandingController
{
    public function plans(LandingPlans $plans): JsonResponse
    {
        return response()->json(['data' => $plans->catalog()])->header('Cache-Control', 'public, max-age=300');
    }

    public function coupon(Request $request, SignupQuote $quote): JsonResponse
    {
        $data = $request->validate([
            'coupon' => ['required', 'string', 'max:30'],
            'plan' => ['required', 'string', 'max:20'],
            'cycle' => ['required', Rule::in(['mensual', 'anual'])],
            'addons' => ['nullable', 'array', 'max:10'],
            'addons.*' => ['integer', 'min:1', 'max:50'],
        ], [
            'coupon.*' => 'Escribe el código del cupón.',
            'plan.*' => 'Elige un plan.',
            'cycle.*' => 'Los cupones aplican a planes mensuales o anuales.',
        ]);
        $plan = $quote->plan($data['plan']);
        $coupon = $quote->coupon($data['coupon'], $plan);

        return response()->json(['data' => [
            'valid' => true,
            'coupon' => $coupon->code,
            'type' => $coupon->type,
            'value' => (string) $coupon->value,
            'duration_cycles' => (int) $coupon->duration_cycles,
            'totals' => $quote->totals($plan, $data['cycle'], $coupon, $quote->addons((array) ($data['addons'] ?? []), $plan)),
        ]]);
    }

    public function ruc(string $ruc, RucLookup $lookup): JsonResponse
    {
        $taxpayer = preg_match('/^\d{11}$/', $ruc) === 1 ? $lookup->find($ruc) : null;

        if ($taxpayer === null) {
            throw ApiException::unprocessable('RUC_INVALID', 'El RUC no es válido: debe tener 11 dígitos, empezar en 10 o 20 y figurar en SUNAT.', ['field' => 'ruc']);
        }

        if (! $taxpayer['active']) {
            throw ApiException::unprocessable('RUC_INVALID', "El RUC figura en SUNAT como {$taxpayer['status']}. Usa un RUC activo.", ['field' => 'ruc', 'taxpayer' => $taxpayer]);
        }

        return response()->json(['data' => $taxpayer]);
    }

    public function signup(Request $request, RegisterSignup $register): JsonResponse
    {
        return response()->json(['data' => $register(RegisterSignup::validate($request->all()))], 201);
    }

    public function checkout(Request $request, string $token, CheckoutSignup $checkout): JsonResponse
    {
        $result = $checkout($token, CheckoutSignup::validate($request->all()));

        return response()->json(['data' => $result], ($result['state'] ?? null) === 'pago_pendiente' ? 202 : 200);
    }

    public function show(string $token, SignupDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->show($token)]);
    }

    public function salesLead(Request $request, RegisterSalesLead $register): JsonResponse
    {
        $result = $register(RegisterSalesLead::validate($request->all()));

        return response()->json(['data' => [
            ...$result,
            'message' => $result['repeated'] ? 'Ya teníamos tus datos. El equipo comercial te escribirá muy pronto.' : 'Gracias. El equipo comercial te escribirá en menos de 2 horas hábiles.',
        ]], $result['repeated'] ? 200 : 201);
    }
}
