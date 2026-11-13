<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Site\Actions\SiteCart;
use App\Domain\Site\Actions\SiteCheckout;
use App\Domain\Site\Support\CheckoutRules;
use App\Domain\Site\Support\SiteBooking;
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
            'quote_token' => ['nullable', 'string', 'max:2000'],
            'source' => ['nullable', 'string', 'in:sitio,widget'],
            ...SiteBooking::rules(),
        ], [
            'product.*' => 'Elige un producto.',
            'date.*' => 'Elige una fecha disponible.',
            'adults.*' => 'Incluye al menos 1 adulto.',
            ...SiteBooking::messages(),
            '*' => 'Revisa los viajeros.',
        ]);

        return response()->json(['data' => $cart->add($this->token($request), $data)], 201);
    }

    public function bookings(Request $request, SiteCart $cart, SiteCheckout $checkout): JsonResponse
    {
        $data = $request->validate([
            'quote_token' => ['required', 'string', 'max:2000'],
            'product' => ['required', 'string', 'max:160'],
            'date' => ['required', 'date_format:Y-m-d'],
            'adults' => ['required', 'integer', 'min:1', 'max:40'],
            'children' => ['nullable', 'integer', 'min:0', 'max:20'],
            'infants' => ['nullable', 'integer', 'min:0', 'max:10'],
            'promo' => ['nullable', 'string', 'max:40'],
            'source' => ['nullable', 'string', 'in:sitio,widget'],
            ...SiteBooking::rules(),
        ], [
            'quote_token.*' => 'Cotiza el precio antes de reservar.',
            'product.*' => 'Elige un producto.',
            'date.*' => 'Elige una fecha disponible.',
            'adults.*' => 'Incluye al menos 1 adulto.',
            ...SiteBooking::messages(),
        ]);

        $order = DB::transaction(function () use ($cart, $checkout, $data, $request): array {
            try {
                $added = $cart->add(null, $data);
            } catch (ApiException $exception) {
                if ($exception->ruleCode === 'SIT-BR-05') {
                    throw ApiException::conflict('AVAIL_CHANGED', 'La fecha ya no está disponible para ese grupo. Elige otra fecha o cambia los viajeros.', ['reason' => $exception->getMessage()]);
                }

                throw $exception;
            }

            return $checkout->place((string) $added['token'], $request->all());
        });

        return response()->json(['data' => $order], 201);
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

    public function removedLines(Request $request, int $line, SiteCart $cart): JsonResponse
    {
        $data = $request->validate([
            'key' => ['required', 'string', 'max:60'],
            'removed' => ['required', 'boolean'],
            'lock_version' => ['nullable', 'integer', 'min:0'],
        ], [
            'key.*' => 'Indica el ítem que quieres quitar o restaurar.',
            'removed.*' => 'Indica si quitas o restauras el ítem.',
            'lock_version.*' => 'La versión del carrito no es válida.',
        ]);
        $ifMatch = trim(str_replace('W/', '', (string) $request->header('If-Match')), ' "');
        $version = isset($data['lock_version']) ? (int) $data['lock_version'] : (ctype_digit($ifMatch) ? (int) $ifMatch : null);

        return response()->json(['data' => $cart->removedLines($this->token($request), $line, $data['key'], (bool) $data['removed'], $version)]);
    }

    public function update(Request $request, int $line, SiteCart $cart): JsonResponse
    {
        $data = $request->validate([
            'adults' => ['nullable', 'integer', 'min:1', 'max:40'],
            'children' => ['nullable', 'integer', 'min:0', 'max:20'],
            'infants' => ['nullable', 'integer', 'min:0', 'max:10'],
            'options' => ['nullable', 'array', 'max:20'],
            'removed' => ['nullable', 'array', 'max:30'],
            ...SiteBooking::rules(),
        ], [
            'adults.*' => 'Incluye al menos 1 adulto.',
            'children.*' => 'Revisa el número de niños.',
            'infants.*' => 'Revisa el número de infantes.',
            ...SiteBooking::messages(),
        ]);
        $result = $cart->updateItem($this->token($request), $line, $data);

        return response()->json(['data' => $result['item'], 'meta' => ['cart' => $result['cart']]]);
    }

    public function preferences(Request $request, SiteCart $cart): JsonResponse
    {
        $data = $request->validate([
            'currency' => ['nullable', 'string', 'in:PEN,USD', 'required_without:locale'],
            'locale' => ['nullable', 'string', 'in:es,en', 'required_without:currency'],
        ], [
            'currency.*' => 'Elige soles (PEN) o dólares (USD).',
            'locale.*' => 'Elige español (es) o inglés (en).',
        ]);

        return response()->json(['data' => $cart->preferences($this->token($request), $data)]);
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
