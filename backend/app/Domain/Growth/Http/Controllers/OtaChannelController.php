<?php

declare(strict_types=1);

namespace App\Domain\Growth\Http\Controllers;

use App\Domain\Growth\Ota\OtaChannel;
use App\Domain\Growth\Shared\GrowthRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class OtaChannelController
{
    private const MESSAGES = [
        'ota.*' => 'Elige la OTA.',
        'name.*' => 'Escribe un nombre de 3 a 120 caracteres.',
        'account_ref.*' => 'La cuenta de proveedor admite hasta 120 caracteres.',
        'api_key.*' => 'Escribe la clave que te dio la OTA (8 a 500 caracteres).',
        'commission_pct.*' => 'La comisión de la OTA va de 0 % a 60 %.',
        'markup_pct.*' => 'El margen va de -20 % a 100 %.',
        'sync_availability.*' => 'Indica si se publica la disponibilidad.',
        'action.*' => 'La acción debe ser pausar, reanudar o desconectar.',
        'ota_product_ref.*' => 'Escribe el código del producto en la OTA.',
        'ota_option_ref.*' => 'La opción admite hasta 120 caracteres.',
        'price_mode.*' => 'Elige cómo se calcula el precio para la OTA.',
        'fixed_price.*' => 'El precio fijo debe ser mayor a cero.',
        'status.*' => 'Elige el estado del mapeo.',
    ];

    public function __construct(private readonly OtaChannel $channel) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->channel->connections()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ota' => ['required', Rule::in(array_keys(OtaChannel::OTAS))],
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'account_ref' => ['nullable', 'string', 'max:120'],
            'api_key' => ['required', 'string', 'min:8', 'max:500'],
            'commission_pct' => ['nullable', 'numeric', 'between:0,60'],
            'markup_pct' => ['nullable', 'numeric', 'between:-20,100'],
            'sync_availability' => ['nullable', 'boolean'],
        ], self::MESSAGES);

        return response()->json(['data' => $this->channel->create($data, GrowthRules::actor($request))], 201);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:3', 'max:120'],
            'account_ref' => ['sometimes', 'nullable', 'string', 'max:120'],
            'api_key' => ['sometimes', 'string', 'min:8', 'max:500'],
            'commission_pct' => ['sometimes', 'numeric', 'between:0,60'],
            'markup_pct' => ['sometimes', 'numeric', 'between:-20,100'],
            'sync_availability' => ['sometimes', 'boolean'],
            'action' => ['sometimes', Rule::in(['pausar', 'reanudar', 'desconectar'])],
        ], self::MESSAGES);

        return response()->json(['data' => $this->channel->update($code, $data, GrowthRules::actor($request))]);
    }

    public function sync(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->channel->sync($code, GrowthRules::actor($request))]);
    }

    public function mappings(string $code): JsonResponse
    {
        return response()->json(['data' => $this->channel->mappings($code)]);
    }

    public function map(Request $request, string $code, string $productId): JsonResponse
    {
        $data = $request->validate([
            'ota_product_ref' => ['required', 'string', 'max:120'],
            'ota_option_ref' => ['nullable', 'string', 'max:120'],
            'price_mode' => ['nullable', Rule::in(array_keys(OtaChannel::PRICE_MODES))],
            'fixed_price' => ['nullable', 'numeric', 'gt:0', 'max:9999999'],
            'status' => ['nullable', Rule::in(array_keys(OtaChannel::MAPPING_STATUSES))],
        ], self::MESSAGES);

        return response()->json(['data' => $this->channel->map($code, $productId, $data, GrowthRules::actor($request))]);
    }

    public function bookings(Request $request): JsonResponse
    {
        return response()->json($this->channel->bookings($request));
    }
}
