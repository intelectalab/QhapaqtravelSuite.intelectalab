<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Iam\Support\StaffSeats;
use App\Domain\Platform\Actions\CollectInvoice;
use App\Domain\Platform\Support\DowngradeValidator;
use App\Domain\Platform\Support\Entitlements;
use App\Domain\Platform\Support\PlatformInvoicer;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageSubscription
{
    private const ENTITY = 'Suscripción';

    private const ADDON_METRIC = ['extra_users' => ['users', 1]];

    public function __construct(
        private readonly TenantContext $context,
        private readonly PlatformInvoicer $invoicer,
        private readonly CollectInvoice $collector,
        private readonly DowngradeValidator $validator,
        private readonly AuditLogger $audit,
    ) {}

    public function preview(string $planCode, string $cycle): array
    {
        $subscription = $this->subscription();

        return $this->plan($subscription, $this->target($planCode), $cycle);
    }

    public function change(string $planCode, string $cycle, ?int $version, string $userId): array
    {
        $result = $this->db()->transaction(function () use ($planCode, $cycle, $version, $userId): array {
            $subscription = $this->subscription(true, $version);
            $this->assertStatus($subscription, ['active', 'trialing'], 'Para cambiar de plan, la suscripción debe estar activa. Si tiene una cancelación programada, reanúdala primero.');
            $target = $this->target($planCode);
            $plan = $this->plan($subscription, $target, $cycle);

            if ($plan['blockers'] !== []) {
                throw ApiException::unprocessable('SUB_DOWNGRADE_BLOCKED', "No se puede pasar al plan {$target->name}: ".implode('; ', $plan['blockers']).'.', ['blockers' => $plan['blockers']]);
            }

            $pending = $this->scheduled($subscription->id);

            if (! $plan['immediate']) {
                if ($pending !== null) {
                    throw ApiException::conflict('SUB_CHANGE_SCHEDULED', 'Ya hay un cambio programado para la renovación. Anúlalo antes de programar otro.');
                }

                $this->record($subscription, $plan['kind'], $target, $cycle, $plan['effective_at'], 'scheduled', $plan['proration'], null, $userId);
                $this->touch($subscription->id);

                return [...$plan, 'invoice' => null, 'action' => 'cambio_plan_programado'];
            }

            if ($pending !== null && in_array($pending->kind, ['upgrade', 'downgrade', 'cycle'], true)) {
                $this->db()->table('subscription_changes')->where('id', $pending->id)->update(['status' => 'voided']);
            }

            $invoice = $this->applyNow($subscription, $target, $cycle, $plan);
            $this->record($subscription, $plan['kind'], $target, $cycle, Carbon::today('America/Lima')->toDateString(), 'applied', $plan['proration'], $invoice['id'] ?? null, $userId);

            return [...$plan, 'invoice' => $invoice, 'action' => 'cambio_plan'];
        });

        $this->audit->log(self::ENTITY, $this->code(), $result['action'], $result['from']['name'].' · '.$result['from']['cycle'], "{$result['plan']['name']} · {$result['cycle']}".($result['immediate'] ? '' : " · desde {$result['effective_at']}"));

        return $this->settle($result);
    }

    public function voidScheduled(?int $version): void
    {
        $change = $this->db()->transaction(function () use ($version): object {
            $subscription = $this->subscription(true, $version);
            $change = $this->scheduled($subscription->id);

            if ($change === null || ! in_array($change->kind, ['upgrade', 'downgrade', 'cycle'], true)) {
                throw ApiException::notFound('No hay un cambio de plan programado.');
            }

            $this->db()->table('subscription_changes')->where('id', $change->id)->update(['status' => 'voided']);
            $this->touch($subscription->id);

            return $change;
        });

        $this->audit->log(self::ENTITY, $this->code(), 'anular_cambio_programado', $this->planName($change->to_plan_id).' · '.$change->to_cycle);
    }

    public function cancel(array $survey, ?int $version, string $userId): string
    {
        $end = $this->db()->transaction(function () use ($survey, $version, $userId): string {
            $subscription = $this->subscription(true, $version);
            $this->assertStatus($subscription, ['active'], 'Solo se cancela una suscripción activa.');
            $pending = $this->scheduled($subscription->id);

            if ($pending !== null) {
                $this->db()->table('subscription_changes')->where('id', $pending->id)->update(['status' => 'voided']);
            }

            $this->record($subscription, 'cancel', null, null, Carbon::parse($subscription->current_period_end)->addDay()->toDateString(), 'scheduled', null, null, $userId);
            $this->db()->table('subscriptions')->where('id', $subscription->id)->update([
                'status' => 'cancel_scheduled',
                'auto_renew' => false,
                'cancel_at' => $subscription->current_period_end,
                'cancel_survey' => json_encode([...$survey, 'answered_at' => now()->toIso8601String()], JSON_UNESCAPED_UNICODE),
                'updated_at' => now(),
                'lock_version' => DB::raw('lock_version + 1'),
            ]);

            return (string) $subscription->current_period_end;
        });

        $this->audit->log(self::ENTITY, $this->code(), 'cancelar', 'active', "cancel_scheduled · {$survey['reason']} · cierra el {$end}");

        return $end;
    }

    public function resume(?int $version, string $userId): void
    {
        $this->db()->transaction(function () use ($version, $userId): void {
            $subscription = $this->subscription(true, $version);
            $this->assertStatus($subscription, ['cancel_scheduled'], 'La suscripción no tiene una cancelación programada.');
            $this->db()->table('subscription_changes')->where('subscription_id', $subscription->id)->where('status', 'scheduled')->where('kind', 'cancel')->update(['status' => 'voided']);
            $this->record($subscription, 'resume', null, null, Carbon::today('America/Lima')->toDateString(), 'applied', null, null, $userId);
            $this->db()->table('subscriptions')->where('id', $subscription->id)->update(['status' => 'active', 'auto_renew' => true, 'cancel_at' => null, 'updated_at' => now(), 'lock_version' => DB::raw('lock_version + 1')]);
        });

        $this->audit->log(self::ENTITY, $this->code(), 'reanudar', 'cancel_scheduled', 'active');
    }

    public function autoRenew(bool $enabled, ?int $version): void
    {
        $before = $this->db()->transaction(function () use ($enabled, $version): bool {
            $subscription = $this->subscription(true, $version);

            if ($subscription->status === 'cancel_scheduled') {
                throw ApiException::conflict('SUB_CANCEL_SCHEDULED', 'La suscripción tiene una cancelación programada. Reanúdala para volver a renovar.');
            }

            if ((bool) $subscription->auto_renew === $enabled) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            $this->db()->table('subscriptions')->where('id', $subscription->id)->update(['auto_renew' => $enabled, 'updated_at' => now(), 'lock_version' => DB::raw('lock_version + 1')]);

            return (bool) $subscription->auto_renew;
        });

        $this->audit->log(self::ENTITY, $this->code(), 'renovacion_automatica', $before ? 'activada' : 'desactivada', $enabled ? 'activada' : 'desactivada');
    }

    public function addAddon(string $code, int $quantity, ?string $domain, string $userId): array
    {
        $result = $this->db()->transaction(function () use ($code, $quantity, $domain, $userId): array {
            $subscription = $this->subscription(true);
            $this->assertStatus($subscription, ['active', 'trialing'], 'Para contratar complementos, la suscripción debe estar activa.');
            $addon = $this->addon($code, $subscription);
            $active = $this->items($subscription->id, $code)->first();

            if ($active !== null && $active->ends_at === null) {
                throw ApiException::conflict('ADDON_ACTIVE', "Ya tienes {$addon->label}. Ajusta la cantidad en lugar de contratarlo otra vez.");
            }

            if ($active !== null) {
                $this->db()->table('subscription_items')->where('id', $active->id)->update(['ends_at' => null, 'updated_by' => null, 'updated_at' => now()]);
                $this->record($subscription, 'addon_add', null, null, Carbon::today('America/Lima')->toDateString(), 'applied', null, null, $userId);

                return ['action' => 'addon_mantener', 'label' => $addon->label, 'quantity' => (int) $active->quantity, 'invoice' => null];
            }

            $quantity = $addon->quantity_allowed ? max(1, $quantity) : 1;
            $price = $this->addonPrice($addon, (string) $subscription->plan_id);
            $this->db()->table('subscription_items')->insert([
                'id' => (string) Str::uuid7(),
                'subscription_id' => $subscription->id,
                'addon_code' => $code,
                'quantity' => $quantity,
                'unit_price' => (string) $price,
                'meta' => $domain ? json_encode(['domain' => $domain]) : null,
                'starts_at' => Carbon::today('America/Lima')->toDateString(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $invoice = $this->addonCharge($subscription, $addon, $price, $quantity, 'Contratación');
            $this->record($subscription, 'addon_add', null, null, Carbon::today('America/Lima')->toDateString(), 'applied', $invoice['proration'] ?? null, $invoice['id'] ?? null, $userId);

            return ['action' => 'addon_contratar', 'label' => $addon->label, 'quantity' => $quantity, 'invoice' => $invoice];
        });

        Entitlements::flush();
        $this->audit->log(self::ENTITY, "complemento.{$code}", $result['action'], null, "{$result['label']} × {$result['quantity']}");

        return $this->settle($result);
    }

    public function updateAddon(string $code, int $quantity, string $userId): array
    {
        $result = $this->db()->transaction(function () use ($code, $quantity, $userId): array {
            $subscription = $this->subscription(true);
            $addon = $this->addon($code, $subscription);
            $item = $this->items($subscription->id, $code)->firstWhere('ends_at', null) ?? throw ApiException::notFound('No tienes ese complemento contratado.');

            if (! $addon->quantity_allowed) {
                throw ApiException::unprocessable('ADDON_FIXED', "{$addon->label} no se contrata por cantidad.");
            }

            if ($quantity === (int) $item->quantity) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            $this->assertFloor($code, $addon, $subscription, $quantity);
            $this->db()->table('subscription_items')->where('id', $item->id)->update(['quantity' => $quantity, 'updated_at' => now()]);
            $diff = $quantity - (int) $item->quantity;
            $invoice = $diff > 0 ? $this->addonCharge($subscription, $addon, Decimal::money($item->unit_price), $diff, 'Ampliación') : null;
            $this->record($subscription, 'addon_update', null, null, Carbon::today('America/Lima')->toDateString(), 'applied', $invoice['proration'] ?? null, $invoice['id'] ?? null, $userId);

            return ['label' => $addon->label, 'before' => (int) $item->quantity, 'quantity' => $quantity, 'invoice' => $invoice];
        });

        Entitlements::flush();
        $this->audit->log(self::ENTITY, "complemento.{$code}", 'addon_ajustar', "{$result['label']} × {$result['before']}", "{$result['label']} × {$result['quantity']}");

        return $this->settle($result);
    }

    public function removeAddon(string $code, string $userId): string
    {
        $result = $this->db()->transaction(function () use ($code, $userId): array {
            $subscription = $this->subscription(true);
            $addon = $this->addon($code, $subscription, false);
            $item = $this->items($subscription->id, $code)->first() ?? throw ApiException::notFound('No tienes ese complemento contratado.');

            if ($item->ends_at !== null) {
                throw ApiException::conflict('ADDON_REMOVAL_SCHEDULED', "El retiro de {$addon->label} ya está programado para el {$item->ends_at}.");
            }

            $this->db()->table('subscription_items')->where('id', $item->id)->update(['ends_at' => $subscription->current_period_end, 'updated_at' => now()]);
            $this->record($subscription, 'addon_remove', null, null, Carbon::parse($subscription->current_period_end)->addDay()->toDateString(), 'applied', null, null, $userId);

            return ['label' => $addon->label, 'end' => (string) $subscription->current_period_end];
        });

        $this->audit->log(self::ENTITY, "complemento.{$code}", 'addon_retirar', $result['label'], "vigente hasta el {$result['end']}");

        return $result['end'];
    }

    public function redeem(string $code, string $userId): array
    {
        $code = Str::upper(trim($code));

        try {
            $result = $this->db()->transaction(function () use ($code, $userId): array {
                $subscription = $this->subscription(true);
                $coupon = $this->db()->table('coupons')->whereRaw('upper(code) = ?', [$code])->lockForUpdate()->first();

                if ($coupon === null || $coupon->status !== 'active' || ($coupon->valid_to !== null && $coupon->valid_to < Carbon::today('America/Lima')->toDateString())) {
                    throw ApiException::unprocessable('COUPON_INVALID', 'El cupón no existe o ya no está vigente.');
                }

                if ($coupon->max_redemptions !== null && (int) $coupon->redeemed_count >= (int) $coupon->max_redemptions) {
                    throw ApiException::unprocessable('COUPON_EXHAUSTED', 'El cupón ya alcanzó su número máximo de canjes.');
                }

                if (! in_array((string) $subscription->plan_id, $this->uuids($coupon->plan_ids), true)) {
                    throw ApiException::unprocessable('COUPON_PLAN', 'El cupón no aplica a tu plan actual.');
                }

                $current = $subscription->coupon_redemption_id ? $this->db()->table('coupon_redemptions')->where('id', $subscription->coupon_redemption_id)->where('remaining_cycles', '>', 0)->exists() : false;

                if ($current) {
                    throw ApiException::conflict('COUPON_NOT_STACKABLE', 'Ya tienes un cupón vigente. Los cupones no se acumulan.');
                }

                if ($this->db()->table('coupon_redemptions')->where('coupon_id', $coupon->id)->where('tenant_id', $subscription->tenant_id)->exists()) {
                    throw ApiException::conflict('COUPON_ALREADY_USED', 'Tu agencia ya usó este cupón.');
                }

                $id = (string) Str::uuid7();
                $this->db()->table('coupon_redemptions')->insert(['id' => $id, 'coupon_id' => $coupon->id, 'tenant_id' => $subscription->tenant_id, 'subscription_id' => $subscription->id, 'remaining_cycles' => (int) $coupon->duration_cycles, 'created_by' => $userId, 'created_at' => now()]);
                $this->db()->table('coupons')->where('id', $coupon->id)->increment('redeemed_count');
                $this->db()->table('subscriptions')->where('id', $subscription->id)->update(['coupon_redemption_id' => $id, 'updated_at' => now(), 'lock_version' => DB::raw('lock_version + 1')]);

                return ['code' => $coupon->code, 'type' => $coupon->type, 'value' => (float) $coupon->value, 'cycles' => (int) $coupon->duration_cycles];
            });
        } catch (ApiException $exception) {
            $this->audit->logOutsideTransaction(self::ENTITY, 'cupon', 'cupon_rechazado', $code, $exception->getMessage());

            throw $exception;
        }

        $label = $result['type'] === 'percent' ? "{$result['value']} %" : "S/ {$result['value']}";
        $this->audit->log(self::ENTITY, 'cupon', 'cupon_aplicar', null, "{$result['code']} · {$label} por {$result['cycles']} ciclos");

        return $result;
    }

    public function pay(string $number): array
    {
        $invoice = $this->invoice($number);

        if (! in_array($invoice->status, ['open', 'failed'], true)) {
            throw ApiException::conflict('INVOICE_NOT_COLLECTIBLE', 'Esta factura no tiene saldo pendiente.');
        }

        $charge = $this->collector->retry((string) $invoice->id, null, 'portal');
        $this->audit->log(self::ENTITY, "factura.{$number}", $charge['result'] === 'succeeded' ? 'pagar_factura' : 'pago_rechazado', $invoice->status, $charge['result'] === 'succeeded' ? 'paid' : $charge['message']);

        if ($charge['result'] !== 'succeeded') {
            throw ApiException::unprocessable('PAYMENT_DECLINED', "No pudimos cobrar la factura: {$charge['message']}.", ['code' => $charge['code']]);
        }

        return ['number' => $number, 'status' => 'paid', 'method' => $charge['method'] ?? null];
    }

    public function invoice(string $number): object
    {
        if (preg_match('/^([A-Z0-9]{4})-(\d{1,8})$/', Str::upper($number), $match) !== 1) {
            throw ApiException::notFound('La factura no existe.');
        }

        return $this->db()->table('platform_invoices')->where('tenant_id', $this->context->idOrFail())->where('series', $match[1])->where('number', (int) $match[2])->first()
            ?? throw ApiException::notFound('La factura no existe.');
    }

    private function plan(object $subscription, object $target, string $cycle): array
    {
        $current = $this->db()->table('plans')->where('id', $subscription->plan_id)->first();
        $fromRank = (int) $current->rank;
        $toRank = (int) $target->rank;
        $samePlan = $current->id === $target->id;

        if ($samePlan && $cycle === $subscription->cycle) {
            throw ApiException::unprocessable('SUB_NO_CHANGE', 'Ya tienes ese plan con ese ciclo de pago.');
        }

        $kind = $toRank > $fromRank ? 'upgrade' : ($toRank < $fromRank ? 'downgrade' : 'cycle');
        $immediate = $subscription->status === 'trialing' || $kind === 'upgrade' || ($kind === 'cycle' && $cycle === 'annual');
        $effective = $immediate ? Carbon::today('America/Lima') : Carbon::parse($subscription->current_period_end)->addDay();
        $blockers = $toRank < $fromRank ? $this->validator->blockers((string) $subscription->tenant_id, (string) $target->id) : [];

        return [
            'kind' => $kind,
            'immediate' => $immediate,
            'effective_at' => $effective->toDateString(),
            'from' => ['code' => $current->code, 'name' => $current->name, 'cycle' => $subscription->cycle],
            'plan' => ['code' => $target->code, 'name' => $target->name],
            'cycle' => $cycle,
            'price' => (string) $this->invoicer->price($target, $cycle),
            'proration' => $immediate && $subscription->status !== 'trialing' ? $this->proration($subscription, $current, $target, $cycle) : null,
            'blockers' => $blockers,
            'rules' => $this->rules($fromRank, $toRank),
        ];
    }

    private function proration(object $subscription, object $current, object $target, string $cycle): array
    {
        $today = Carbon::today('America/Lima');
        $start = Carbon::parse($subscription->current_period_start, 'America/Lima');
        $end = Carbon::parse($subscription->current_period_end, 'America/Lima');
        $periodDays = max(1, (int) $start->diffInDays($end) + 1);
        $daysLeft = max(0, min($periodDays, (int) $today->diffInDays($end, false) + 1));
        $credit = $this->share($this->invoicer->price($current, (string) $subscription->cycle), $daysLeft, $periodDays);
        $charge = $cycle === $subscription->cycle ? $this->share($this->invoicer->price($target, $cycle), $daysLeft, $periodDays) : $this->invoicer->price($target, $cycle);

        return ['days_left' => $daysLeft, 'period_days' => $periodDays, 'charge' => (string) $charge, 'credit' => (string) $credit, 'net' => (string) $charge->minus($credit)];
    }

    private function applyNow(object $subscription, object $target, string $cycle, array $plan): ?array
    {
        $today = Carbon::today('America/Lima');
        $values = ['plan_id' => $target->id, 'cycle' => $cycle, 'updated_at' => now(), 'lock_version' => DB::raw('lock_version + 1')];

        if ($cycle !== $subscription->cycle && $subscription->status !== 'trialing') {
            $values['current_period_start'] = $today->toDateString();
            $values['current_period_end'] = ($cycle === 'annual' ? $today->copy()->addYearNoOverflow() : $today->copy()->addMonthNoOverflow())->subDay()->toDateString();
        }

        $invoice = null;
        $proration = $plan['proration'];

        if ($proration !== null) {
            $net = Decimal::money($proration['net']);

            if ($net->isNegative()) {
                $values['credit_balance'] = DB::raw('credit_balance + '.$net->negated());
            } elseif ($net->isPositive()) {
                $to = Carbon::parse($values['current_period_end'] ?? $subscription->current_period_end);
                $invoice = $this->invoicer->charge($subscription, 'proration', $today, $to, [
                    ["Cambio al plan {$target->name} · {$proration['days_left']} de {$proration['period_days']} días", 1, Decimal::money($proration['charge']), 'proration_charge'],
                    ["Crédito del plan {$plan['from']['name']} no usado", 1, Decimal::money($proration['credit'])->negated(), 'proration_credit'],
                ]);
            }
        }

        $this->db()->table('subscriptions')->where('id', $subscription->id)->update($values);
        $this->db()->table('tenants')->where('id', $subscription->tenant_id)->update(['plan_id' => $target->id, 'mrr' => $target->price_month, 'updated_at' => now()]);
        Entitlements::flush();

        return $invoice;
    }

    private function addonCharge(object $subscription, object $addon, BigDecimal $unit, int $quantity, string $reason): ?array
    {
        if ($subscription->status === 'trialing') {
            return null;
        }

        $today = Carbon::today('America/Lima');
        $start = Carbon::parse($subscription->current_period_start, 'America/Lima');
        $end = Carbon::parse($subscription->current_period_end, 'America/Lima');
        $periodDays = max(1, (int) $start->diffInDays($end) + 1);
        $daysLeft = max(0, min($periodDays, (int) $today->diffInDays($end, false) + 1));
        $amount = $this->share($unit, $daysLeft, $periodDays);

        if (! $amount->isPositive()) {
            return null;
        }

        $invoice = $this->invoicer->charge($subscription, 'addon', $today, $end, [["{$reason} de {$addon->label} · {$daysLeft} de {$periodDays} días", $quantity, $amount, 'addon']]);

        return [...$invoice, 'proration' => ['days_left' => $daysLeft, 'period_days' => $periodDays, 'charge' => (string) $amount->multipliedBy($quantity), 'credit' => '0.00', 'net' => (string) $amount->multipliedBy($quantity)]];
    }

    private function settle(array $result): array
    {
        if (($result['invoice']['id'] ?? null) === null) {
            return [...$result, 'charge' => null];
        }

        $charge = $this->db()->transaction(fn (): array => $this->collector->collect($result['invoice']['id']));

        return [...$result, 'charge' => ['result' => $charge['result'], 'message' => $charge['message'], 'method' => $charge['method'] ?? null]];
    }

    private function assertFloor(string $code, object $addon, object $subscription, int $quantity): void
    {
        $grants = json_decode((string) $addon->grants, true);
        [$metric, $per] = self::ADDON_METRIC[$code] ?? (is_array($grants) && $grants !== [] && ! isset($grants['feature']) ? [array_key_first($grants), (int) reset($grants)] : [null, 0]);

        if ($metric === null) {
            return;
        }

        $base = (int) $this->db()->table('plan_limits')->where('plan_id', $subscription->plan_id)->where('metric', $metric)->value('value');
        $used = match ($metric) {
            'users' => StaffSeats::count(DB::table('iam_users')),
            'storage_gb' => (float) round((int) $this->db()->table('tenants')->where('id', $subscription->tenant_id)->value('storage_used_bytes') / 1024 ** 3, 2),
            default => (int) $this->db()->table('usage_monthly')->where('tenant_id', $subscription->tenant_id)->where('metric', $metric)->where('month', Carbon::today('America/Lima')->startOfMonth()->toDateString())->value('value'),
        };

        if ($used > $base + $quantity * $per) {
            throw ApiException::unprocessable('SUB-BR-06', "No puedes bajar {$addon->label} a {$quantity}: este periodo ya usas {$used} y quedarías con ".($base + $quantity * $per).'.');
        }
    }

    private function rules(int $fromRank, int $toRank): array
    {
        $rules = $this->db()->table('plan_rule_entitlements as e')->join('sys_booking_rule_catalog as r', 'r.code', '=', 'e.rule_code')->orderBy('r.name')->get(['r.name', 'e.min_plan']);
        $plans = $this->db()->table('plans')->pluck('rank', 'name');
        $gained = [];
        $lost = [];

        foreach ($rules as $rule) {
            $rank = (int) ($plans[$rule->min_plan] ?? PHP_INT_MAX);

            if ($rank > $fromRank && $rank <= $toRank) {
                $gained[] = $rule->name;
            } elseif ($rank > $toRank && $rank <= $fromRank) {
                $lost[] = $rule->name;
            }
        }

        return ['gained' => $gained, 'lost' => $lost];
    }

    private function record(object $subscription, string $kind, ?object $target, ?string $cycle, string $effective, string $status, ?array $proration, ?string $invoiceId, string $userId): void
    {
        $this->db()->table('subscription_changes')->insert([
            'id' => (string) Str::uuid7(),
            'subscription_id' => $subscription->id,
            'kind' => $kind,
            'from_plan_id' => $subscription->plan_id,
            'to_plan_id' => $target?->id,
            'from_cycle' => $subscription->cycle,
            'to_cycle' => $cycle,
            'effective_at' => $effective,
            'status' => $status,
            'proration' => $proration ? json_encode($proration) : null,
            'invoice_id' => $invoiceId,
            'requested_by' => $userId,
            'created_at' => now(),
        ]);
    }

    private function subscription(bool $lock = false, ?int $version = null): object
    {
        $query = $this->db()->table('subscriptions')->where('tenant_id', $this->context->idOrFail())->where('status', '<>', 'canceled');
        $subscription = ($lock ? $query->lockForUpdate() : $query)->first() ?? throw ApiException::notFound('Tu agencia no tiene una suscripción vigente.');

        if ($version !== null) {
            IfMatch::assertMatches($version, (int) $subscription->lock_version, 'La suscripción');
        }

        return $subscription;
    }

    private function assertStatus(object $subscription, array $allowed, string $message): void
    {
        if (! in_array($subscription->status, $allowed, true)) {
            throw ApiException::conflict('SUB_NOT_ACTIVE', $message);
        }
    }

    private function target(string $code): object
    {
        return $this->db()->table('plans')->where('code', $code)->where('status', 'active')->first() ?? throw ApiException::notFound('El plan no existe.');
    }

    private function scheduled(string $subscriptionId): ?object
    {
        return $this->db()->table('subscription_changes')->where('subscription_id', $subscriptionId)->where('status', 'scheduled')->first();
    }

    private function addon(string $code, object $subscription, bool $available = true): object
    {
        $addon = $this->db()->table('addons')->where('code', $code)->first() ?? throw ApiException::notFound('El complemento no existe.');

        if ($available && in_array((string) $subscription->plan_id, $this->uuids($addon->included_plans), true)) {
            throw ApiException::conflict('ADDON_INCLUDED', "{$addon->label} ya viene incluido en tu plan.");
        }

        if ($available && ! in_array((string) $subscription->plan_id, $this->uuids($addon->available_plans), true)) {
            throw ApiException::unprocessable('ADDON_NOT_AVAILABLE', "{$addon->label} no está disponible para tu plan.");
        }

        return $addon;
    }

    private function addonPrice(object $addon, string $planId): BigDecimal
    {
        $price = $this->db()->table('addon_prices')->where('addon_code', $addon->code)->where('plan_id', $planId)->value('price') ?? $addon->price_month;

        return Decimal::money($price ?? 0);
    }

    private function items(string $subscriptionId, string $code): Collection
    {
        return $this->db()->table('subscription_items')->where('subscription_id', $subscriptionId)->where('addon_code', $code)
            ->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>=', Carbon::today('America/Lima')->toDateString()))
            ->orderByRaw('ends_at is not null')->get(['id', 'quantity', 'unit_price', 'ends_at']);
    }

    private function share(BigDecimal $price, int $days, int $period): BigDecimal
    {
        return $price->multipliedBy($days)->dividedBy($period, 2, RoundingMode::HALF_UP);
    }

    private function uuids(?string $value): array
    {
        return $value ? array_values(array_filter(explode(',', trim($value, '{}')))) : [];
    }

    private function touch(string $id): void
    {
        $this->db()->table('subscriptions')->where('id', $id)->update(['updated_at' => now(), 'lock_version' => DB::raw('lock_version + 1')]);
    }

    private function planName(?string $id): string
    {
        return (string) $this->db()->table('plans')->where('id', $id)->value('name');
    }

    private function code(): string
    {
        return (string) $this->db()->table('subscriptions')->where('tenant_id', $this->context->idOrFail())->where('status', '<>', 'canceled')->value('code');
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
