<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Booking\Models\Reservation;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Money\Money;
use Illuminate\Support\Facades\DB;

final class ReservationReceivables
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly ConversionPlan $plan,
    ) {}

    public function exist(string $reservationId): bool
    {
        return DB::table('fin_receivables')->where('reservation_id', $reservationId)->whereNull('deleted_at')->where('status', '<>', 'cancelada')->exists();
    }

    public function create(Reservation $reservation, User $actor, ?BigDecimal $total = null): array
    {
        $tenantId = $this->context->idOrFail();
        $today = $this->plan->today();
        $amount = $total ?? $this->total($reservation);
        $codes = [];

        foreach ($this->plan->receivables($amount, $reservation->travel_from, $today) as $receivable) {
            $code = $this->sequences->next('receivable');
            DB::table('fin_receivables')->insert([
                'tenant_id' => $tenantId,
                'code' => $code,
                'reservation_id' => $reservation->id,
                'client_id' => $reservation->client_id,
                'kind' => $receivable['kind'],
                'concept' => mb_substr($receivable['concept'].' — '.$reservation->title, 0, 255),
                'amount' => (string) $receivable['amount'],
                'currency' => $reservation->currency,
                'fx_rate' => $reservation->fx_rate,
                'due_date' => $receivable['due']->toDateString(),
                'status' => 'abierta',
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Cuenta por cobrar', $code, 'crear', null, "{$reservation->currency} {$receivable['amount']}", actor: $actor);
            $codes[] = ['code' => $code, 'kind' => $receivable['kind'], 'amount' => (string) $receivable['amount'], 'due_date' => $receivable['due']->toDateString()];
        }

        return $codes;
    }

    private function total(Reservation $reservation): BigDecimal
    {
        $total = $reservation->total_amount;

        return $total instanceof Money ? $total->getAmount() : BigDecimal::of((string) ($total ?? '0'));
    }
}
