<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\ManageCurrencies;
use App\Domain\Finance\Actions\RegisterFxRate;
use App\Domain\Finance\Support\FxDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class FxRateController
{
    public function index(Request $request, FxDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->list($this->user($request))]);
    }

    public function store(Request $request, RegisterFxRate $register): JsonResponse
    {
        $data = $request->validate([
            'currency' => ['required', 'in:'.implode(',', array_keys(FxDirectory::CURRENCIES))],
            'rate' => ['required', 'numeric', 'gt:0.5', 'lt:20'],
            'buy' => ['nullable', 'numeric', 'gt:0.5', 'lt:20'],
            'sell' => ['nullable', 'numeric', 'gt:0.5', 'lt:20'],
            'rate_date' => ['nullable', 'date', 'before_or_equal:today'],
            'source' => ['required', 'string', 'max:60'],
            'confirm_variation' => ['nullable', 'boolean'],
        ], [
            'currency.*' => 'Elige la moneda.',
            'rate.*' => 'El tipo de cambio debe estar entre 0.5 y 20 (CFG-BR-04).',
            'buy.*' => 'Revisa el precio de compra.',
            'sell.*' => 'Revisa el precio de venta.',
            'rate_date.before_or_equal' => 'La fecha no puede ser futura.',
            'source.*' => 'Indica la fuente.',
        ]);
        $register($data, $this->user($request));

        return response()->json(['data' => ['currency' => $data['currency']]], 201);
    }

    public function currencies(Request $request, ManageCurrencies $currencies): JsonResponse
    {
        $settings = $currencies->settings();
        $rates = DB::table('fin_fx_rates')->orderBy('currency_code')->orderByDesc('rate_date')->orderByDesc('effective_at')->get(['currency_code', 'rate_pen', 'rate_date'])->unique('currency_code')->keyBy('currency_code');
        $user = $this->user($request);

        return response()->json(['data' => [
            'currencies' => $currencies->all()->map(function ($row) use ($rates, $settings): array {
                $code = trim((string) $row->code);
                $rate = $code === ManageCurrencies::BASE ? 1.0 : (isset($rates[$code]) ? (float) $rates[$code]->rate_pen : null);

                return [
                    'code' => $code,
                    'name' => $row->name,
                    'symbol' => $row->symbol,
                    'active' => (bool) $row->active,
                    'is_base' => (bool) $row->is_base,
                    'is_charge' => (bool) $row->is_charge,
                    'rate' => $rate,
                    'client_rate' => $rate === null || $code === ManageCurrencies::BASE ? $rate : round($rate * (1 - $settings['margin_pct'] / 100), 4),
                    'rate_date' => $rates[$code]->rate_date ?? null,
                ];
            })->values(),
            'settings' => $settings,
            'can_manage' => $user->can('admin.settings.manage'),
        ]]);
    }

    public function updateCurrency(Request $request, string $code, ManageCurrencies $currencies): JsonResponse
    {
        $data = $request->validate([
            'active' => ['sometimes', 'boolean'],
            'is_charge' => ['sometimes', 'boolean'],
        ], ['active.*' => 'Indica si la moneda queda activa.', 'is_charge.*' => 'Indica si es moneda de cobro.']);

        return response()->json(['data' => $currencies->update(strtoupper($code), $data, $this->user($request))]);
    }

    public function saveSettings(Request $request, ManageCurrencies $currencies): JsonResponse
    {
        $data = $request->validate([
            'margin_pct' => ['required', 'numeric', 'between:0,15'],
            'alert_pct' => ['required', 'numeric', 'between:0.1,20'],
        ], [
            'margin_pct.*' => 'El margen de conversión va de 0 a 15 %.',
            'alert_pct.*' => 'La alerta de variación va de 0,1 a 20 %.',
        ]);

        return response()->json(['data' => $currencies->saveSettings($data, $this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
