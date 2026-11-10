<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Finance\Support\SupplierPaymentTerms;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class SyncServicePayables
{
    public const GENERATING = ['confirmada', 'pendiente_proveedor', 'reprogramada', 'parcial', 'incidencia', 'en_operacion'];

    public function __construct(
        private readonly SequenceService $sequences,
        private readonly Consolidation $money,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(string $reservationId, ?User $actor = null): array
    {
        $result = ['created' => [], 'adjusted' => [], 'cancelled' => []];
        $reservation = DB::table('booking_reservations')->where('id', $reservationId)->whereNull('deleted_at')->lock('for no key update')->first(['id', 'code', 'status', 'currency', 'fx_rate']);

        if ($reservation === null) {
            return $result;
        }

        $services = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->orderBy('service_date')->orderBy('code')
            ->get(['id', 'code', 'name', 'provider_id', 'service_date', 'status', 'currency', 'fx_rate', 'cost_amount']);
        $payables = DB::table('fin_payables')->where('reservation_id', $reservation->id)->where('kind', 'servicio')->whereNull('deleted_at')->orderBy('created_at')->lockForUpdate()->get();
        $linked = $payables->whereNotNull('reservation_service_id')->groupBy('reservation_service_id')->map(fn (Collection $rows): object => $rows->last());
        $legacy = $payables->whereNull('reservation_service_id')->where('status', '<>', 'cancelada')->pluck('provider_id')->unique()->all();
        $terms = DB::table('catalog_providers')->whereIn('id', $services->pluck('provider_id')->filter()->unique()->values()->all())->pluck('payment_terms', 'id');
        $generating = in_array($reservation->status, self::GENERATING, true);
        $today = CarbonImmutable::parse($this->money->today())->startOfDay();

        foreach ($services as $service) {
            $payable = $linked->get($service->id);
            $reason = $this->dropReason($service, $reservation->status);

            if ($payable !== null) {
                if (! self::pending($payable)) {
                    continue;
                }

                if ($reason !== null) {
                    $this->cancel($payable, $reason, $actor);
                    $result['cancelled'][] = $payable->code;

                    continue;
                }

                $target = $this->target($service, $reservation, $terms->get($service->provider_id), $today);
                if ($this->differs($payable, $target)) {
                    $this->adjust($payable, $target, $service, $actor);
                    $result['adjusted'][] = $payable->code;
                }

                continue;
            }

            if (! $generating || $reason !== null || in_array($service->provider_id, $legacy, true)) {
                continue;
            }

            $result['created'][] = $this->create($reservation, $service, $this->target($service, $reservation, $terms->get($service->provider_id), $today), $actor);
        }

        return $result;
    }

    public static function pending(object $payable): bool
    {
        return $payable->status !== 'cancelada' && $payable->approved_at === null && ! Decimal::of($payable->paid_amount)->isPositive();
    }

    private function dropReason(object $service, string $reservationStatus): ?string
    {
        return match (true) {
            $service->status === 'cancelado' && $reservationStatus === 'cancelada' => 'Reserva cancelada',
            $service->status === 'cancelado' => 'Servicio cancelado',
            $service->status === 'rechazado' => 'El proveedor rechazó el servicio',
            $service->provider_id === null => 'El servicio quedó sin proveedor',
            ! Decimal::of($service->cost_amount)->isPositive() => 'El servicio quedó sin costo',
            default => null,
        };
    }

    private function target(object $service, object $reservation, ?string $terms, CarbonImmutable $today): array
    {
        $currency = (string) $service->currency;
        $due = SupplierPaymentTerms::dueDate($terms, CarbonImmutable::parse((string) $service->service_date)->startOfDay(), $today);
        $fx = $service->fx_rate ?? ($reservation->currency === 'USD' ? $reservation->fx_rate : null);

        return [
            'provider_id' => (string) $service->provider_id,
            'concept' => mb_substr((string) $service->name, 0, 255),
            'amount' => (string) Decimal::money($service->cost_amount),
            'currency' => $currency,
            'fx_rate' => $this->money->fxFor($currency, $fx),
            'due_date' => $due->toDateString(),
            'status' => $due->lessThan($today) ? 'vencida' : 'abierta',
        ];
    }

    private function differs(object $payable, array $target): bool
    {
        return (string) $payable->provider_id !== $target['provider_id']
            || ! Decimal::of($payable->amount)->isEqualTo(Decimal::of($target['amount']))
            || $payable->currency !== $target['currency']
            || (string) $payable->due_date !== $target['due_date']
            || $payable->status !== $target['status']
            || ($target['fx_rate'] === null) !== ($payable->fx_rate === null);
    }

    private function create(object $reservation, object $service, array $target, ?User $actor): string
    {
        $code = $this->sequences->next('payable');
        DB::table('fin_payables')->insert([
            ...$target,
            'code' => $code,
            'reservation_id' => $reservation->id,
            'reservation_service_id' => $service->id,
            'kind' => 'servicio',
            'created_by' => $actor?->getKey(),
            'updated_by' => $actor?->getKey(),
        ]);
        $this->audit->log('Cuenta por pagar', $code, 'generar', null, "{$reservation->code} · {$service->code} · {$target['currency']} {$target['amount']} · vence {$target['due_date']}", actor: $actor);

        return $code;
    }

    private function adjust(object $payable, array $target, object $service, ?User $actor): void
    {
        DB::table('fin_payables')->where('id', $payable->id)->update([...$target, 'concept' => $payable->concept, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor?->getKey(), 'updated_at' => now()]);
        $this->audit->log('Cuenta por pagar', $payable->code, 'ajustar', "{$payable->currency} ".Decimal::money($payable->amount)." · vence {$payable->due_date}", "{$target['currency']} {$target['amount']} · vence {$target['due_date']} · {$service->code}", actor: $actor);
    }

    private function cancel(object $payable, string $reason, ?User $actor): void
    {
        DB::table('fin_payables')->where('id', $payable->id)->update(['status' => 'cancelada', 'observation' => $reason, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor?->getKey(), 'updated_at' => now()]);
        FinanceHistory::record('payable', (string) $payable->id, 'cancelada', $reason, $actor);
        $this->audit->log('Cuenta por pagar', $payable->code, 'cancelar', $payable->status, "cancelada · {$reason}", actor: $actor);
    }
}
