<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Site\Actions\SiteCart;
use App\Domain\Site\Actions\WidgetHandoffs;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SiteWidgetController
{
    public function config(Request $request, WidgetHandoffs $handoffs): JsonResponse
    {
        $data = $request->validate(['product' => ['nullable', 'string', 'max:160']]);

        return response()->json(['data' => $handoffs->config($data['product'] ?? null)]);
    }

    public function start(Request $request, WidgetHandoffs $handoffs): JsonResponse
    {
        $data = $request->validate([
            'product' => ['required', 'string', 'max:160'],
            'date' => ['required', 'date_format:Y-m-d'],
            'adults' => ['required', 'integer', 'min:1', 'max:40'],
            'children' => ['nullable', 'integer', 'min:0', 'max:20'],
            'infants' => ['nullable', 'integer', 'min:0', 'max:10'],
            'lang' => ['nullable', 'in:es,en'],
            'currency' => ['nullable', 'in:PEN,USD'],
            'origin' => ['nullable', 'string', 'max:253'],
        ], [
            'product.*' => 'Elige un producto.',
            'date.*' => 'Elige una fecha disponible.',
            'adults.*' => 'Incluye al menos 1 adulto.',
            '*' => 'Revisa la selección.',
        ]);

        return response()->json(['data' => $handoffs->start($data)], 201);
    }

    public function cart(Request $request, WidgetHandoffs $handoffs, SiteCart $cart): JsonResponse
    {
        $data = $request->validate([
            'handoff' => ['required_without:product', 'nullable', 'string', 'max:20'],
            'product' => ['required_without:handoff', 'nullable', 'string', 'max:160'],
            'date' => ['required_with:product', 'nullable', 'date_format:Y-m-d'],
            'adults' => ['required_with:product', 'nullable', 'integer', 'min:1', 'max:40'],
            'children' => ['nullable', 'integer', 'min:0', 'max:20'],
            'infants' => ['nullable', 'integer', 'min:0', 'max:10'],
        ], [
            'handoff.*' => 'Indica la selección del widget o el producto.',
            'product.*' => 'Elige un producto.',
            'date.*' => 'Elige una fecha disponible.',
            'adults.*' => 'Incluye al menos 1 adulto.',
        ]);
        $token = $request->cookies->get((string) config('sites.cart_cookie'));
        $token = is_string($token) && $token !== '' ? $token : null;

        $result = isset($data['handoff'])
            ? $handoffs->claim($token, $data['handoff'])
            : $cart->add($token, ['product' => $data['product'], 'date' => $data['date'], 'adults' => $data['adults'], 'children' => $data['children'] ?? 0, 'infants' => $data['infants'] ?? 0]);

        return response()->json(['data' => $result], 201);
    }
}
