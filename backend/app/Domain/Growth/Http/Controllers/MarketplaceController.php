<?php

declare(strict_types=1);

namespace App\Domain\Growth\Http\Controllers;

use App\Domain\Growth\Marketplace\Marketplace;
use App\Domain\Growth\Shared\GrowthRules;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class MarketplaceController
{
    private const MESSAGES = [
        'product.*' => 'Elige un producto activo de tu catálogo.',
        'title.*' => 'El título admite de 3 a 200 caracteres.',
        'summary.*' => 'El resumen admite hasta 1000 caracteres.',
        'reseller_commission_pct.*' => 'La comisión para el revendedor va de 0 % a 40 %.',
        'publish.*' => 'Indica si se publica ahora.',
        'status.*' => 'Elige el estado de la publicación.',
        'listing.*' => 'Elige una publicación del marketplace.',
        'payment_terms.*' => 'Elige prepago o crédito.',
        'credit_limit.*' => 'La línea de crédito debe ser cero o más.',
        'decision.*' => 'Elige aceptar, rechazar, suspender, reactivar o terminar.',
        'pax.*' => 'Indica de 1 a 99 pasajeros.',
        'travel_date.*' => 'Elige la fecha de viaje.',
        'gross_amount.*' => 'El monto debe ser mayor a cero.',
    ];

    public function __construct(private readonly Marketplace $marketplace) {}

    public function listings(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->marketplace->listings(CursorPage::filters($request))]);
    }

    public function publish(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product' => ['required', 'string', 'max:40'],
            'title' => ['nullable', 'string', 'min:3', 'max:200'],
            'summary' => ['nullable', 'string', 'max:1000'],
            'reseller_commission_pct' => ['required', 'numeric', 'between:0,40'],
            'publish' => ['nullable', 'boolean'],
        ], self::MESSAGES);

        return response()->json(['data' => $this->marketplace->publish($data, GrowthRules::actor($request))], 201);
    }

    public function updateListing(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'min:3', 'max:200'],
            'summary' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'reseller_commission_pct' => ['sometimes', 'numeric', 'between:0,40'],
            'status' => ['sometimes', Rule::in(array_keys(Marketplace::LISTING_STATUSES))],
            'refresh_price' => ['sometimes', 'boolean'],
        ], self::MESSAGES);

        return response()->json(['data' => $this->marketplace->updateListing($id, $data, GrowthRules::actor($request))]);
    }

    public function partnerships(): JsonResponse
    {
        return response()->json(['data' => $this->marketplace->partnerships()]);
    }

    public function requestPartnership(Request $request): JsonResponse
    {
        $data = $request->validate([
            'listing' => ['required', 'string', 'max:40'],
            'payment_terms' => ['nullable', Rule::in(['prepago', 'credito'])],
            'credit_limit' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
        ], self::MESSAGES);

        return response()->json(['data' => $this->marketplace->requestPartnership($data, GrowthRules::actor($request))], 201);
    }

    public function decide(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['decision' => ['required', Rule::in(Marketplace::DECISIONS)]], self::MESSAGES);

        return response()->json(['data' => $this->marketplace->decide($id, $data['decision'], GrowthRules::actor($request))]);
    }

    public function orders(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->marketplace->orders(CursorPage::filters($request))]);
    }

    public function sell(Request $request): JsonResponse
    {
        $data = $request->validate([
            'listing' => ['required', 'string', 'max:40'],
            'pax' => ['required', 'integer', 'between:1,99'],
            'travel_date' => ['required', 'date', 'after_or_equal:today'],
            'gross_amount' => ['nullable', 'numeric', 'gt:0', 'max:99999999'],
        ], self::MESSAGES);

        return response()->json(['data' => $this->marketplace->sell($data, (string) $request->header('Idempotency-Key'), GrowthRules::actor($request))], 201);
    }
}
