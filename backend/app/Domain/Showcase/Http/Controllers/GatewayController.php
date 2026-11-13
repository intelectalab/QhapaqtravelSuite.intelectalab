<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Showcase\Actions\ManageGateways;
use App\Domain\Showcase\Support\GatewayDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class GatewayController
{
    private const MESSAGES = [
        'provider.*' => 'Elige la pasarela.',
        'account_ref.*' => 'Indica la cuenta o el comercio (hasta 120 caracteres).',
        'currency.*' => 'La moneda usa el código de 3 letras (PEN, USD).',
        'fee_currency.*' => 'La moneda de la comisión usa el código de 3 letras.',
        'fee_pct.*' => 'La comisión va de 0 a 15 %.',
        'fee_fixed.*' => 'El cargo fijo no puede ser negativo.',
        'fx_spread_pct.*' => 'El margen de cambio va de 0 a 10 %.',
        'settle_days.*' => 'La liquidación va de 0 a 60 días.',
        'status.*' => 'Elige un estado válido.',
        'mode.*' => 'Elige sandbox o producción.',
    ];

    public function index(Request $request, GatewayDirectory $directory): JsonResponse
    {
        $user = $request->user();

        return response()->json(['data' => $directory->accounts($user instanceof User && $user->can('finance.gateways.manage'))]);
    }

    public function store(Request $request, ManageGateways $gateways): JsonResponse
    {
        $data = $request->validate($this->rules(true), self::MESSAGES);
        $user = $request->user();
        assert($user instanceof User);

        return response()->json(['data' => ['id' => $gateways->create($data, $user)]]);
    }

    public function update(Request $request, string $id, ManageGateways $gateways): JsonResponse
    {
        $data = $request->validate($this->rules(false), self::MESSAGES);
        $gateways->update($id, $data);

        return response()->json(['data' => ['id' => $id]]);
    }

    public function fees(Request $request, GatewayDirectory $directory): JsonResponse
    {
        $filters = $request->validate(['from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d'], 'gateway' => ['nullable', 'uuid']]);

        return response()->json(['data' => $directory->fees($filters)]);
    }

    public function import(Request $request, ManageGateways $gateways): JsonResponse
    {
        $data = $request->validate([
            'gateway' => ['required', 'uuid'],
            'lines' => ['nullable', 'array', 'max:2000'],
            'lines.*.payment' => ['required', 'string', 'max:30'],
            'lines.*.external_ref' => ['nullable', 'string', 'max:80'],
            'lines.*.gross' => ['nullable', 'numeric', 'gt:0'],
            'lines.*.fee' => ['required', 'numeric', 'min:0'],
            'lines.*.fee_tax' => ['nullable', 'numeric', 'min:0'],
            'lines.*.fx_spread' => ['nullable', 'numeric', 'min:0'],
            'lines.*.settled_on' => ['nullable', 'date_format:Y-m-d'],
        ], ['gateway.*' => 'Elige la pasarela.', 'lines.*' => 'Revisa las líneas del reporte: cobro, comisión y fecha.']);

        return response()->json(['data' => $gateways->import($data)]);
    }

    private function rules(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return [
            'provider' => [$creating ? 'required' : 'prohibited', 'in:'.implode(',', array_keys(ManageGateways::PROVIDERS))],
            'label' => ['nullable', 'string', 'max:80'],
            'account_ref' => [$required, 'string', 'min:3', 'max:120'],
            'currency' => [$creating ? 'required' : 'prohibited', 'regex:/^[A-Z]{3}$/'],
            'fee_currency' => ['nullable', 'regex:/^[A-Z]{3}$/'],
            'fee_pct' => ['nullable', 'numeric', 'between:0,15'],
            'fee_fixed' => ['nullable', 'numeric', 'min:0', 'max:9999'],
            'fx_spread_pct' => ['nullable', 'numeric', 'between:0,10'],
            'tax_on_fee' => ['nullable', 'boolean'],
            'settle_days' => ['nullable', 'integer', 'between:0,60'],
            'pass_fee_to_customer' => ['nullable', 'boolean'],
            'status' => ['nullable', 'in:pendiente,activa,pausada'],
            'mode' => ['nullable', 'in:sandbox,produccion'],
            'credentials' => ['nullable', 'array'],
            'credentials.client_id' => ['nullable', 'string', 'max:200'],
            'credentials.secret' => ['nullable', 'string', 'max:400'],
        ];
    }
}
