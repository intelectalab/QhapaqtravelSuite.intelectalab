<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Site\Actions\SiteCart;
use App\Domain\Site\Actions\SiteCheckout;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
        $factura = $request->input('billing_type') === 'Factura';
        $doc = match ($request->input('doc_type')) {
            'DNI' => 'regex:/^\d{8}$/',
            'CE' => 'regex:/^[A-Za-z0-9]{9,12}$/',
            default => 'regex:/^[A-Za-z0-9]{6,15}$/',
        };
        $data = $request->validate([
            'name' => ['required', 'string', 'min:5', 'max:150', 'regex:/\S+\s+\S+/u'],
            'email' => ['required', 'email', 'max:190'],
            'phone' => ['required', 'string', 'regex:/^[0-9+()\s-]{7,20}$/'],
            'country' => ['required', 'string', 'max:60'],
            'doc_type' => ['required', 'in:DNI,CE,Pasaporte'],
            'doc_number' => ['required', 'string', $doc],
            'billing_type' => ['required', 'in:Boleta,Factura'],
            'ruc' => [$factura ? 'required' : 'nullable', 'regex:/^(10|15|17|20)\d{9}$/'],
            'business_name' => [$factura ? 'required' : 'nullable', 'string', 'max:200'],
            'fiscal_address' => [$factura ? 'required' : 'nullable', 'string', 'max:250'],
            'terms' => ['accepted'],
            'privacy' => ['accepted'],
            'marketing' => ['boolean'],
        ], [
            'name.*' => 'Escribe nombres y apellidos.',
            'email.*' => 'Escribe un correo válido; ahí enviaremos la confirmación.',
            'phone.*' => 'Escribe un celular válido (al menos 7 dígitos).',
            'country.*' => 'Indica tu país.',
            'doc_type.*' => 'Elige el tipo de documento.',
            'doc_number.*' => 'El número de documento no es válido para el tipo elegido.',
            'ruc.*' => 'El RUC debe tener 11 dígitos y empezar en 10, 15, 17 o 20.',
            'business_name.*' => 'Escribe la razón social.',
            'fiscal_address.*' => 'Escribe la dirección fiscal.',
            'terms.*' => 'Debes aceptar los términos y las políticas de cancelación.',
            'privacy.*' => 'Debes autorizar el tratamiento de tus datos (Ley 29733).',
            '*' => 'Revisa este dato.',
        ]);

        return response()->json(['data' => $checkout->place($this->token($request), $data)], 201);
    }

    public function order(Request $request, string $code, SiteCheckout $checkout): JsonResponse
    {
        return response()->json(['data' => $checkout->order($code, $request->header('X-Order-Token'))]);
    }

    public function pay(Request $request, string $code, SiteCheckout $checkout): JsonResponse
    {
        return response()->json(['data' => $checkout->simulatePayment($code, $request->header('X-Order-Token'))]);
    }

    private function token(Request $request): ?string
    {
        $cookie = $request->cookies->get((string) config('sites.cart_cookie'));

        return is_string($cookie) && $cookie !== '' ? $cookie : null;
    }
}
