<?php

declare(strict_types=1);

namespace App\Domain\Landing\Support;

use App\Domain\Platform\Support\PlatformInvoicer;
use App\Domain\Platform\Support\PlatformSettings;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SignupQuote
{
    public const CYCLES = ['mensual' => 'monthly', 'anual' => 'annual', 'prueba' => 'monthly'];

    public const ANNUAL_MONTHS_PAID = 10;

    public function __construct(private readonly PlatformInvoicer $invoicer, private readonly PlatformSettings $settings) {}

    public function plan(string $code): object
    {
        $plan = $this->db()->table('plans')->where('code', $code)->where('status', 'active')->first()
            ?? throw ApiException::unprocessable('PLAN', 'Elige un plan de la lista.', ['field' => 'plan']);

        if ((int) $plan->rank >= 3) {
            throw ApiException::unprocessable('PLAN_NOT_SELF_SERVICE', 'El plan Enterprise se contrata con el equipo comercial. Escríbenos y te preparamos una propuesta.', ['field' => 'plan']);
        }

        return $plan;
    }

    public function coupon(string $code, object $plan, bool $lock = false): object
    {
        $query = $this->db()->table('coupons')->where('code', Str::upper(trim($code)));
        $coupon = ($lock ? $query->lock('for no key update') : $query)->first();
        $plans = $coupon ? ($coupon->plan_ids === '{}' ? [] : explode(',', trim((string) $coupon->plan_ids, '{}'))) : [];
        $problem = match (true) {
            $coupon === null => 'El cupón no existe.',
            $coupon->status !== 'active' => 'El cupón no está vigente.',
            $coupon->valid_to !== null && Carbon::parse($coupon->valid_to, 'America/Lima')->lt(Carbon::today('America/Lima')) => 'El cupón ya venció.',
            $coupon->max_redemptions !== null && (int) $coupon->redeemed_count >= (int) $coupon->max_redemptions => 'El cupón ya no tiene canjes disponibles.',
            $plans !== [] && ! in_array($plan->id, $plans, true) => "El cupón no aplica al plan {$plan->name}.",
            default => null,
        };

        if ($problem !== null) {
            throw ApiException::unprocessable('COUPON_INVALID', $problem, ['field' => 'coupon']);
        }

        return $coupon;
    }

    public function addons(array $requested, object $plan): array
    {
        if ($requested === []) {
            return [];
        }

        $rows = $this->db()->table('addons')->whereIn('code', array_keys($requested))->get()->keyBy('code');
        $custom = $this->db()->table('addon_prices')->where('plan_id', $plan->id)->pluck('price', 'addon_code');
        $out = [];

        foreach ($requested as $code => $quantity) {
            $addon = $rows[$code] ?? null;
            $available = $addon !== null && in_array($plan->id, $this->uuids($addon->available_plans), true);

            if (! $available) {
                throw ApiException::unprocessable('ADDON_NOT_AVAILABLE', 'Uno de los complementos no está disponible para el plan elegido.', ['field' => 'addons']);
            }

            $quantity = $addon->quantity_allowed ? max(1, min(50, (int) $quantity)) : 1;
            $out[] = ['code' => $code, 'label' => $addon->label, 'quantity' => $quantity, 'unit_price' => (string) Decimal::money($custom[$code] ?? $addon->price_month)];
        }

        return $out;
    }

    public function totals(object $plan, string $cycle, ?object $coupon, array $addons): array
    {
        $trial = $cycle === 'prueba';
        $annual = $cycle === 'anual';
        $planPrice = $trial ? BigDecimal::zero()->toScale(2) : $this->invoicer->price($plan, $annual ? 'annual' : 'monthly');
        $months = $annual ? self::ANNUAL_MONTHS_PAID : 1;
        $lines = [];
        $addonTotal = BigDecimal::zero()->toScale(2);

        foreach ($addons as $addon) {
            $unit = $trial ? BigDecimal::zero()->toScale(2) : Decimal::money($addon['unit_price'])->multipliedBy($months)->toScale(2);
            $amount = $unit->multipliedBy($addon['quantity'])->toScale(2);
            $addonTotal = $addonTotal->plus($amount);
            $lines[] = [...$addon, 'period_price' => (string) $unit, 'amount' => (string) $amount];
        }

        $discount = $coupon !== null && ! $trial ? $this->invoicer->discount($coupon, $planPrice) : BigDecimal::zero()->toScale(2);
        $subtotal = $planPrice->plus($addonTotal);
        $net = $subtotal->minus($discount);
        $igvPct = Decimal::of($this->settings->igv());
        $igv = $net->multipliedBy($igvPct)->dividedBy(100, 2, RoundingMode::HALF_UP);

        return [
            'plan' => $plan->code,
            'plan_name' => $plan->name,
            'cycle' => $cycle,
            'months' => $trial ? 0 : ($annual ? 12 : 1),
            'months_paid' => $trial ? 0 : $months,
            'plan_price' => (string) $planPrice,
            'addons' => $lines,
            'subtotal' => (string) $subtotal,
            'coupon' => $coupon?->code,
            'discount' => (string) $discount,
            'net' => (string) $net,
            'igv_pct' => (string) $igvPct,
            'igv' => (string) $igv,
            'total' => (string) $net->plus($igv),
            'currency' => 'PEN',
            'trial_days' => $trial ? (int) ($plan->trial_days ?: 14) : 0,
        ];
    }

    private function uuids(?string $raw): array
    {
        return $raw === null || $raw === '{}' ? [] : explode(',', trim($raw, '{}'));
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
