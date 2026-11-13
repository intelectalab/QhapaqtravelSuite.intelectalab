<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers;

use App\Domain\Finance\Actions\FxProviders;
use App\Domain\Finance\Actions\ManageCurrencies;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class CurrencyContractController
{
    public function convert(Request $request, ManageCurrencies $currencies): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'lt:1000000000'],
            'from' => ['required', 'string', 'size:3'],
            'to' => ['required', 'string', 'size:3'],
        ], ['amount.*' => 'Indica un monto mayor que cero.', 'from.*' => 'Elige la moneda de origen.', 'to.*' => 'Elige la moneda de destino.']);
        $active = $currencies->all()->filter(fn (object $row): bool => (bool) $row->active)->map(fn (object $row): string => trim((string) $row->code))->values()->all();
        [$from, $to] = [strtoupper($data['from']), strtoupper($data['to'])];

        foreach ([$from, $to] as $code) {
            if (! in_array($code, $active, true)) {
                throw ApiException::unprocessable('FX-01', "La moneda {$code} no está activa en la agencia.");
            }
        }

        $margin = (float) $currencies->settings()['margin_pct'];
        $fromRate = $this->rate($from);
        $toRate = $this->rate($to);
        $amount = (float) $data['amount'];
        $mid = $amount * $fromRate['rate'] / $toRate['rate'];

        return response()->json(['data' => [
            'amount' => round($amount, 2),
            'from' => $from,
            'to' => $to,
            'rate' => round($fromRate['rate'] / $toRate['rate'], 6),
            'result' => round($mid, 2),
            'client_result' => $from === $to ? round($mid, 2) : round($mid * (1 - $margin / 100), 2),
            'margin_pct' => $margin,
            'rates' => [$from => $fromRate, $to => $toRate],
        ]]);
    }

    public function rates(Request $request, string $code, ManageCurrencies $currencies): JsonResponse
    {
        $code = strtoupper($code);

        if (! $currencies->all()->contains(fn (object $row): bool => trim((string) $row->code) === $code)) {
            throw ApiException::notFound('La moneda no existe.');
        }

        $query = DB::table('fin_fx_rates as f')->leftJoin('iam_users as u', 'u.id', '=', 'f.created_by')->leftJoin('fx_rate_providers as p', 'p.id', '=', 'f.provider_id')
            ->where('f.currency_code', $code)->select(['f.id', 'f.rate_pen', 'f.buy', 'f.sell', 'f.previous_rate', 'f.rate_date', 'f.source', 'f.effective_at', 'f.daily_change_pct', 'f.alert_raised', 'f.is_demo', 'u.name as user_name', 'p.code as provider']);

        return response()->json(CursorPage::respond($request, $query, ['rate_date' => 'f.rate_date', 'effective_at' => 'f.effective_at'], '-rate_date,-effective_at', fn (object $row): array => [
            'id' => $row->id,
            'currency' => $code,
            'rate' => (float) $row->rate_pen,
            'buy' => $row->buy === null ? null : (float) $row->buy,
            'sell' => $row->sell === null ? null : (float) $row->sell,
            'previous' => $row->previous_rate === null ? null : (float) $row->previous_rate,
            'daily_change_pct' => $row->daily_change_pct === null ? null : (float) $row->daily_change_pct,
            'alert_raised' => (bool) $row->alert_raised,
            'is_demo' => (bool) $row->is_demo,
            'date' => $row->rate_date,
            'source' => $row->source,
            'provider' => $row->provider,
            'at' => $row->effective_at,
            'user' => $row->user_name ?? 'Sistema',
        ], ['base' => ManageCurrencies::BASE]));
    }

    public function providers(FxProviders $providers): JsonResponse
    {
        $list = $providers->list();

        return response()->json(['data' => $list['providers'], 'meta' => array_diff_key($list, ['providers' => true])]);
    }

    public function testProvider(Request $request, string $code, FxProviders $providers): JsonResponse
    {
        return response()->json(['data' => $providers->test($code, $this->user($request))]);
    }

    public function refresh(Request $request, FxProviders $providers): JsonResponse
    {
        return response()->json(['data' => $providers->refresh($this->user($request))]);
    }

    private function rate(string $code): array
    {
        if ($code === ManageCurrencies::BASE) {
            return ['rate' => 1.0, 'date' => null];
        }

        $row = DB::table('fin_fx_rates')->where('currency_code', $code)->orderByDesc('rate_date')->orderByDesc('effective_at')->first(['rate_pen', 'rate_date']);

        if ($row === null || (float) $row->rate_pen <= 0) {
            throw ApiException::unprocessable('FX-02', "Aún no hay tipo de cambio registrado para {$code}.");
        }

        return ['rate' => (float) $row->rate_pen, 'date' => $row->rate_date];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
