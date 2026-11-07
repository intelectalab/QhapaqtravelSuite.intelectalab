<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PlatformInvoicer
{
    private const CONNECTION = 'pgsql_platform';

    public function __construct(
        private readonly PlatformSequence $sequence,
        private readonly PlatformSettings $settings,
        private readonly BillingDirectory $directory,
    ) {}

    public function price(object $plan, string $cycle): BigDecimal
    {
        return Decimal::money($cycle === 'annual' ? $plan->price_year : $plan->price_month);
    }

    public function discount(object $coupon, BigDecimal $price): BigDecimal
    {
        $discount = $coupon->type === 'percent'
            ? $price->multipliedBy(Decimal::of($coupon->value))->dividedBy(100, 2, RoundingMode::HALF_UP)
            : Decimal::money($coupon->value);

        return $discount->isGreaterThan($price) ? $price : $discount;
    }

    public function issue(object $subscription, object $plan, string $cycle, Carbon $from, Carbon $to, ?object $coupon = null, iterable $addons = []): array
    {
        $price = $this->price($plan, $cycle);
        $period = "{$from->locale('es')->translatedFormat('d M Y')} al {$to->locale('es')->translatedFormat('d M Y')}";
        $lines = [$this->line("Suscripción plan {$plan->name} — periodo {$period}", 1, $price, 'plan')];

        foreach ($addons as $addon) {
            $lines[] = $this->line("Complemento {$addon->addon_code}", (int) $addon->quantity, Decimal::money($addon->unit_price), 'addon');
        }

        if ($coupon !== null) {
            $discount = $this->discount($coupon, $price);
            $lines[] = $this->line("Cupón {$coupon->code} · {$this->directory->couponLabel($coupon)}", 1, $discount->negated(), 'discount');
        }

        $subtotal = array_reduce($lines, fn (BigDecimal $sum, array $line): BigDecimal => $sum->plus($line['amount']), BigDecimal::zero()->toScale(2));
        $igvPct = Decimal::of($this->settings->igv());
        $igv = $subtotal->multipliedBy($igvPct)->dividedBy(100, 2, RoundingMode::HALF_UP);
        $number = $this->sequence->next(PlatformSequence::INVOICE);
        $id = (string) Str::uuid7();

        $this->db()->table('platform_invoices')->insert([
            'id' => $id,
            'series' => 'FQ01',
            'number' => $number,
            'tenant_id' => $subscription->tenant_id,
            'subscription_id' => $subscription->id,
            'kind' => 'subscription',
            'period_from' => $from->toDateString(),
            'period_to' => $to->toDateString(),
            'issue_date' => $from->toDateString(),
            'due_date' => $from->copy()->addDays(7)->toDateString(),
            'currency' => 'PEN',
            'subtotal' => (string) $subtotal,
            'igv' => (string) $igv,
            'total' => (string) $subtotal->plus($igv),
            'igv_pct' => (string) $igvPct,
            'status' => 'open',
            'bill_to' => json_encode(['name' => $subscription->billing_name, 'ruc' => $subscription->billing_ruc, 'address' => $subscription->billing_address, 'ubigeo' => $subscription->billing_ubigeo], JSON_UNESCAPED_UNICODE),
            'sunat_status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($lines as $line) {
            $this->db()->table('platform_invoice_lines')->insert(['invoice_id' => $id, ...$line, 'unit_price' => (string) $line['unit_price'], 'amount' => (string) $line['amount']]);
        }

        return ['id' => $id, 'number' => PlatformSequence::format('FQ01', $number), 'total' => (string) $subtotal->plus($igv)];
    }

    private function line(string $description, int $quantity, BigDecimal $unit, string $type): array
    {
        return ['description' => mb_substr($description, 0, 250), 'quantity' => $quantity, 'unit_price' => $unit, 'amount' => $unit->multipliedBy($quantity)->toScale(2), 'line_type' => $type];
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
