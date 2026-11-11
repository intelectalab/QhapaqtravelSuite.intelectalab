<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Site\Actions\SiteCart;
use App\Domain\Site\Actions\SiteCheckout;
use App\Domain\Site\Support\CheckoutRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class SiteCartController
{
    public function show(Request $request, SiteCart $cart): JsonResponse
    {
        return response()->json(['data' => $cart->show($this->token($request))]);
    }

    public function add(Request $request, SiteCart $cart): JsonResponse
    {
        $data = $request->validate([
            'product' => ['required', 'string', 'max:160'],
            'date' => ['required', 'date_format:Y-m-d'],
            'adults' => ['required', 'integer', 'min:1', 'max:40'],
            'children' => ['nullable', 'integer', 'min:0', 'max:20'],
            'infants' => ['nullable', 'integer', 'min:0', 'max:10'],
            'promo' => ['nullable', 'string', 'max:40'],
        ], [
            'product.*' => 'Elige un producto.',
            'date.*' => 'Elige una fecha disponible.',
            'adults.*' => 'Incluye al menos 1 adulto.',
            '*' => 'Revisa los viajeros.',
        ]);

        return response()->json(['data' => $cart->add($this->token($request), $data)], 201);
    }

    public function shopOrder(Request $request, SiteCart $cart, SiteCheckout $checkout): JsonResponse
    {
        $item = $request->validate([
            'product' => ['required', 'string', 'max:160'],
            'date' => ['required', 'date_format:Y-m-d'],
            'adults' => ['required', 'integer', 'min:1', 'max:40'],
            'children' => ['nullable', 'integer', 'min:0', 'max:20'],
            'infants' => ['nullable', 'integer', 'min:0', 'max:10'],
            'promo' => ['nullable', 'string', 'max:40'],
        ], [
            'product.*' => 'Elige un producto.',
            'date.*' => 'Elige una fecha del calendario.',
            'adults.*' => 'Incluye al menos 1 adulto.',
        ]);

        return DB::transaction(function () use ($request, $cart, $checkout, $item): JsonResponse {
            $token = (string) $cart->add(null, $item)['token'];

            return response()->json(['data' => $checkout->place($token, $request->except(['product', 'date', 'adults', 'children', 'infants', 'promo']))], 201);
        });
    }

    public function applyPromo(Request $request, SiteCart $cart): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'min:3', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/']], ['code.*' => 'Escribe un código válido.']);

        return response()->json(['data' => $cart->promo($this->token($request), $data['code'])]);
    }

    public function clearPromo(Request $request, SiteCart $cart): JsonResponse
    {
        return response()->json(['data' => $cart->promo($this->token($request), null)]);
    }

    public function remove(Request $request, int $line, SiteCart $cart): JsonResponse
    {
        return response()->json(['data' => $cart->remove($this->token($request), $line)]);
    }

    public function hold(Request $request, int $line, SiteCart $cart): JsonResponse
    {
        return response()->json(['data' => $cart->rehold($this->token($request), $line)]);
    }

    public function checkout(Request $request, SiteCheckout $checkout): JsonResponse
    {
        return response()->json(['data' => $checkout->place($this->token($request), $request->all())], 201);
    }

    public function validateCheckout(Request $request, SiteCheckout $checkout): JsonResponse
    {
        $step = (string) $request->input('step', '');

        if ($step !== '' && ! in_array($step, CheckoutRules::STEPS, true)) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Paso desconocido.', ['step' => ['Paso desconocido.']]);
        }

        return response()->json(['data' => $checkout->validate($this->token($request), $step, $request->except('step'))]);
    }

    public function order(Request $request, string $code, SiteCheckout $checkout): JsonResponse
    {
        return response()->json(['data' => $checkout->order($code, $request->header('X-Order-Token'))]);
    }

    public function pay(Request $request, string $code, SiteCheckout $checkout): JsonResponse
    {
        return response()->json(['data' => $checkout->pay($code, $request->header('X-Order-Token'), $request->only(['method', 'card_token', 'card_holder', 'operation_ref', 'session_id']))]);
    }

    public function paymentSession(Request $request, string $code, SiteCheckout $checkout): JsonResponse
    {
        $data = $request->validate(['return_url' => ['nullable', 'url', 'max:500']], ['return_url.*' => 'La dirección de retorno no es válida.']);

        return response()->json(['data' => $checkout->session($code, $request->header('X-Order-Token'), $data['return_url'] ?? null)], 201);
    }

    private function token(Request $request): ?string
    {
        $cookie = $request->cookies->get((string) config('sites.cart_cookie'));

        return is_string($cookie) && $cookie !== '' ? $cookie : null;
    }
}
