<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\TreasuryRouting;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\RoundingMode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class TreasurySync
{
    private const SYNCED = ['confirmado', 'aplicado', 'revertido'];

    public function __construct(
        private readonly SequenceService $sequences,
        private readonly TreasuryRouting $routing,
        private readonly Consolidation $money,
        private readonly TenantContext $context,
        private readonly AuditLogger $audit,
    ) {}

    public function payment(string $paymentId, ?string $actorId): ?string
    {
        $payment = $this->paymentRow($paymentId);

        if ($payment === null || $payment->kind !== 'cobro' || ! in_array($payment->status, self::SYNCED, true)) {
            return null;
        }

        return $this->collection($payment, $actorId);
    }

    public function reversal(string $paymentId, ?string $actorId): ?string
    {
        $payment = $this->paymentRow($paymentId);

        if ($payment === null || $payment->kind !== 'cobro' || $payment->status !== 'revertido') {
            return null;
        }

        $this->collection($payment, $actorId);
        $key = "REV:{$payment->code}";

        if ($this->exists($key)) {
            return null;
        }

        $origin = DB::table('fin_treasury_movements as m')->join('fin_treasury_accounts as a', 'a.id', '=', 'm.account_id')->where('m.source_key', "PAG:{$payment->code}")->first(['a.id', 'a.code', 'a.name', 'a.kind', 'a.bank', 'a.currency', 'a.sede_id']);

        if ($origin === null) {
            return null;
        }

        $date = $payment->reverted_at ? Carbon::parse($payment->reverted_at)->setTimezone($this->context->timezone())->toDateString() : $this->money->today();

        return $this->insert($origin, [
            'movement_date' => $date,
            'direction' => 'out',
            'type' => 'collection_reversal',
            'source_type' => 'payment_reversal',
            'source_id' => $payment->id,
            'source_key' => $key,
            'reservation_id' => $payment->reservation_id,
            'description' => mb_substr("Reversión del cobro {$payment->code}".($payment->revert_reason ? " · {$payment->revert_reason}" : ''), 0, 255),
            'reference' => $payment->reference,
            'counterparty' => $payment->client_name,
            'sede_id' => $payment->sede_id ?? $origin->sede_id,
        ], (string) $payment->amount, (string) $payment->currency, $payment->fx_rate, $payment->reverted_by ?? $actorId);
    }

    public function payout(string $payoutId, ?string $actorId): ?string
    {
        $payout = DB::table('fin_payable_payouts as o')->join('fin_payables as p', 'p.id', '=', 'o.payable_id')
            ->leftJoin('catalog_providers as v', 'v.id', '=', 'p.provider_id')
            ->leftJoin('booking_reservations as b', 'b.id', '=', 'p.reservation_id')
            ->where('o.id', $payoutId)
            ->first(['o.id', 'o.code', 'o.paid_on', 'o.amount', 'o.fx_rate', 'o.method', 'o.bank_account_id', 'o.operation_ref', 'o.created_by', 'p.code as payable_code', 'p.concept', 'p.currency', 'p.reservation_id', 'b.sede_id', 'v.name as provider_name']);

        if ($payout === null) {
            return null;
        }

        $key = "PPR:{$payout->code}";

        if ($this->exists($key) || $this->exists("CXP:{$payout->payable_code}")) {
            return null;
        }

        $account = $this->routing->forPayout($payout, (string) $payout->currency, $payout->sede_id);

        if ($account === null) {
            return null;
        }

        return $this->insert($account, [
            'movement_date' => $payout->paid_on,
            'direction' => 'out',
            'type' => 'supplier_payment',
            'source_type' => 'payout',
            'source_id' => $payout->id,
            'source_key' => $key,
            'reservation_id' => $payout->reservation_id,
            'description' => mb_substr("Pago {$payout->payable_code}".($payout->provider_name ? " · {$payout->provider_name}" : '')." · {$payout->concept}", 0, 255),
            'reference' => $payout->operation_ref,
            'counterparty' => $payout->provider_name,
            'sede_id' => $payout->sede_id ?? $account->sede_id,
        ], (string) $payout->amount, (string) $payout->currency, $payout->fx_rate, $payout->created_by ?? $actorId);
    }

    public function sweep(User $actor): array
    {
        return DB::transaction(function () use ($actor): array {
            $created = ['collections' => 0, 'reversals' => 0, 'payouts' => 0];
            $pending = DB::table('fin_payments as p')->where('p.kind', 'cobro')->whereIn('p.status', self::SYNCED)
                ->where(fn ($query) => $query
                    ->whereNotExists(fn ($sub) => $sub->from('fin_treasury_movements as m')->whereRaw("m.source_key = 'PAG:' || p.code"))
                    ->orWhere(fn ($reverted) => $reverted->where('p.status', 'revertido')->whereNotExists(fn ($sub) => $sub->from('fin_treasury_movements as m')->whereRaw("m.source_key = 'REV:' || p.code"))))
                ->orderBy('p.paid_on')->orderBy('p.code')->lockForUpdate()->get(['p.id', 'p.status']);

            foreach ($pending as $payment) {
                $created['collections'] += $this->payment($payment->id, $actor->getKey()) !== null ? 1 : 0;
                if ($payment->status === 'revertido') {
                    $created['reversals'] += $this->reversal($payment->id, $actor->getKey()) !== null ? 1 : 0;
                }
            }

            $payouts = DB::table('fin_payable_payouts as o')->whereNotExists(fn ($sub) => $sub->from('fin_treasury_movements as m')->whereRaw("m.source_key = 'PPR:' || o.code"))
                ->orderBy('o.paid_on')->orderBy('o.code')->pluck('o.id');

            foreach ($payouts as $payoutId) {
                $created['payouts'] += $this->payout($payoutId, $actor->getKey()) !== null ? 1 : 0;
            }

            $total = array_sum($created);
            $this->audit->log('Movimiento de tesorería', 'sincronizacion', 'sincronizar', null, "{$created['collections']} cobros · {$created['reversals']} reversiones · {$created['payouts']} pagos a proveedor");

            return [...$created, 'total' => $total];
        });
    }

    private function collection(object $payment, ?string $actorId): ?string
    {
        $key = "PAG:{$payment->code}";

        if ($this->exists($key)) {
            return null;
        }

        $account = $this->routing->forPayment($payment, $payment->sede_id);

        if ($account === null) {
            return null;
        }

        return $this->insert($account, [
            'movement_date' => $payment->paid_on,
            'direction' => 'in',
            'type' => 'collection',
            'source_type' => 'payment',
            'source_id' => $payment->id,
            'source_key' => $key,
            'reservation_id' => $payment->reservation_id,
            'description' => mb_substr('Cobro '.($payment->receivable_code ?? $payment->reservation_code ?? $payment->code).($payment->client_name ? " · {$payment->client_name}" : ''), 0, 255),
            'reference' => $payment->reference,
            'counterparty' => $payment->client_name,
            'sede_id' => $payment->sede_id ?? $account->sede_id,
        ], (string) $payment->amount, (string) $payment->currency, $payment->fx_rate, $payment->registered_by ?? $actorId);
    }

    private function insert(object $account, array $values, string $amount, string $currency, mixed $fx, ?string $actorId): string
    {
        $converted = $this->convert($amount, $currency, $fx, (string) $account->currency);
        $code = $this->sequences->next('treasury_movement');
        DB::table('fin_treasury_movements')->insert([
            ...$values,
            ...$converted,
            'code' => $code,
            'account_id' => $account->id,
            'currency' => $account->currency,
            'status' => 'posted',
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        $this->audit->log('Movimiento de tesorería', $code, 'sincronizar', null, "{$values['source_key']} · {$account->code} · {$values['direction']} · {$account->currency} {$converted['amount']}");

        return $code;
    }

    private function convert(string $amount, string $currency, mixed $fx, string $target): array
    {
        $value = Decimal::money($amount);
        $rate = (string) $this->money->fxFor('USD', $fx);

        if ($currency === $target) {
            return ['amount' => (string) $value, 'fx_rate' => $currency === 'USD' ? $rate : null, 'orig_amount' => null, 'orig_currency' => null, 'orig_fx_rate' => null];
        }

        $converted = $currency === 'USD' ? $value->multipliedBy($rate)->toScale(2, RoundingMode::HALF_UP) : $value->dividedBy($rate, 2, RoundingMode::HALF_UP);

        return ['amount' => (string) $converted, 'fx_rate' => $target === 'USD' ? $rate : null, 'orig_amount' => (string) $value, 'orig_currency' => $currency, 'orig_fx_rate' => $rate];
    }

    private function exists(string $key): bool
    {
        return DB::table('fin_treasury_movements')->where('source_key', $key)->exists();
    }

    private function paymentRow(string $paymentId): ?object
    {
        return DB::table('fin_payments as p')
            ->leftJoin('booking_reservations as b', 'b.id', '=', 'p.reservation_id')
            ->leftJoin('crm_clients as c', 'c.id', '=', 'b.client_id')
            ->leftJoin('fin_receivables as r', 'r.id', '=', 'p.receivable_id')
            ->where('p.id', $paymentId)
            ->first(['p.id', 'p.code', 'p.kind', 'p.status', 'p.method', 'p.amount', 'p.currency', 'p.fx_rate', 'p.paid_on', 'p.reference', 'p.reservation_id', 'p.registered_by', 'p.reverted_at', 'p.reverted_by', 'p.revert_reason', 'b.code as reservation_code', 'b.sede_id', 'c.name as client_name', 'r.code as receivable_code']);
    }
}
