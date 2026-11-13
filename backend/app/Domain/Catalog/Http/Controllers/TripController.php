<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\TripCatalogEditor;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Support\ProductBookingConfig;
use App\Domain\Catalog\Support\TripCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

final class TripController
{
    use ResolvesActor;

    private const TOUR_MESSAGES = [
        'leg_id.*' => 'Elige la ciudad del tour.',
        'code.*' => 'El código admite hasta 20 caracteres.',
        'name.*' => 'Escribe el nombre del tour (hasta 160 caracteres).',
        'day_offset.*' => 'El día del tramo va de 0 (llegada) a 30.',
        'start_time.*' => 'Indica la hora de inicio (HH:MM).',
        'duration_hours.*' => 'La duración va de 0,5 a 24 horas.',
        'currency.*' => 'Elige la moneda.',
        'price_adult.*' => 'Indica el precio por adulto.',
        'price_child.*' => 'El precio por niño no puede ser negativo.',
        'min_age.*' => 'La edad mínima va de 0 a 99 años.',
        'capacity.*' => 'El cupo por salida debe ser mayor que cero.',
        'provider_id.*' => 'Elige un proveedor del catálogo.',
    ];

    private const OPTION_MESSAGES = [
        'from_leg_id.*' => 'Elige la ciudad de origen.',
        'to_leg_id.*' => 'Elige la ciudad de destino.',
        'mode.*' => 'Elige el tipo de movilidad.',
        'name.*' => 'Escribe el nombre de la opción (hasta 160 caracteres).',
        'pricing.*' => 'Elige si se cobra por pasajero o por vehículo.',
        'currency.*' => 'Elige la moneda.',
        'price_adult.*' => 'Indica el precio por adulto.',
        'price_child.*' => 'El precio por niño no puede ser negativo.',
        'duration_hours.*' => 'La duración va de 0,5 a 99 horas.',
        'vehicles.*' => 'Revisa los vehículos: nombre, capacidad de 1 a 60 y precio.',
    ];

    public function __construct(
        private readonly TripCatalog $trip,
        private readonly TripCatalogEditor $editor,
        private readonly ProductBookingConfig $config,
    ) {}

    public function show(Request $request, string $product): JsonResponse
    {
        return response()->json(['data' => $this->trip->show($product, $this->actor($request))]);
    }

    public function nights(Request $request, string $product, string $leg): JsonResponse
    {
        $data = $request->validate([
            'min_nights' => ['nullable', 'integer', 'between:1,30'],
            'max_nights' => ['nullable', 'integer', 'between:1,30'],
        ], [
            'min_nights.*' => 'El mínimo de noches va de 1 a 30.',
            'max_nights.*' => 'El máximo va de 1 a 30 y no puede ser menor que el mínimo.',
        ]);
        $row = $this->config->product($product);
        $leg = $this->editor->nights($row->code, $this->lock($request), $leg, isset($data['min_nights']) ? (int) $data['min_nights'] : null, isset($data['max_nights']) ? (int) $data['max_nights'] : null, $this->actor($request));

        return response()->json(['data' => $leg, 'meta' => ['lock_version' => (int) $this->config->product($row->code)->lock_version]]);
    }

    public function seasonRates(string $hotel): JsonResponse
    {
        $rows = $this->trip->seasonRates($hotel);

        return response()->json(['data' => $rows, 'meta' => ['count' => count($rows), 'next_cursor' => null]]);
    }

