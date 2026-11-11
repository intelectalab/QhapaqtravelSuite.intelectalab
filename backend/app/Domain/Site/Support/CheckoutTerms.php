<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Catalog\Support\CancellationTiers;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class CheckoutTerms
{
    public const METHODS = ['tarjeta' => 'Tarjeta', 'transferencia' => 'Transferencia bancaria', 'yape' => 'Yape', 'plin' => 'Plin'];

    private const DEFAULT_PCT = 30;

    private const DEFAULT_DAYS = 15;

    public const PAY_LATER = 'pagar_despues';

    private const PAY_LATER_HOURS = 24;

    public function __construct(private readonly RuleResolver $rules) {}

    public static function bankAccounts(): array
    {
        return DB::table('fin_treasury_accounts')->where('kind', 'bank')->where('status', 'active')->whereNotNull('account_number')->orderBy('currency')->get(['bank', 'name', 'currency', 'account_number', 'cci'])
            ->map(fn (object $account): array => (array) $account)->all();
    }

    public function build(Collection $lines, string $today, string $rate): array
    {
        $currency = (string) $lines->first()['quote']['currency'];
        $convert = fn (string $amount, string $from): BigDecimal => Decimal::round2(Decimal::convert($amount, $from, $currency, $rate));
        $depositOn = $this->rules->on('R-DEPOSIT');
        $total = BigDecimal::zero()->toScale(2);
        $deposit = BigDecimal::zero()->toScale(2);
        $adelanto = $depositOn;
        $balanceDue = null;
        $group = ['adt' => 0, 'chd' => 0, 'inf' => 0];
        $items = [];

        foreach ($lines as $index => $line) {
            $product = $line['product'];
            $item = $line['item'];
            $policy = DB::table('catalog_payment_policies')->where('product_id', $product->id)->first(['modes', 'deposit_pct', 'balance_due_days', 'note']);
            $modes = $policy ? array_values(array_filter(explode(',', trim((string) $policy->modes, '{}')))) : ['total', 'adelanto'];
            $pct = (int) ($policy->deposit_pct ?? $this->rules->param('R-DEPOSIT', 'pct') ?? self::DEFAULT_PCT);
            $days = (int) ($policy->balance_due_days ?? $this->rules->param('R-DEPOSIT', 'balanceDueDays') ?? self::DEFAULT_DAYS);
            $due = Carbon::parse($item->service_date)->subDays($days)->toDateString();
            $lineTotal = $convert((string) $line['quote']['total'], (string) $line['quote']['currency']);
            $lineDeposit = Decimal::round2($lineTotal->multipliedBy($pct)->dividedBy(100, 6, RoundingMode::HALF_UP));
            $allows = in_array('adelanto', $modes, true) && $pct >= 1 && $pct <= 99 && $due > $today;
            $adelanto = $adelanto && $allows;
            $total = $total->plus($lineTotal);
            $deposit = $deposit->plus($lineDeposit);
            $balanceDue = $balanceDue === null || $due < $balanceDue ? $due : $balanceDue;
            $group = ['adt' => max($group['adt'], (int) $item->pax_adults), 'chd' => max($group['chd'], (int) $item->pax_children), 'inf' => max($group['inf'], (int) $item->pax_infants)];
            $policies = DB::table('catalog_product_policies')->where('product_id', $product->id)->first(['cancellation', 'penalty_tiers']);

            $items[] = [
                'line' => $index + 1,
                'product' => ['id' => (string) $product->id, 'slug' => $product->slug, 'name' => $product->name, 'min_age' => (int) ($product->minimum_age ?? 0)],
                'date' => $item->service_date,
                'pax' => ['adt' => (int) $item->pax_adults, 'chd' => (int) $item->pax_children, 'inf' => (int) $item->pax_infants],
                'total' => (string) $lineTotal,
                'deposit_pct' => $pct,
                'deposit' => (string) $lineDeposit,
                'balance_due' => $due,
                'payment_note' => $policy->note ?? null,
                'pickup' => $this->rules->on('R-PICKUP') ? [
                    'points' => DB::table('catalog_pickup_points')->where('product_id', $product->id)->orderBy('sequence')->get(['label', 'kind', 'requires_address'])
                        ->map(fn (object $point): array => ['label' => $point->label, 'kind' => $point->kind, 'requires_address' => (bool) $point->requires_address])->all(),
                    'ask_flight' => (bool) ($this->rules->param('R-PICKUP', 'askFlight') ?? true),
                    'text' => $product->pickup_text ?? null,
                ] : null,
                'comments' => $this->rules->on('R-COMMENTS') ? (int) ($this->rules->param('R-COMMENTS', 'maxChars') ?? 1000) : null,
                'cancellation' => $policies ? ['text' => $policies->cancellation, 'tiers' => CancellationTiers::describe(CancellationTiers::resolve($policies->penalty_tiers, $policies->cancellation))] : null,
            ];
        }

        $companions = $this->rules->on('R-COMPANIONS') ? (string) ($this->rules->param('R-COMPANIONS', 'when') ?? 'al_reservar') : 'opcional';
        $modes = $adelanto
            ? [
                ['value' => 'total', 'label' => 'Pago total', 'amount' => (string) $total],
                ['value' => 'adelanto', 'label' => 'Adelanto', 'amount' => (string) $deposit, 'balance' => (string) $total->minus($deposit), 'balance_due' => $balanceDue, 'pct' => $total->isPositive() ? (int) round((float) (string) $deposit->dividedBy($total, 4, RoundingMode::HALF_UP)->multipliedBy(100)) : 0],
            ]
            : [['value' => 'total', 'label' => 'Pago total', 'amount' => (string) $total]];

        if ($this->payLater($lines)) {
            $hours = $this->payLaterHours();
            $modes[] = ['value' => self::PAY_LATER, 'label' => 'Reservar ahora, pagar después', 'amount' => '0.00', 'balance' => (string) $total, 'pct' => 0, 'hold_hours' => $hours, 'hold_until' => Carbon::now()->addHours($hours)->toIso8601String()];
        }

        return [
            'currency' => $currency,
            'total' => (string) $total,
            'modes' => $modes,
            'adelanto_unavailable' => $depositOn && ! $adelanto ? 'El adelanto no está disponible para esta compra: algún servicio no lo admite o su saldo vencería antes de hoy.' : null,
            'methods' => collect(self::METHODS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all(),
            'bank_accounts' => self::bankAccounts(),
            'group' => $group,
            'first_date' => $lines->min(fn (array $line): string => (string) $line['item']->service_date),
            'companions' => ['when' => $companions, 'require_document' => (bool) ($this->rules->param('R-COMPANIONS', 'requireDocument') ?? true)],
            'items' => $items,
        ];
    }

    public function payLaterHours(): int
    {
        return max(1, (int) ($this->rules->param('R-PAY-LATER', 'holdHours') ?? self::PAY_LATER_HOURS));
    }

    private function payLater(Collection $lines): bool
    {
        if (! $this->rules->on('R-PAY-LATER')) {
            return false;
        }

        return $lines->every(fn (array $line): bool => ! array_key_exists('R-PAY-LATER', $this->rules->productOverrides((string) $line['product']->id)[0]));
    }
}
