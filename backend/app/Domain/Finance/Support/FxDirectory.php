<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class FxDirectory
{
    public const CURRENCIES = ['USD' => 'Dólar estadounidense', 'EUR' => 'Euro', 'GBP' => 'Libra esterlina'];

    public function list(User $viewer): array
    {
        $rows = DB::table('fin_fx_rates as f')
            ->leftJoin('iam_users as u', 'u.id', '=', 'f.created_by')
            ->orderByDesc('f.rate_date')
            ->orderByDesc('f.effective_at')
            ->limit(400)
            ->get(['f.id', 'f.currency_code', 'f.rate_pen', 'f.previous_rate', 'f.buy', 'f.sell', 'f.rate_date', 'f.source', 'f.effective_at', 'u.name as user_name']);

        $currencies = collect(self::CURRENCIES)->map(function (string $name, string $code) use ($rows): array {
            $history = $rows->where('currency_code', $code)->values();
            $current = $history->first();

            return [
                'code' => $code,
                'name' => $name,
                'rate' => $current ? (float) $current->rate_pen : null,
                'previous' => $current && $current->previous_rate !== null ? (float) $current->previous_rate : null,
                'date' => $current?->rate_date,
                'source' => $current?->source,
                'trend' => $history->take(14)->reverse()->map(fn (object $row): array => ['date' => $row->rate_date, 'rate' => (float) $row->rate_pen])->values(),
            ];
        })->values();

        return [
            'base' => 'PEN',
            'currencies' => $currencies,
            'history' => $rows->map(fn (object $row): array => [
                'id' => $row->id,
                'currency' => $row->currency_code,
                'rate' => (float) $row->rate_pen,
                'previous' => $row->previous_rate !== null ? (float) $row->previous_rate : null,
                'date' => $row->rate_date,
                'source' => $row->source,
                'at' => $row->effective_at,
                'user' => $row->user_name ?? 'Sistema',
            ])->values(),
            'can_register' => $viewer->can('admin.settings.manage') || $viewer->can('finance.treasury'),
        ];
    }
}
