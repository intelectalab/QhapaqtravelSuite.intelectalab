<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\CommissionDirectory;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;

final class CommissionWorkflow
{
    public function __construct(private readonly SequenceService $sequences, private readonly AuditLogger $audit, private readonly CommissionDirectory $directory) {}

    public function calculate(User $actor): int
    {
        return DB::transaction(function () use ($actor): int {
            $rules = DB::table('fin_commission_rules')->where('active', true)->get(['id', 'condition', 'pct'])->keyBy('condition');
            $reservations = $this->directory->eligibleReservations()
                ->get(['b.id', 'b.code', 'b.channel', 'b.owner_id', 'b.currency', 'b.fx_rate', 'b.total_amount', 'c.segment_code', 'a.id as agency_id', 'a.commission_pct']);
            $created = 0;

            foreach ($reservations as $reservation) {
                $total = Decimal::money($reservation->total_amount);
                $isAgency = $reservation->channel === 'B2B' && $reservation->agency_id !== null;
                if (! $isAgency && $reservation->owner_id === null) {
                    continue;
                }

                $corporate = in_array($reservation->channel, ['Corporativo', 'Grupos'], true) || $reservation->segment_code === 'Corporativo';
                $rule = $rules->get($isAgency ? 'b2b_convenio' : ($corporate ? 'corporativo_grupos' : 'directo_ecommerce'));
                $pct = Decimal::of($isAgency ? $reservation->commission_pct : ($rule->pct ?? ($corporate ? '2.5' : '3')))->stripTrailingZeros();
                $base = $isAgency || $reservation->currency === 'USD' ? $total : Decimal::withoutIgv($total);
                $description = $isAgency ? "Convenio B2B: {$pct} % sobre el total de la reserva" : ($corporate ? 'Vendedor corporativo o grupos' : 'Vendedor venta directa').": {$pct} % sobre ".($reservation->currency === 'USD' ? 'el total (exportación, sin IGV)' : 'la venta neta sin IGV');
                $code = $this->sequences->next('commission');

                $id = (string) DB::table('fin_commissions')->insertGetId([
                    'code' => $code,
                    'reservation_id' => $reservation->id,
                    'kind' => $isAgency ? 'agencia_b2b' : 'vendedor',
                    'beneficiary_user_id' => $isAgency ? null : $reservation->owner_id,
                    'beneficiary_agency_id' => $isAgency ? $reservation->agency_id : null,
                    'rule_id' => $rule->id ?? null,
                    'rule_description' => $description,
                    'base_amount' => (string) $base,
                    'pct' => (string) $pct,
                    'amount' => (string) $base->multipliedBy($pct)->dividedBy(100, 2, RoundingMode::HALF_UP),
                    'currency' => $reservation->currency,
                    'fx_rate' => $reservation->currency === 'USD' ? $reservation->fx_rate : null,
                    'status' => 'calculada',
                    'created_by' => $actor->getKey(),
                    'updated_by' => $actor->getKey(),
                ], 'id');
                FinanceHistory::record('commission', $id, 'calculada', $description, $actor);
                $this->audit->log('Comisión', $code, 'calcular', null, "{$reservation->code} · {$pct} %");
                $created++;
            }

            return $created;
        });
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