    public function storeSeasonRate(Request $request, string $hotel): JsonResponse
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'max:60'],
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to' => ['required', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'adjust_pct' => ['required', 'numeric', 'between:-50,300'],
        ], [
            'label.*' => 'Escribe el nombre de la temporada (hasta 60 caracteres).',
            'date_from.*' => 'Indica la fecha de inicio.',
            'date_to.*' => 'La fecha de fin no puede ser anterior al inicio.',
            'adjust_pct.*' => 'El ajuste va de −50 % a 300 %.',
        ]);

        return response()->json(['data' => $this->editor->createSeason($hotel, $data, $this->actor($request))], 201);
    }

    public function destroySeasonRate(Request $request, string $hotel, string $rate): Response
    {
        $this->editor->deleteSeason($hotel, $rate, $this->actor($request));

        return response()->noContent();
    }

    public function storeTour(Request $request, string $product): JsonResponse
    {
        $row = $this->config->product($product);

        return response()->json(['data' => $this->editor->createTour($row->code, $this->tourData($request, true), $this->actor($request))], 201);
    }

    public function updateTour(Request $request, string $product, string $tour): JsonResponse
    {
        $row = $this->config->product($product);

        return response()->json(['data' => $this->editor->updateTour($row->code, $tour, $this->tourData($request, false), $this->actor($request))]);
    }

    public function storeTransport(Request $request, string $product): JsonResponse
    {
        $row = $this->config->product($product);

        return response()->json(['data' => $this->editor->createTransport($row->code, $this->optionData($request, true), $this->actor($request))]);
    }

    public function updateTransport(Request $request, string $product, string $option): JsonResponse
    {
        $row = $this->config->product($product);

        return response()->json(['data' => $this->editor->updateTransport($row->code, $option, $this->optionData($request, false), $this->actor($request))]);
    }

    private function tourData(Request $request, bool $create): array
    {
        $required = $create ? 'required' : 'sometimes';

        return $request->validate([
            'leg_id' => [$required, 'string', 'max:40'],
            'code' => ['sometimes', 'nullable', 'string', 'max:20'],
            'name' => [$required, 'string', 'max:160'],
            'day_offset' => ['sometimes', 'integer', 'between:0,30'],
            'start_time' => [$required, 'date_format:H:i'],
            'duration_hours' => [$required, 'numeric', 'min:0.5', 'max:24'],
            'currency' => [$required, Rule::in(['PEN', 'USD'])],
            'price_adult' => [$required, 'numeric', 'min:0', 'max:999999'],
            'price_child' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:999999'],
            'min_age' => ['sometimes', 'nullable', 'integer', 'between:0,99'],
            'capacity' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:999'],
            'provider_id' => ['sometimes', 'nullable', 'uuid'],
            'in_trip_sale' => ['sometimes', 'boolean'],
            'active' => ['sometimes', 'boolean'],
        ], self::TOUR_MESSAGES);
    }

    private function optionData(Request $request, bool $create): array
    {
        $required = $create ? 'required' : 'sometimes';

        return $request->validate([
            'code' => ['sometimes', 'nullable', 'string', 'max:20'],
            'from_leg_id' => [$required, 'string', 'max:40'],
            'to_leg_id' => ['sometimes', 'nullable', 'string', 'max:40'],
            'mode' => [$required, Rule::in(array_keys(TripCatalog::MODES))],
            'name' => [$required, 'string', 'max:160'],
            'pricing' => [$required, Rule::in(array_keys(TripCatalog::PRICING))],
            'currency' => [$required, Rule::in(['PEN', 'USD'])],
            'price_adult' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:999999'],
            'price_child' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:999999'],
            'duration_hours' => ['sometimes', 'nullable', 'numeric', 'min:0.5', 'max:99'],
            'provider_id' => ['sometimes', 'nullable', 'uuid'],
            'in_trip_sale' => ['sometimes', 'boolean'],
            'active' => ['sometimes', 'boolean'],
            'vehicles' => ['sometimes', 'array', 'max:8'],
            'vehicles.*.name' => ['required', 'string', 'max:60'],
            'vehicles.*.max_pax' => ['required', 'integer', 'between:1,60'],
            'vehicles.*.price' => ['required', 'numeric', 'min:0', 'max:999999'],
        ], self::OPTION_MESSAGES);
    }

    private function lock(Request $request): ?int
    {
        $value = $request->input('lock_version') ?? $request->header('If-Match');

        return $value === null || $value === '' ? null : (int) trim((string) $value, 'W/" ');
    }
}
