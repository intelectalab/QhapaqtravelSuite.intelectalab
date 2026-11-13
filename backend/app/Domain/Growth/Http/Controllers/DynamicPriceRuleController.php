<?php

declare(strict_types=1);

namespace App\Domain\Growth\Http\Controllers;

use App\Domain\Growth\DynamicPricing\DynamicPriceCalculator;
use App\Domain\Growth\DynamicPricing\DynamicPriceRules;
use App\Domain\Growth\Shared\GrowthRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class DynamicPriceRuleController
{
    private const MESSAGES = [
        'name.*' => 'Escribe un nombre de 3 a 120 caracteres.',
        'product.*' => 'Elige un producto del catálogo o déjalo vacío para todo el catálogo.',
        'basis.*' => 'Elige en qué se basa la regla.',
        'conditions.*' => 'Indica la condición de la regla.',
        'adjust_pct.*' => 'El ajuste va de -50 % a 100 %.',
        'floor_pct.*' => 'El piso va de -50 % a 0 %.',
        'ceiling_pct.*' => 'El techo va de 0 % a 100 %.',
        'priority.*' => 'La prioridad va de 1 a 999.',
        'channels.*' => 'Elige al menos un canal.',
        'valid_from.*' => 'Escribe una fecha válida.',
        'valid_to.*' => 'Escribe una fecha válida.',
        'active.*' => 'Indica si la regla queda activa.',
        'date.*' => 'Elige la fecha de viaje a simular.',
        'channel.*' => 'Elige el canal a simular.',
        'occupancy.*' => 'La ocupación va de 0 a 1.',
        'demand.*' => 'La demanda va de 0 a 1.',
        'base_price.*' => 'El precio base debe ser mayor a cero.',
        'currency.*' => 'La moneda va en tres letras.',
    ];

    public function __construct(private readonly DynamicPriceRules $rules) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->rules->index($request));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->fields(true), self::MESSAGES);

        return response()->json(['data' => $this->rules->create($data, GrowthRules::actor($request))], 201);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $data = $request->validate($this->fields(false), self::MESSAGES);

        return response()->json(['data' => $this->rules->update($code, $data, GrowthRules::actor($request))]);
    }

    public function simulate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product' => ['nullable', 'string', 'max:40'],
            'date' => ['required', 'date'],
            'channel' => ['required', Rule::in(array_keys(DynamicPriceCalculator::CHANNELS))],
            'occupancy' => ['nullable', 'numeric', 'between:0,1'],
            'demand' => ['nullable', 'numeric', 'between:0,1'],
            'base_price' => ['nullable', 'numeric', 'gt:0', 'max:9999999'],
            'currency' => ['nullable', 'string', 'size:3'],
            'include_inactive' => ['nullable', 'boolean'],
        ], self::MESSAGES);

        return response()->json(['data' => $this->rules->simulate($data)]);
    }

    private function fields(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'min:3', 'max:120'],
            'product' => ['sometimes', 'nullable', 'string', 'max:40'],
            'basis' => [$required, Rule::in(array_keys(DynamicPriceCalculator::BASES))],
            'conditions' => [$required, 'array'],
            'adjust_pct' => [$required, 'numeric', 'between:-50,100'],
            'floor_pct' => ['sometimes', 'numeric', 'between:-50,0'],
            'ceiling_pct' => ['sometimes', 'numeric', 'between:0,100'],
            'priority' => ['sometimes', 'integer', 'between:1,999'],
            'channels' => ['sometimes', 'array', 'min:1'],
            'channels.*' => [Rule::in(array_keys(DynamicPriceCalculator::CHANNELS))],
            'valid_from' => ['sometimes', 'nullable', 'date'],
            'valid_to' => ['sometimes', 'nullable', 'date'],
            'active' => ['sometimes', 'boolean'],
            'lock_version' => ['sometimes', 'integer'],
        ];
    }
}
