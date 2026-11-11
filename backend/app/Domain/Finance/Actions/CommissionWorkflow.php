<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\CommissionDirectory;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Brick\Math\RoundingMode;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class CommissionWorkflow
{
    public function __construct(private readonly SequenceService $sequences, private readonly AuditLogger $audit, private readonly CommissionDirectory $directory) {}

    public function calculate(User $actor): int
    {
        return DB::transaction(function () use ($actor): int {
            $rules = $this->rules();
            $reservations = $this->directory->eligibleReservations()->get(CommissionDirectory::RESERVATION_COLUMNS);
            $created = 0;

            foreach ($reservations as $reservation) {
                $terms = $this->terms($reservation, $rules);
                if ($terms === null) {
                    continue;
                }

                $code = $this->sequences->next('commission');
                $id = (string) DB::table('fin_commissions')->insertGetId([
                    'code' => $code,
                    'reservation_id' => $reservation->id,
                    'kind' => $terms['kind'],
                    'beneficiary_user_id' => $terms['user'],
                    'beneficiary_agency_id' => $terms['agency'],
                    'rule_id' => $terms['rule_id'],
                    'rule_description' => $terms['description'],
                    'base_amount' => $terms['base'],
                    'pct' => $terms['pct'],
                    'amount' => $terms['amount'],
                    'currency' => $reservation->currency,
                    'fx_rate' => $reservation->currency === 'USD' ? $reservation->fx_rate : null,
                    'status' => 'calculada',
                    'created_by' => $actor->getKey(),
                    'updated_by' => $actor->getKey(),
                ], 'id');
                FinanceHistory::record('commission', $id, 'calculada', $terms['description'], $actor);
                $this->audit->log('Comisión', $code, 'calcular', null, "{$reservation->code} · {$terms['pct']} %");
                $created++;
            }

            return $created;
        });
    }

    public function recalculate(string $code, ?int $lockVersion, User $actor): array
    {
        $result = [];
        DB::transaction(function () use ($code, $lockVersion, $actor, &$result): void {
            $commission = $this->open($code);

            if ($lockVersion !== null) {
                IfMatch::assertMatches($lockVersion, (int) $commission->lock_version, 'La comisión');
            }

            if ($commission->status === 'pagada') {
                throw ApiException::conflict('FIN-BR-29', 'La comisión ya está pagada: registra un ajuste en el siguiente periodo.');
            }

            if ($commission->reservation_id === null) {
                throw ApiException::unprocessable('FIN-BR-29', 'Los bonos por meta se recalculan desde la meta de ventas.');
            }

            $reservation = $this->directory->reservations()->where('b.id', $commission->reservation_id)->first(CommissionDirectory::RESERVATION_COLUMNS);
            $terms = $reservation ? $this->terms($reservation, $this->rules()) : null;

            if ($reservation === null || $terms === null) {
                throw ApiException::unprocessable('FIN-BR-29', 'La reserva ya no tiene asesor ni agencia con convenio: anula la comisión en lugar de recalcularla.');
            }

            $status = $commission->status === 'aprobada' ? 'calculada' : $commission->status;
            DB::table('fin_commissions')->where('id', $commission->id)->update([
                'kind' => $terms['kind'], 'beneficiary_user_id' => $terms['user'], 'beneficiary_agency_id' => $terms['agency'], 'rule_id' => $terms['rule_id'], 'rule_description' => $terms['description'],
                'base_amount' => $terms['base'], 'pct' => $terms['pct'], 'amount' => $terms['amount'], 'fx_rate' => $reservation->currency === 'USD' ? $reservation->fx_rate : null,
                'status' => $status, 'approved_at' => $status === 'calculada' ? null : $commission->approved_at, 'approved_by' => $status === 'calculada' ? null : $commission->approved_by,
                'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now(),
            ]);
            FinanceHistory::record('commission', $commission->id, $status, "Recalculada: {$terms['description']}", $actor);
            $this->audit->log('Comisión', $commission->code, 'recalcular', "{$commission->pct} % · {$commission->amount}", "{$terms['pct']} % · {$terms['amount']}".($commission->status === 'aprobada' ? ' · vuelve a revisión' : ''));

            $result = ['code' => (string) $commission->code, 'before' => (string) $commission->amount, 'after' => (string) $terms['amount'], 'status' => (string) $status];
        });

        return $result;
    }

    private function rules(): Collection
    {
        $today = now()->toDateString();

        return DB::table('fin_commission_rules')->where('active', true)->where('valid_from', '<=', $today)
            ->where(fn ($query) => $query->whereNull('valid_to')->orWhere('valid_to', '>=', $today))
            ->orderBy('valid_from')->get(['id', 'condition', 'pct', 'base_type'])->keyBy('condition');
    }

    private function terms(object $reservation, Collection $rules): ?array
    {
        $total = Decimal::money($reservation->total_amount);
        $isAgency = $reservation->channel === 'B2B' && $reservation->agency_id !== null;
        if (! $isAgency && $reservation->owner_id === null) {
            return null;
        }

        $corporate = in_array($reservation->channel, ['Corporativo', 'Grupos'], true) || $reservation->segment_code === 'Corporativo';
        $rule = $rules->get($isAgency ? 'b2b_convenio' : ($corporate ? 'corporativo_grupos' : 'directo_ecommerce'));
        $pct = Decimal::of($isAgency ? $reservation->commission_pct : ($rule->pct ?? ($corporate ? '2.5' : '3')))->strippedOfTrailingZeros();
        $onTotal = $isAgency || $reservation->currency === 'USD' || ($rule->base_type ?? null) === 'total';
        $base = $onTotal ? $total : Decimal::withoutIgv($total);
        $description = $isAgency ? "Convenio B2B: {$pct} % sobre el total de la reserva" : ($corporate ? 'Vendedor corporativo o grupos' : 'Vendedor venta directa').": {$pct} % sobre ".($reservation->currency === 'USD' ? 'el total (exportación, sin IGV)' : ($onTotal ? 'el total de la reserva' : 'la venta neta sin IGV'));

        return [
            'kind' => $isAgency ? 'agencia_b2b' : 'vendedor',
            'user' => $isAgency ? null : $reservation->owner_id,
            'agency' => $isAgency ? $reservation->agency_id : null,
            'rule_id' => $rule->id ?? null,
            'description' => $description,
            'base' => (string) $base,
            'pct' => (string) $pct,
            'amount' => (string) $base->multipliedBy($pct)->dividedBy(100, 2, RoundingMode::HALF_UP),
        ];
    }

    public function approve(string $code, User $actor): void
    {
        DB::transaction(function () use ($code, $actor): void {
            $commission = $this->open($code);
            if ($commission->status !== 'calculada') {
                throw ApiException::conflict('FIN-BR-28', 'Solo se aprueban comisiones calculadas.');
            }

            $this->transition($commission, 'aprobada', null, $actor, ['approved_at' => now(), 'approved_by' => $actor->getKey()]);
            $this->audit->log('Comisión', $commission->code, 'aprobar', 'calculada', 'aprobada');
        });
    }

    public function pay(string $code, string $method, string $reference, User $actor): void
    {
        DB::transaction(function () use ($code, $method, $reference, $actor): void {
            $commission = $this->open($code);
            if ($commission->status !== 'aprobada') {
                throw ApiException::conflict('FIN-BR-28', 'Solo se pagan comisiones aprobadas.');
            }

            if (! in_array($method, CommissionDirectory::PAY_METHODS[$commission->kind] ?? [], true)) {
                throw ApiException::unprocessable('FIN-BR-28', 'Esa forma de pago no corresponde al tipo de beneficiario.');
            }

            $this->transition($commission, 'pagada', "{$method} · {$reference}", $actor, ['paid_at' => now(), 'payment_method' => $method, 'payment_ref' => $reference]);
            $this->audit->log('Comisión', $commission->code, 'pagar', 'aprobada', "{$method} · {$reference}");
            $this->settleRequest($commission->settlement_request_id, $actor);
        });
    }

    private function settleRequest(?string $requestId, User $actor): void
    {
        $request = $requestId === null ? null : DB::table('channel_b2b_settlement_requests')->where('id', $requestId)->where('status', 'aprobada')->lockForUpdate()->first(['id', 'code']);

        if ($request === null || DB::table('fin_commissions')->where('settlement_request_id', $request->id)->whereNull('deleted_at')->where('status', '<>', 'pagada')->exists()) {
            return;
        }

        DB::table('channel_b2b_settlement_requests')->where('id', $request->id)->update(['status' => 'pagada', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Liquidación de comisiones', $request->code, 'pagar', 'aprobada', 'pagada');
    }

    public function annul(string $code, string $reason, User $actor): void
    {
        DB::transaction(function () use ($code, $reason, $actor): void {
            $commission = $this->open($code);
            if ($commission->status !== 'calculada') {
                throw ApiException::conflict('FIN-BR-29', 'Solo se anulan comisiones calculadas; las aprobadas o pagadas se ajustan en el siguiente periodo.');
            }

            DB::table('fin_commissions')->where('id', $commission->id)->update(['deleted_at' => now(), 'observation' => $reason, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Comisión', $commission->code, 'anular', 'calculada', $reason);
        });
    }

    private function transition(object $commission, string $status, ?string $note, User $actor, array $extra): void
    {
        DB::table('fin_commissions')->where('id', $commission->id)->update([...$extra, 'status' => $status, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        FinanceHistory::record('commission', $commission->id, $status, $note, $actor);
    }

    private function open(string $code): object
    {
        $commission = DB::table('fin_commissions')->where('code', $code)->whereNull('deleted_at')->lockForUpdate()->first();

        if ($commission === null) {
            throw ApiException::notFound('La comisión no existe.');
        }

        return $commission;
    }
}
