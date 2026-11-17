<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Platform\Actions\CollectInvoice;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AddonPurchases
{
    public const TEMPLATE = 'premium_template';

    public const CREDIT_PACK = 'ai_credit_pack';

    public const MANAGED = [
        'ai_content' => 'Canales › Contenido con IA › Planes y créditos',
        'ai_images' => 'Canales › Contenido con IA › Planes y créditos',
        self::CREDIT_PACK => 'Canales › Contenido con IA › Planes y créditos',
        self::TEMPLATE => 'Canales › Plantillas del sitio',
    ];

    public function __construct(
        private readonly TenantContext $context,
        private readonly PlatformInvoicer $invoicer,
        private readonly CollectInvoice $collector,
    ) {}

    public function once(string $addon, string $description, BigDecimal $price, array $purchase): array
    {
        $result = $this->db()->transaction(function () use ($addon, $description, $price, $purchase): array {
            $subscription = $this->subscription();
            $today = Carbon::today('America/Lima');
            $item = $this->item($subscription->id, $addon, 'unico');
            $invoice = $price->isPositive() ? $this->invoicer->charge($subscription, 'addon', $today, $today, [[$description, 1, $price, 'addon']]) : null;
            $meta = $item !== null ? (array) json_decode((string) $item->meta, true) : [];
            $meta['purchases'][] = [...$purchase, 'price' => (string) $price, 'invoice' => $invoice['number'] ?? null, 'at' => now()->utc()->toIso8601String()];

            if ($item === null) {
                $this->db()->table('subscription_items')->insert(['id' => (string) Str::uuid7(), 'subscription_id' => $subscription->id, 'addon_code' => $addon, 'quantity' => 1, 'unit_price' => (string) $price, 'meta' => json_encode($meta, JSON_UNESCAPED_UNICODE), 'starts_at' => $today->toDateString(), 'billing_mode' => 'unico', 'paid_once_at' => $invoice === null ? now() : null, 'created_at' => now(), 'updated_at' => now()]);
            } else {
                $this->db()->table('subscription_items')->where('id', $item->id)->update(['quantity' => (int) $item->quantity + 1, 'unit_price' => (string) $price, 'meta' => json_encode($meta, JSON_UNESCAPED_UNICODE), 'updated_at' => now()]);
            }

            return ['invoice' => $invoice, 'item' => $item?->id];
        });

        return $this->settle($result['invoice'], $addon, true);
    }

    public function monthly(string $addon, string $description, BigDecimal $price, array $meta): array
    {
        $invoice = $this->db()->transaction(function () use ($addon, $description, $price, $meta): ?array {
            $subscription = $this->subscription();
            $today = Carbon::today('America/Lima');
            $item = $this->item($subscription->id, $addon, 'mensual');
            $values = ['unit_price' => (string) $price, 'meta' => json_encode($meta, JSON_UNESCAPED_UNICODE), 'updated_at' => now()];

            if ($item === null) {
                $this->db()->table('subscription_items')->insert(['id' => (string) Str::uuid7(), 'subscription_id' => $subscription->id, 'addon_code' => $addon, 'quantity' => 1, 'starts_at' => $today->toDateString(), 'billing_mode' => 'mensual', 'created_at' => now(), ...$values]);
            } else {
                $this->db()->table('subscription_items')->where('id', $item->id)->update($values);
            }

            if ($subscription->status === 'trialing') {
                return null;
            }

            $start = Carbon::parse($subscription->current_period_start, 'America/Lima');
            $end = Carbon::parse($subscription->current_period_end, 'America/Lima');
            $periodDays = max(1, (int) $start->diffInDays($end) + 1);
            $daysLeft = max(0, min($periodDays, (int) $today->diffInDays($end, false) + 1));
            $amount = $price->multipliedBy($daysLeft)->dividedBy($periodDays, 2, RoundingMode::HALF_UP);

            return $amount->isPositive() ? $this->invoicer->charge($subscription, 'addon', $today, $end, [["{$description} · {$daysLeft} de {$periodDays} días", 1, $amount, 'addon']]) : null;
        });

        Entitlements::flush();

        return $this->settle($invoice, $addon, false);
    }

    public function activeMonthly(string $addon): ?object
    {
        $subscription = $this->db()->table('subscriptions')->where('tenant_id', $this->context->idOrFail())->where('status', '<>', 'canceled')->first(['id']);

        return $subscription === null ? null : $this->db()->table('subscription_items')->where('subscription_id', $subscription->id)->where('addon_code', $addon)->where('billing_mode', 'mensual')
            ->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>=', Carbon::today('America/Lima')->toDateString()))->first();
    }

    public static function managedIn(string $addon): ?string
    {
        return self::MANAGED[$addon] ?? null;
    }

    private function settle(?array $invoice, string $addon, bool $once): array
    {
        if ($invoice === null) {
            return ['invoice' => null, 'total' => null, 'charge' => null];
        }

        $charge = $this->db()->transaction(fn (): array => $this->collector->collect($invoice['id']));

        if ($once && $charge['result'] === 'succeeded') {
            $this->db()->table('subscription_items as i')->join('subscriptions as s', 's.id', '=', 'i.subscription_id')->where('s.tenant_id', $this->context->idOrFail())
                ->where('i.addon_code', $addon)->where('i.billing_mode', 'unico')->whereNull('i.ends_at')->update(['paid_once_at' => now()]);
        }

        return ['invoice' => $invoice['number'], 'total' => Decimal::toApi($invoice['total']), 'charge' => ['result' => $charge['result'], 'message' => $charge['message']]];
    }

    private function subscription(): object
    {
        return $this->db()->table('subscriptions')->where('tenant_id', $this->context->idOrFail())->where('status', '<>', 'canceled')->lock('for no key update')->first()
            ?? throw ApiException::unprocessable('SUBSCRIPTION_REQUIRED', 'Tu agencia no tiene una suscripción vigente: no podemos sumar este cobro a tu factura de KipuControl.');
    }

    private function item(string $subscriptionId, string $addon, string $mode): ?object
    {
        return $this->db()->table('subscription_items')->where('subscription_id', $subscriptionId)->where('addon_code', $addon)->where('billing_mode', $mode)->whereNull('ends_at')->lock('for no key update')->first();
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
