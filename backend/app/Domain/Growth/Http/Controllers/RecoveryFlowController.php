<?php

declare(strict_types=1);

namespace App\Domain\Growth\Http\Controllers;

use App\Domain\Growth\Recovery\RecoveryFlows;
use App\Domain\Growth\Shared\GrowthRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class RecoveryFlowController
{
    private const MESSAGES = [
        'name.*' => 'Escribe un nombre de 3 a 120 caracteres.',
        'trigger_kind.*' => 'Elige si recupera carritos o cotizaciones.',
        'delay_minutes.*' => 'La espera va de 15 minutos a 14 días (20 160 minutos).',
        'channel.*' => 'Elige el canal: correo o WhatsApp.',
        'template_ref.*' => 'Elige la plantilla del mensaje.',
        'max_attempts.*' => 'Los intentos van de 1 a 5.',
        'include_payment_link.*' => 'Indica si el mensaje lleva link de pago.',
        'active.*' => 'Indica si el flujo queda activo.',
    ];

    public function __construct(private readonly RecoveryFlows $flows) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->flows->overview()]);
    }

    public function attempts(Request $request): JsonResponse
    {
        return response()->json($this->flows->attempts($request));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules(true), self::MESSAGES);

        return response()->json(['data' => $this->flows->create($data, GrowthRules::actor($request))], 201);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $data = $request->validate($this->rules(false), self::MESSAGES);

        return response()->json(['data' => $this->flows->update($code, $data, GrowthRules::actor($request))]);
    }

    private function rules(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'min:3', 'max:120'],
            'trigger_kind' => [$required, Rule::in(array_keys(RecoveryFlows::TRIGGERS))],
            'delay_minutes' => [$required, 'integer', 'between:15,20160'],
            'channel' => [$required, Rule::in(array_keys(RecoveryFlows::CHANNELS))],
            'template_ref' => [$required, 'string', 'max:80'],
            'max_attempts' => ['sometimes', 'integer', 'between:1,5'],
            'include_payment_link' => ['sometimes', 'boolean'],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}
