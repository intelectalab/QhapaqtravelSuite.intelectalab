<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Finance\Support\Consolidation;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class FxRevaluationWorkflow
{
    public function __construct(private readonly Consolidation $money, private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public function preview(?string $closeRate, User $viewer): array
    {
        $period = $this->period();
        $close = $this->closeRate($closeRate);
        $registered = DB::table('fin_fx_revaluations')->where('period', $period)->pluck('code', 'account_id');
        $rows = $this->accounts()->map(function (object $account) use ($close, $period, $registered): array {
            $valuation = $this->valuation($account, $period);
            $market = $valuation['units']->multipliedBy($close)->toScale(2, RoundingMode::HALF_UP);

            return [
                'code' => $account->code,
                'name' => $account->name,
                'kind' => $account->kind,
                'balance_usd' => (string) $valuation['units']->toScale(2, RoundingMode::HALF_UP),
                'book_rate' => (string) $valuation['rate']->toScale(6, RoundingMode::HALF_UP),
                'book_pen' => (string) $valuation['value']->toScale(2, RoundingMode::HALF_UP),
                'market_pen' => (string) $market,
                'unrealized_pen' => (string) $market->minus($valuation['value'])->toScale(2, RoundingMode::HALF_UP),
                'realized_pen' => (string) $valuation['realized']->toScale(2, RoundingMode::HALF_UP),
                'realized_operations' => $valuation['operations'],
                'registered' => $registered->get($account->id),
            ];
        })->values();

        return [
            'period' => $period,
            'today' => $this->money->today(),
            'close_rate' => (string) $close->toScale(4, RoundingMode::HALF_UP),
            'reference_rate' => $this->money->usdRate(),
            'rows' => $rows,
            'totals' => [
                'unrealized_pen' => (string) $rows->reduce(fn (BigDecimal $sum, array $row) => $sum->plus($row['unrealized_pen']), BigDecimal::zero())->toScale(2),
                'realized_pen' => (string) $rows->reduce(fn (BigDecimal $sum, array $row) => $sum->plus($row['realized_pen']), BigDecimal::zero())->toScale(2),
            ],
            'pending' => $rows->filter(fn (array $row): bool => $row['registered'] === null && ! Decimal::of($row['balance_usd'])->isZero())->count(),
            'history' => DB::table('fin_fx_revaluations as r')->join('fin_treasury_accounts as a', 'a.id', '=', 'r.account_id')->leftJoin('iam_users as u', 'u.id', '=', 'r.created_by')
                ->orderByDesc('r.period')->orderBy('a.code')->limit(60)
                ->get(['r.code', 'r.period', 'r.revaluation_date', 'r.balance_usd', 'r.book_rate', 'r.close_rate', 'r.diff_pen', 'a.code as account_code', 'a.name as account', 'u.name as user'])
                ->map(fn (object $row): array => ['code' => $row->code, 'period' => $row->period, 'date' => $row->revaluation_date, 'balance_usd' => (string) $row->balance_usd, 'book_rate' => (string) $row->book_rate, 'close_rate' => (string) $row->close_rate, 'diff_pen' => (string) $row->diff_pen, 'account' => ['code' => $row->account_code, 'name' => $row->account], 'user' => $row->user])
                ->values(),
            'can' => ['register' => $viewer->can('finance.invoicing')],
        ];
    }

    public function register(?string $closeRate, User $actor): array
    {
        return DB::transaction(function () use ($closeRate, $actor): array {
            $period = $this->period();
            DB::select('select pg_advisory_xact_lock(hashtext(?))', ["{$this->context->idOrFail()}:fx_revaluation:{$period}"]);
            $close = $this->closeRate($closeRate);
            $done = DB::table('fin_fx_revaluations')->where('period', $period)->pluck('account_id')->all();
            $accounts = $this->accounts()->reject(fn (object $account): bool => in_array($account->id, $done, true));
            $next = (int) DB::table('fin_fx_revaluations')->selectRaw("coalesce(max(cast(substring(code from '[0-9]+$') as integer)), 0) as n")->value('n');
            $created = [];

            foreach ($accounts as $account) {
                $valuation = $this->valuation($account, $period);

                if ($valuation['units']->isZero()) {
                    continue;
                }

                $diff = $valuation['units']->multipliedBy($close)->minus($valuation['value'])->toScale(2, RoundingMode::HALF_UP);
                $code = 'DC-'.str_pad((string) ++$next, 4, '0', STR_PAD_LEFT);
                DB::table('fin_fx_revaluations')->insert([
                    'id' => (string) Str::uuid7(), 'tenant_id' => $this->context->idOrFail(), 'code' => $code, 'account_id' => $account->id, 'period' => $period,
                    'revaluation_date' => $this->money->today(), 'balance_usd' => (string) $valuation['units']->toScale(2, RoundingMode::HALF_UP),
                    'book_rate' => (string) $valuation['rate']->toScale(6, RoundingMode::HALF_UP), 'close_rate' => (string) $close->toScale(6, RoundingMode::HALF_UP), 'diff_pen' => (string) $diff,
                    'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey(), 'created_at' => now(), 'updated_at' => now(),
                ]);
                $this->audit->log('Diferencia cambiaria', $code, 'registrar', "{$account->code} · {$period}", ($diff->isNegative() ? 'pérdida 676 · S/ ' : 'ganancia 776 · S/ ').$diff->abs());
                app(StaffNotices::class)->toRoles(['finance', 'accounting'], 'tesoreria.diferencia_cambiaria', "Diferencia cambiaria {$code}", "{$account->name} · {$period}: ".($diff->isNegative() ? 'pérdida' : 'ganancia')." de S/ {$diff->abs()}.", 'fin_fx_revaluation', null, null, [], (string) $actor->getKey());
                $created[] = $code;
            }

            if ($created === []) {
                throw ApiException::conflict('TES-BR-16', $done === [] ? 'No hay saldos en dólares por revaluar este periodo.' : "La diferencia cambiaria de {$period} ya está registrada.");
            }

            return $created;
        });
    }

    private function valuation(object $account, string $period): array
    {
        $units = Decimal::of($account->opening_balance);
        $value = $units->multipliedBy(Decimal::of($account->opening_rate ?: $this->money->usdRate()));
        $realized = BigDecimal::zero();
        $operations = [];
        $events = DB::table('fin_treasury_movements')->where('account_id', $account->id)->where('status', 'posted')
            ->get(['movement_date as date', 'code', 'direction', 'amount', 'fx_rate', 'description'])
            ->map(fn (object $row): array => ['date' => (string) $row->date, 'order' => 0, 'key' => (string) $row->code, 'row' => $row])
            ->concat(DB::table('fin_fx_revaluations')->where('account_id', $account->id)->where('period', '<', $period)->get(['revaluation_date as date', 'code', 'close_rate'])
                ->map(fn (object $row): array => ['date' => (string) $row->date, 'order' => 1, 'key' => (string) $row->code, 'row' => $row]))
            ->sortBy([['date', 'asc'], ['order', 'asc'], ['key', 'asc']]);

        foreach ($events as $event) {
            $row = $event['row'];

            if ($event['order'] === 1) {
                $value = $units->multipliedBy(Decimal::of($row->close_rate));

                continue;
            }

            $amount = Decimal::of($row->amount);
            $rate = Decimal::of($row->fx_rate ?: $this->money->usdRate());

            if (trim((string) $row->direction) === 'in') {
                $units = $units->plus($amount);
                $value = $value->plus($amount->multipliedBy($rate));

                continue;
            }

            $average = $units->isPositive() ? $value->dividedBy($units, 6, RoundingMode::HALF_UP) : $rate;
            if (str_starts_with($event['date'], $period)) {
                $diff = $amount->multipliedBy($rate->minus($average));
                $realized = $realized->plus($diff);

                if (! $diff->toScale(2, RoundingMode::HALF_UP)->isZero()) {
                    $operations[] = ['code' => (string) $row->code, 'date' => $event['date'], 'description' => $row->description, 'amount_usd' => (string) $amount->toScale(2), 'rate' => (string) $rate->toScale(4, RoundingMode::HALF_UP), 'average' => (string) $average->toScale(4, RoundingMode::HALF_UP), 'diff_pen' => (string) $diff->toScale(2, RoundingMode::HALF_UP)];
                }
            }
            $units = $units->minus($amount);
            $value = $value->minus($amount->multipliedBy($average));
        }

        return [
            'units' => $units,
            'value' => $value,
            'rate' => $units->isPositive() ? $value->dividedBy($units, 6, RoundingMode::HALF_UP) : Decimal::of($this->money->usdRate()),
            'realized' => $realized,
            'operations' => $operations,
        ];
    }

    private function accounts()
    {
        return DB::table('fin_treasury_accounts')->whereNull('deleted_at')->where('currency', 'USD')->where('status', 'active')->orderBy('code')
            ->get(['id', 'code', 'name', 'kind', 'opening_balance', 'opening_rate']);
    }

    private function period(): string
    {
        return $this->money->now()->format('Y-m');
    }

    private function closeRate(?string $given): BigDecimal
    {
        return is_numeric($given) && (float) $given > 0.5 && (float) $given < 20 ? Decimal::of($given) : Decimal::of((string) $this->money->usdRate());
    }
}
