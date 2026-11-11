<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\Consolidation;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TreasuryOperations
{
    public const DENOMINATIONS = ['200', '100', '50', '20', '10', '5', '2', '1', '0.50', '0.20', '0.10'];

    public function __construct(
        private readonly SequenceService $sequences,
        private readonly Consolidation $money,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function saveAccount(?string $code, array $data, User $actor): string
    {
        return DB::transaction(function () use ($code, $data, $actor): string {
            $values = array_filter([
                'kind' => $data['kind'] ?? null,
                'name' => $data['name'] ?? null,
                'bank' => $data['bank'] ?? null,
                'account_number' => $data['account_number'] ?? null,
                'cci' => $data['cci'] ?? null,
                'currency' => $data['currency'] ?? null,
                'sede_id' => $data['sede_id'] ?? ($code === null ? ($actor->sede_id ?? DB::table('iam_sedes')->orderBy('created_at')->value('id')) : null),
                'fund_amount' => isset($data['fund_amount']) ? (string) Decimal::money($data['fund_amount']) : null,
                'custodian_id' => $data['custodian_id'] ?? null,
                'settle_to_account_id' => isset($data['settle_to']) ? DB::table('fin_treasury_accounts')->where('code', $data['settle_to'])->value('id') : null,
                'status' => isset($data['active']) ? ($data['active'] ? 'active' : 'inactive') : null,
            ], fn ($value) => $value !== null);

            if ($code === null) {
                $code = $this->sequences->next('treasury_account');
                DB::table('fin_treasury_accounts')->insert([
                    ...$values,
                    'id' => (string) Str::uuid7(),
                    'tenant_id' => $this->context->idOrFail(),
                    'code' => $code,
                    'opening_balance' => (string) Decimal::money($data['opening_balance'] ?? 0),
                    'opening_rate' => ($values['currency'] ?? 'PEN') === 'USD' ? $this->money->usdRate() : 1,
                    'opening_date' => $data['opening_date'] ?? $this->money->today(),
                    'status' => $values['status'] ?? 'active',
                    'created_by' => $actor->getKey(),
                    'updated_by' => $actor->getKey(),
                ]);
                $this->audit->log('Cuenta de tesorería', $code, 'crear', null, ($values['name'] ?? '').' · '.($values['currency'] ?? ''));

                return $code;
            }

            $account = $this->account($code);
            unset($values['kind'], $values['currency']);

            if (($values['status'] ?? null) === 'inactive' && $this->balance($account)->isGreaterThan(0)) {
                throw ApiException::conflict('TES-BR-08', 'La cuenta tiene saldo. Transfiérelo a otra cuenta antes de desactivarla.');
            }

            DB::table('fin_treasury_accounts')->where('id', $account->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now(), 'lock_version' => DB::raw('lock_version + 1')]);
            $this->audit->log('Cuenta de tesorería', $code, 'editar', null, implode(', ', array_keys($values)));

            return $code;
        });
    }

    public function transfer(array $data, User $actor, string $kind = 'transfer', ?string $replenishmentId = null): string
    {
        return DB::transaction(function () use ($data, $actor, $kind, $replenishmentId): string {
            $from = $this->account($data['from'], true);
            $to = $this->account($data['to'], true);

            if ($from->id === $to->id) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige cuentas distintas.');
            }

            $amountFrom = Decimal::money($data['amount']);
            $rate = $from->currency === $to->currency ? BigDecimal::one() : Decimal::of($data['deal_rate'] ?? $this->money->usdRate());
            $amountTo = $from->currency === $to->currency ? $amountFrom : ($from->currency === 'USD' ? $amountFrom->multipliedBy($rate) : $amountFrom->dividedBy($rate, 2, RoundingMode::HALF_UP))->toScale(2, RoundingMode::HALF_UP);
            $this->ensureFunds($from, $amountFrom);

            $code = $this->sequences->next('treasury_transfer');
            $transferId = (string) Str::uuid7();
            DB::table('fin_treasury_transfers')->insert([
                'id' => $transferId, 'tenant_id' => $this->context->idOrFail(), 'code' => $code, 'from_account_id' => $from->id, 'to_account_id' => $to->id,
                'amount_from' => (string) $amountFrom, 'amount_to' => (string) $amountTo, 'deal_rate' => (string) $rate, 'kind' => $kind,
                'transfer_date' => $data['date'], 'reference' => $data['reference'] ?? null, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey(),
            ]);
            $type = $kind === 'replenishment' ? 'replenishment' : ($kind === 'gateway_settlement' ? 'gateway_settlement' : 'transfer');
            $description = $data['description'] ?? "Transferencia {$code}";
            $this->movement($from, 'out', $type, $amountFrom, $data['date'], $kind === 'replenishment' ? 'replenishment' : ($kind === 'gateway_settlement' ? 'gateway' : 'transfer'), $transferId, $description, $data['reference'] ?? null, $actor, ['transfer_id' => $transferId, 'replenishment_id' => $replenishmentId]);
            $this->movement($to, 'in', $type, $amountTo, $data['date'], $kind === 'replenishment' ? 'replenishment' : ($kind === 'gateway_settlement' ? 'gateway' : 'transfer'), $transferId, $description, $data['reference'] ?? null, $actor, ['transfer_id' => $transferId, 'replenishment_id' => $replenishmentId]);
            $this->audit->log('Transferencia de tesorería', $code, 'registrar', null, "{$from->code} → {$to->code} · {$from->currency} {$amountFrom}");

            return $code;
        });
    }

    public function settleGateway(string $accountCode, array $data, User $actor): string
    {
        return DB::transaction(function () use ($accountCode, $data, $actor): string {
            $gateway = $this->account($accountCode, true);

            if ($gateway->kind !== 'gateway' || $gateway->settle_to_account_id === null) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Solo se liquidan pasarelas con una cuenta de destino configurada.');
            }

            $gross = Decimal::money($data['gross']);
            $feePct = Decimal::of($data['fee_pct'] ?? DB::table('fin_treasury_settings')->value('gateway_fee_pct') ?? 0);
            $fee = $gross->multipliedBy($feePct)->dividedBy(100, 2, RoundingMode::HALF_UP);
            $net = $gross->minus($fee);
            $this->ensureFunds($gateway, $gross);
            $bank = DB::table('fin_treasury_accounts')->where('id', $gateway->settle_to_account_id)->value('code');

            if ($fee->isGreaterThan(0)) {
                $this->movement($gateway, 'out', 'gateway_fee', $fee, $data['date'], 'gateway', null, "Comisión de la pasarela ({$feePct} %) · lote {$data['batch']}", $data['batch'], $actor);
            }

            return $this->transfer(['from' => $gateway->code, 'to' => $bank, 'amount' => (string) $net, 'date' => $data['date'], 'reference' => $data['batch'], 'description' => "Liquidación de la pasarela · lote {$data['batch']}"], $actor, 'gateway_settlement');
        });
    }

    public function openSession(string $accountCode, array $data, User $actor): string
    {
        return DB::transaction(function () use ($accountCode, $data, $actor): string {
            $account = $this->pettyCash($accountCode);

            if (DB::table('fin_cash_sessions')->where('account_id', $account->id)->where('status', 'open')->exists()) {
                throw ApiException::conflict('TES-BR-03', 'La caja ya tiene una sesión abierta. Ciérrala con su arqueo antes de abrir otra.');
            }

            $code = $this->sequences->next('cash_session');
            DB::table('fin_cash_sessions')->insert([
                'id' => (string) Str::uuid7(), 'tenant_id' => $this->context->idOrFail(), 'code' => $code, 'account_id' => $account->id,
                'session_date' => $this->money->today(), 'opened_at' => now(), 'opened_by' => $actor->getKey(), 'opening_amount' => (string) Decimal::money($data['counted']),
                'status' => 'open', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Caja chica', $account->code, 'aperturar', null, "{$code} · S/ ".Decimal::money($data['counted']).(filled($data['note'] ?? null) ? " · {$data['note']}" : ''));

            return $code;
        });
    }

    public function expense(string $accountCode, array $data, User $actor): string
    {
        return DB::transaction(function () use ($accountCode, $data, $actor): string {
            $account = $this->pettyCash($accountCode, true);
            $settings = DB::table('fin_treasury_settings')->first(['max_petty_expense', 'sworn_statement_max']);
            $amount = Decimal::money($data['amount']);

            if (DB::table('fin_cash_sessions')->where('account_id', $account->id)->where('status', 'open')->doesntExist()) {
                throw ApiException::conflict('TES-BR-04', 'Abre la caja del día antes de registrar gastos.');
            }

            if ($settings && $amount->isGreaterThan((string) $settings->max_petty_expense)) {
                throw ApiException::unprocessable('TES-BR-05', 'El gasto supera el máximo por caja chica (S/ '.$settings->max_petty_expense.'). Págalo desde un banco.');
            }

            if ($data['receipt_type'] === 'sworn_statement' && $settings && $amount->isGreaterThan((string) $settings->sworn_statement_max)) {
                throw ApiException::unprocessable('TES-BR-11', 'Con declaración jurada solo se sustentan gastos de hasta S/ '.$settings->sworn_statement_max.'.');
            }

            $this->ensureFunds($account, $amount);
            $reservation = filled($data['reservation'] ?? null) ? DB::table('booking_reservations')->where('code', $data['reservation'])->value('id') : null;
            $movementCode = $this->movement($account, 'out', 'petty_expense', $amount, $data['date'] ?? $this->money->today(), 'expense', null, $data['description'], $data['series_number'] ?? null, $actor, ['reservation_id' => $reservation, 'category' => $data['category'] ?? null, 'counterparty' => $data['supplier']]);
            DB::table('fin_expense_receipts')->insert([
                'id' => (string) Str::uuid7(), 'tenant_id' => $this->context->idOrFail(), 'movement_id' => DB::table('fin_treasury_movements')->where('code', $movementCode)->value('id'),
                'receipt_type' => $data['receipt_type'], 'series_number' => $data['series_number'] ?? null, 'issuer_ruc' => $data['issuer_ruc'] ?? null, 'supplier_name' => $data['supplier'],
                'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey(),
            ]);

            return $movementCode;
        });
    }

    public function count(string $accountCode, array $data, User $actor): string
    {
        return DB::transaction(function () use ($accountCode, $data, $actor): string {
            $account = $this->pettyCash($accountCode, true);
            $counted = BigDecimal::zero();

            foreach ($data['denominations'] as $value => $quantity) {
                if (! in_array((string) $value, self::DENOMINATIONS, true) || (int) $quantity < 0) {
                    throw ApiException::unprocessable('VALIDATION_ERROR', 'Revisa las cantidades por denominación.');
                }
                $counted = $counted->plus(Decimal::of((string) $value)->multipliedBy((int) $quantity));
            }

            $counted = $counted->toScale(2, RoundingMode::HALF_UP);
            $expected = $this->balance($account);
            $difference = $counted->minus($expected);

            if (! $difference->isZero() && blank($data['note'] ?? null)) {
                throw ApiException::unprocessable('TES-BR-06', 'Hay una diferencia: explica qué pasó en la observación.');
            }

            $tolerance = Decimal::of(DB::table('fin_treasury_settings')->value('petty_tolerance') ?? 0);
            $session = DB::table('fin_cash_sessions')->where('account_id', $account->id)->where('status', 'open')->first(['id', 'code']);
            $kind = $data['kind'] ?? 'closing';

            if ($kind === 'closing' && $session === null) {
                throw ApiException::conflict('TES-BR-04', 'La caja no tiene una sesión abierta para cerrar.');
            }

            $code = $this->sequences->next('cash_count');
            $id = (string) Str::uuid7();
            DB::table('fin_cash_counts')->insert([
                'id' => $id, 'tenant_id' => $this->context->idOrFail(), 'code' => $code, 'account_id' => $account->id, 'session_id' => $session?->id, 'kind' => $kind,
                'counted_at' => now(), 'denominations' => json_encode($data['denominations']), 'counted_amount' => (string) $counted, 'expected_amount' => (string) $expected, 'difference' => (string) $difference,
                'result' => $difference->isZero() ? 'balanced' : ($difference->isPositive() ? 'over' : 'short'), 'note' => $data['note'] ?? null,
                'signed_by' => $actor->getKey(), 'signed_at' => now(), 'witness_id' => $data['witness_id'] ?? null,
                'status' => $difference->abs()->isGreaterThan($tolerance) ? 'pending_approval' : 'signed', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey(),
            ]);

            if ($kind === 'closing') {
                DB::table('fin_cash_sessions')->where('id', $session->id)->update(['status' => 'closed', 'closed_at' => now(), 'closed_by' => $actor->getKey(), 'closing_count_id' => $id, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            }

            $this->audit->log('Arqueo de caja', $code, $kind === 'closing' ? 'cerrar_caja' : 'arqueo', (string) $expected, "contado {$counted} · diferencia {$difference}");

            return $code;
        });
    }

    public function approveCount(string $code, ?string $note, User $actor): void
    {
        DB::transaction(function () use ($code, $note, $actor): void {
            $count = DB::table('fin_cash_counts')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('El arqueo no existe.');

            if ($count->status !== 'pending_approval') {
                throw ApiException::conflict('TES-BR-07', 'Este arqueo no tiene una diferencia por aprobar.');
            }

            if ($count->signed_by === $actor->getKey()) {
                throw ApiException::forbidden('TES-BR-07', 'Quien firmó el arqueo no puede aprobar su propia diferencia.');
            }

            $account = DB::table('fin_treasury_accounts')->where('id', $count->account_id)->first();
            $difference = Decimal::of($count->difference);
            $adjustment = $this->movement($account, $difference->isPositive() ? 'in' : 'out', 'count_adjustment', $difference->abs(), $this->money->today(), 'cash_count', $count->id, "Ajuste del arqueo {$count->code}", $count->code, $actor, [], false);
            DB::table('fin_cash_counts')->where('id', $count->id)->update(['status' => 'approved', 'approved_by' => $actor->getKey(), 'approved_at' => now(), 'approve_note' => $note, 'adjustment_movement_id' => DB::table('fin_treasury_movements')->where('code', $adjustment)->value('id'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Arqueo de caja', $count->code, 'aprobar_diferencia', 'pending_approval', $note ?? (string) $difference);
        });
    }

    public function validateCount(string $code, User $actor): void
    {
        DB::transaction(function () use ($code, $actor): void {
            $count = DB::table('fin_cash_counts')->where('code', $code)->lockForUpdate()->first(['id', 'code', 'status']) ?? throw ApiException::notFound('El arqueo no existe.');

            if (! in_array($count->status, ['signed', 'approved'], true)) {
                throw ApiException::conflict('TES-BR-07', $count->status === 'validated' ? 'El arqueo ya tiene el visto bueno contable.' : 'Primero hay que aprobar la diferencia del arqueo.');
            }

            DB::table('fin_cash_counts')->where('id', $count->id)->update(['status' => 'validated', 'validated_by' => $actor->getKey(), 'validated_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Arqueo de caja', $count->code, 'validar', $count->status, 'validated');
        });
    }

    public function requestReplenishment(string $accountCode, array $data, User $actor): string
    {
        return DB::transaction(function () use ($accountCode, $data, $actor): string {
            $account = $this->pettyCash($accountCode);

            if (DB::table('fin_cash_replenishments')->where('account_id', $account->id)->whereIn('status', ['requested', 'approved'])->exists()) {
                throw ApiException::conflict('TES-BR-09', 'La caja ya tiene una reposición en curso.');
            }

            $suggested = Decimal::of($account->fund_amount)->minus($this->balance($account));
            $amount = filled($data['amount'] ?? null) ? Decimal::money($data['amount']) : $suggested;

            if (! $amount->isPositive()) {
                throw ApiException::unprocessable('TES-BR-09', 'La caja está completa: no necesita reposición.');
            }

            $code = $this->sequences->next('cash_replenishment');
            $id = (string) Str::uuid7();
            DB::table('fin_cash_replenishments')->insert(['id' => $id, 'tenant_id' => $this->context->idOrFail(), 'code' => $code, 'account_id' => $account->id, 'amount' => (string) $amount->toScale(2, RoundingMode::HALF_UP), 'status' => 'requested', 'requested_by' => $actor->getKey(), 'requested_at' => now(), 'note' => $data['note'] ?? null, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->event($id, null, 'requested', $data['note'] ?? null, $actor);
            $this->audit->log('Reposición de caja', $code, 'solicitar', null, "{$account->code} · S/ {$amount}");

            return $code;
        });
    }

    public function decideReplenishment(string $code, string $decision, ?string $note, User $actor): void
    {
        DB::transaction(function () use ($code, $decision, $note, $actor): void {
            $replenishment = DB::table('fin_cash_replenishments')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('La reposición no existe.');

            if ($replenishment->status !== 'requested') {
                throw ApiException::conflict('TES-BR-10', 'La reposición ya fue resuelta.');
            }

            if ($replenishment->requested_by === $actor->getKey()) {
                throw ApiException::forbidden('TES-BR-10', 'Quien solicitó la reposición no puede aprobarla ni rechazarla.');
            }

            $status = $decision === 'approve' ? 'approved' : 'rejected';
            DB::table('fin_cash_replenishments')->where('id', $replenishment->id)->update([...($status === 'approved' ? ['approved_by' => $actor->getKey(), 'approved_at' => now()] : ['reject_reason' => $note]), 'status' => $status, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->event($replenishment->id, 'requested', $status, $note, $actor);
            $this->audit->log('Reposición de caja', $code, $status === 'approved' ? 'aprobar' : 'rechazar', 'requested', $note);
        });
    }

    public function payReplenishment(string $code, array $data, User $actor): string
    {
        return DB::transaction(function () use ($code, $data, $actor): string {
            $replenishment = DB::table('fin_cash_replenishments')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('La reposición no existe.');

            if ($replenishment->status !== 'approved') {
                throw ApiException::conflict('TES-BR-10', 'Solo se pagan reposiciones aprobadas.');
            }

            $cash = DB::table('fin_treasury_accounts')->where('id', $replenishment->account_id)->value('code');
            $from = DB::table('fin_treasury_accounts')->where('code', $data['from'])->first(['id', 'kind']);

            if ($from === null || $from->kind !== 'bank') {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'La reposición se paga desde una cuenta bancaria.');
            }

            $transfer = $this->transfer(['from' => $data['from'], 'to' => $cash, 'amount' => (string) $replenishment->amount, 'date' => $data['date'], 'reference' => $data['reference'] ?? null, 'description' => "Reposición {$code}"], $actor, 'replenishment', $replenishment->id);
            DB::table('fin_cash_replenishments')->where('id', $replenishment->id)->update(['status' => 'paid', 'paid_by' => $actor->getKey(), 'paid_at' => now(), 'paid_from_account_id' => $from->id, 'transfer_id' => DB::table('fin_treasury_transfers')->where('code', $transfer)->value('id'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->event($replenishment->id, 'approved', 'paid', $transfer, $actor);
            $this->audit->log('Reposición de caja', $code, 'pagar', 'approved', $transfer);

            return $transfer;
        });
    }

    public function balance(object $account): BigDecimal
    {
        $net = DB::table('fin_treasury_movements')->where('account_id', $account->id)->where('status', 'posted')
            ->selectRaw("coalesce(sum(case when direction = 'in' then amount else -amount end), 0) as net")->value('net');

        return Decimal::of($account->opening_balance ?? DB::table('fin_treasury_accounts')->where('id', $account->id)->value('opening_balance'))->plus(Decimal::of($net))->toScale(2, RoundingMode::HALF_UP);
    }

    private function movement(object $account, string $direction, string $type, BigDecimal $amount, string $date, string $source, ?string $sourceId, string $description, ?string $reference, User $actor, array $extra = [], bool $audit = true): string
    {
        $code = $this->sequences->next('treasury_movement');
        DB::table('fin_treasury_movements')->insert([
            'code' => $code, 'account_id' => $account->id, 'movement_date' => $date, 'direction' => $direction, 'type' => $type,
            'amount' => (string) $amount->toScale(2, RoundingMode::HALF_UP), 'currency' => $account->currency, 'fx_rate' => $this->money->fxFor($account->currency),
            'source_type' => $source, 'source_id' => $sourceId, 'description' => mb_substr($description, 0, 255), 'reference' => $reference, 'sede_id' => $account->sede_id ?? null,
            'status' => 'posted', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey(),
            ...array_filter($extra, fn ($value) => $value !== null),
        ]);

        if ($audit) {
            $this->audit->log('Movimiento de tesorería', $code, 'registrar', null, "{$account->code} · {$direction} · {$account->currency} {$amount}");
        }

        return $code;
    }

    private function ensureFunds(object $account, BigDecimal $amount): void
    {
        if ($amount->isGreaterThan($this->balance($account))) {
            throw ApiException::unprocessable('TES-BR-01', "El importe supera el saldo disponible de {$account->name}.");
        }
    }

    private function account(string $code, bool $lock = false): object
    {
        $query = DB::table('fin_treasury_accounts')->where('code', $code)->whereNull('deleted_at');
        $account = ($lock ? $query->lockForUpdate() : $query)->first() ?? throw ApiException::notFound('La cuenta no existe.');

        if ($lock && $account->status !== 'active') {
            throw ApiException::unprocessable('VALIDATION_ERROR', "La cuenta {$account->name} está inactiva.");
        }

        return $account;
    }

    private function pettyCash(string $code, bool $lock = false): object
    {
        $account = $this->account($code, $lock);

        if ($account->kind !== 'petty_cash') {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Esta operación es solo para cajas chicas.');
        }

        return $account;
    }

    private function event(string $replenishmentId, ?string $from, string $to, ?string $note, User $actor): void
    {
        DB::table('fin_cash_replenishment_events')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $this->context->idOrFail(), 'replenishment_id' => $replenishmentId, 'from_status' => $from, 'to_status' => $to, 'note' => $note, 'user_id' => $actor->getKey(), 'created_by' => $actor->getKey(), 'created_at' => now()]);
    }
}
