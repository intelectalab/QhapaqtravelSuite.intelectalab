<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Events\SupplierPaymentRegistered;
use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Finance\Support\FinanceNotices;
use App\Domain\Finance\Support\PayableDirectory;
use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Illuminate\Support\Facades\DB;

final class PayableWorkflow
{
    public function __construct(private readonly SequenceService $sequences, private readonly Consolidation $money, private readonly AuditLogger $audit) {}

    public function createCost(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $reservation = DB::table('booking_reservations')->where('code', $data['reservation'])->whereNull('deleted_at')->first(['id', 'code', 'status']);
            if ($reservation === null || in_array($reservation->status, ['borrador', 'cancelada'], true)) {
                throw ApiException::unprocessable('FIN-BR-23', 'El costo se registra sobre una reserva vigente (no borrador ni cancelada).');
            }

            $provider = $this->activeProvider($data['provider']);
            $code = $this->sequences->next('payable');
            DB::table('fin_payables')->insert([
                'code' => $code,
                'provider_id' => $provider->id,
                'reservation_id' => $reservation->id,
                'kind' => 'costo_adicional',
                'cost_type' => $data['cost_type'],
                'concept' => $data['concept'],
                'amount' => (string) Decimal::money($data['amount']),
                'currency' => $data['currency'],
                'fx_rate' => $this->money->fxFor($data['currency'], $data['fx_rate'] ?? null),
                'due_date' => $data['due_date'] ?? $this->money->now()->addDays(15)->toDateString(),
                'status' => 'abierta',
                'supplier_doc_number' => $data['supplier_doc'] ?? null,
                'evidence_note' => $data['evidence'] ?? null,
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Costo', $code, 'registrar', null, "{$reservation->code} · {$data['currency']} {$data['amount']} · {$provider->name}");

            return $code;
        });
    }

    public function update(string $code, array $data, User $actor, ?int $lockVersion = null): void
    {
        DB::transaction(function () use ($code, $data, $actor, $lockVersion): void {
            $payable = $this->open($code);
            $this->ensureActive($payable);

            if ($lockVersion !== null) {
                IfMatch::assertMatches($lockVersion, (int) $payable->lock_version, 'La obligación');
            }
            $managed = $payable->kind === 'servicio' && $payable->reservation_service_id !== null;
            if ($managed && ((isset($data['amount']) && ! Decimal::money($data['amount'])->isEqualTo(Decimal::money($payable->amount))) || $data['due_date'] !== (string) $payable->due_date)) {
                throw ApiException::conflict('FIN-BR-18', 'El importe y el vencimiento de esta obligación salen del servicio de la reserva y de la condición de pago del proveedor. Programa el pago para fijar otra fecha o registra un costo adicional por la diferencia.');
            }

            $values = [
                'concept' => $data['concept'],
                'due_date' => $data['due_date'],
                'supplier_doc_number' => $data['supplier_doc'] ?? null,
                'evidence_note' => $data['evidence'] ?? null,
                ...$this->reassignment($payable, $data),
            ];

            if (isset($data['amount']) && ! Decimal::money($data['amount'])->isEqualTo(Decimal::money($payable->amount))) {
                if ($payable->approved_at !== null || Decimal::of($payable->paid_amount)->isPositive()) {
                    throw ApiException::conflict('FIN-BR-19', 'El importe solo se corrige antes de aprobar la obligación.');
                }
                $values['amount'] = (string) Decimal::money($data['amount']);
            }

            DB::table('fin_payables')->where('id', $payable->id)->update([...$values, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Cuenta por pagar', $payable->code, 'editar', $payable->concept, $values['concept']);
        });
    }

    private function reassignment(object $payable, array $data): array
    {
        $requested = array_intersect_key($data, array_flip(['reservation', 'provider', 'cost_type', 'currency', 'fx_rate']));

        if ($requested === []) {
            return [];
        }

        $current = DB::table('fin_payables as p')->leftJoin('booking_reservations as b', 'b.id', '=', 'p.reservation_id')->leftJoin('catalog_providers as v', 'v.id', '=', 'p.provider_id')
            ->where('p.id', $payable->id)->first(['b.code as reservation', 'v.ref as provider']);
        $currency = $requested['currency'] ?? $payable->currency;
        $changes = array_filter([
            'reservation' => isset($requested['reservation']) && $requested['reservation'] !== $current->reservation,
            'provider' => isset($requested['provider']) && $requested['provider'] !== $current->provider,
            'cost_type' => isset($requested['cost_type']) && $requested['cost_type'] !== $payable->cost_type,
            'currency' => $currency !== $payable->currency,
            'fx_rate' => $currency === 'USD' && isset($requested['fx_rate']) && (float) $requested['fx_rate'] !== (float) $payable->fx_rate,
        ]);

        if ($changes === []) {
            return [];
        }

        if ($payable->kind !== 'costo_adicional') {
            throw ApiException::conflict('FIN-BR-18', 'La reserva, el proveedor y la moneda de esta obligación salen del servicio de la reserva. Corrígelos en el servicio o registra un costo adicional.');
        }

        if ($payable->approved_at !== null || Decimal::of($payable->paid_amount)->isPositive()) {
            throw ApiException::conflict('FIN-BR-19', 'La reserva, el proveedor, el tipo y la moneda solo se corrigen antes de aprobar el costo.');
        }

        $values = [];

        if (isset($changes['reservation'])) {
            $reservation = DB::table('booking_reservations')->where('code', $requested['reservation'])->whereNull('deleted_at')->first(['id', 'status']);
            if ($reservation === null || in_array($reservation->status, ['borrador', 'cancelada'], true)) {
                throw ApiException::unprocessable('FIN-BR-23', 'El costo se registra sobre una reserva vigente (no borrador ni cancelada).');
            }
            $values['reservation_id'] = $reservation->id;
        }

        if (isset($changes['provider'])) {
            $values['provider_id'] = $this->activeProvider($requested['provider'])->id;
        }

        if (isset($changes['cost_type'])) {
            $values['cost_type'] = $requested['cost_type'];
        }

        if (isset($changes['currency']) || isset($changes['fx_rate'])) {
            $values['currency'] = $currency;
            $values['fx_rate'] = $this->money->fxFor($currency, $requested['fx_rate'] ?? null);
        }

        return $values;
    }

    public function schedule(string $code, array $data, ?int $lockVersion, User $actor): void
    {
        DB::transaction(function () use ($code, $data, $lockVersion, $actor): void {
            $payable = $this->open($code);
            $this->ensureActive($payable);

            if ($lockVersion !== null) {
                IfMatch::assertMatches($lockVersion, (int) $payable->lock_version, 'La obligación');
            }

            if ($payable->approved_at === null) {
                throw ApiException::unprocessable('PROC-046', 'Aprueba la obligación antes de programar su pago.');
            }

            $account = $this->bankAccount($data['bank_account'], (string) $payable->currency);
            DB::table('fin_payables')->where('id', $payable->id)->update(['scheduled_date' => $data['scheduled_date'], 'scheduled_bank_account_id' => $account->id, 'scheduled_by' => $actor->getKey(), 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            FinanceHistory::record('payable', $payable->id, 'programada', "{$data['scheduled_date']} · {$account->name}", $actor);
            $this->audit->log('Cuenta por pagar', $payable->code, 'programar', $payable->scheduled_date ? (string) $payable->scheduled_date : null, "{$data['scheduled_date']} · {$account->code}");
        });
    }

    private function bankAccount(string $code, string $currency): object
    {
        $account = DB::table('fin_treasury_accounts')->where('code', $code)->whereNull('deleted_at')->where('kind', 'bank')->where('status', 'active')->first(['id', 'code', 'name', 'currency']);

        if ($account === null) {
            throw ApiException::unprocessable('FIN-BR-21', 'Elige una cuenta bancaria activa de tesorería.');
        }

        if ($account->currency !== $currency) {
            throw ApiException::unprocessable('FIN-BR-21', "La cuenta de origen debe estar en {$currency}, la moneda de la obligación.");
        }

        return $account;
    }

    public function approve(string $code, User $actor): array
    {
        return DB::transaction(function () use ($code, $actor): array {
            $payable = $this->open($code);
            $this->ensureActive($payable);

            if ($payable->approved_at !== null) {
                throw ApiException::conflict('FIN-BR-19', 'La obligación ya está aprobada.');
            }

            $warnings = [];
            if (DB::table('catalog_providers')->where('id', $payable->provider_id)->value('status') !== 'activo') {
                $warnings[] = 'El proveedor no está activo.';
            }

            DB::table('fin_payables')->where('id', $payable->id)->update(['approved_at' => now(), 'approved_by' => $actor->getKey(), 'status' => 'aprobada', 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            FinanceHistory::record('payable', $payable->id, 'aprobada', $warnings ? implode(' ', $warnings) : null, $actor);
            $this->audit->log($payable->kind === 'costo_adicional' ? 'Costo' : 'Cuenta por pagar', $payable->code, 'aprobar', $payable->status, 'aprobada');

            return $warnings;
        });
    }

    public function pay(string $code, array $data, User $actor): string
    {
        return DB::transaction(function () use ($code, $data, $actor): string {
            $payable = $this->open($code);
            $this->ensureActive($payable);

            if ($payable->approved_at === null) {
                throw ApiException::unprocessable('FIN-BR-19', 'PROC-046: aprueba la obligación antes de pagarla.');
            }

            $balance = ReceivableLedger::balance($payable);
            $amount = Decimal::money($data['amount']);
            if ($amount->isGreaterThan($balance)) {
                throw ApiException::unprocessable('FIN-BR-22', 'El pago no puede exceder el saldo de la obligación.');
            }

            $bank = filled($data['bank_account'] ?? null) ? $this->bankAccount($data['bank_account'], (string) $payable->currency)->id : $payable->scheduled_bank_account_id;
            $payoutCode = $this->sequences->next('payout');
            $payoutId = (string) DB::table('fin_payable_payouts')->insertGetId([
                'code' => $payoutCode,
                'payable_id' => $payable->id,
                'paid_on' => $data['paid_on'],
                'amount' => (string) $amount,
                'fx_rate' => $this->money->fxFor($payable->currency, $data['fx_rate'] ?? $payable->fx_rate),
                'method' => $data['method'],
                'bank_account_id' => $bank,
                'operation_ref' => $data['operation_ref'],
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ], 'id');

            $paid = Decimal::of($payable->paid_amount)->plus($amount);
            $settled = $paid->isGreaterThanOrEqualTo(Decimal::of($payable->amount));
            DB::table('fin_payables')->where('id', $payable->id)->update([
                'paid_amount' => (string) Decimal::round2($settled ? Decimal::of($payable->amount) : $paid),
                'status' => $settled ? 'pagada' : 'parcial',
                'scheduled_date' => $settled ? null : $payable->scheduled_date,
                'scheduled_bank_account_id' => $settled ? null : $payable->scheduled_bank_account_id,
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            FinanceHistory::record('payable', $payable->id, $settled ? 'pagada' : 'parcial', "{$payoutCode} · {$data['operation_ref']}", $actor);
            $this->audit->log('Cuenta por pagar', $payable->code, 'pagar', (string) Decimal::round2($balance), (string) Decimal::round2($balance->minus($amount)));
            SupplierPaymentRegistered::dispatch($payoutId, (string) $actor->getKey());
            app(FinanceNotices::class)->supplierPaid((string) $payable->code, (string) Decimal::round2($amount));

            return $payoutCode;
        });
    }

    public function cancel(string $code, string $reason, User $actor): void
    {
        DB::transaction(function () use ($code, $reason, $actor): void {
            $payable = $this->open($code);
            $this->ensureActive($payable);

            if (Decimal::of($payable->paid_amount)->isPositive()) {
                throw ApiException::conflict('FIN-BR-18', 'La obligación ya tiene pagos registrados; no se puede anular.');
            }

            DB::table('fin_payables')->where('id', $payable->id)->update(['status' => 'cancelada', 'observation' => $reason, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            FinanceHistory::record('payable', $payable->id, 'cancelada', $reason, $actor);
            $this->audit->log('Cuenta por pagar', $payable->code, 'cancelar', $payable->status, $reason);
        });
    }

    private function activeProvider(string $ref): object
    {
        $provider = DB::table('catalog_providers')->where('ref', $ref)->whereNull('deleted_at')->first(['id', 'name', 'status']);

        if ($provider === null || $provider->status !== 'activo') {
            throw ApiException::unprocessable('PRD-BR-007', 'Elige un proveedor activo.');
        }

        return $provider;
    }

    private function ensureActive(object $payable): void
    {
        if ($payable->status === 'cancelada' || ! ReceivableLedger::balance($payable)->isPositive()) {
            throw ApiException::conflict('FIN-BR-18', $payable->status === 'cancelada' ? 'La obligación está anulada.' : 'La obligación ya está pagada.');
        }
    }

    private function open(string $code): object
    {
        $payable = DB::table('fin_payables')->where('code', $code)->whereNull('deleted_at')->lockForUpdate()->first();

        if ($payable === null) {
            throw ApiException::notFound('La cuenta por pagar no existe.');
        }

        return $payable;
    }

    public static function costTypes(): array
    {
        return array_keys(PayableDirectory::COST_TYPES);
    }
}
