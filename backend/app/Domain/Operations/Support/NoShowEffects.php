<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\IncidentWorkflow;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class NoShowEffects
{
    public const EVENT = 'pasajero.no_show';

    public function __construct(
        private readonly OperationsSettings $settings,
        private readonly StaffNotices $notices,
        private readonly IncidentWorkflow $incidents,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly OpsCommon $common,
    ) {}

    public static function chargePct(?string $policy): ?int
    {
        $text = mb_strtolower(trim((string) $policy));

        if ($text === '') {
            return null;
        }

        if (preg_match('/(\d{1,3})\s*%/u', $text, $match) === 1) {
            return max(0, min(100, (int) $match[1]));
        }

        return str_contains($text, 'sin cargo') || str_contains($text, 'sin penalidad') ? 0 : null;
    }

    public static function chargeAmount(mixed $servicePrice, int $pax, int $pct): BigDecimal
    {
        $perPax = Decimal::money($servicePrice)->toScale(6)->dividedBy(max(1, $pax), 6, RoundingMode::HALF_UP);

        return Decimal::round2($perPax->multipliedBy($pct)->dividedBy(100, 6, RoundingMode::HALF_UP));
    }

    public function apply(object $service, Collection $rows, User $actor): array
    {
        if ($rows->isEmpty()) {
            return ['notified' => false, 'incident' => null, 'charge' => null];
        }

        $rules = $this->settings->noShowRules();
        $reservation = DB::table('booking_reservations')->where('id', $service->reservation_id)->first(['id', 'code', 'owner_id', 'client_id', 'title']);
        $names = $rows->pluck('passenger')->implode(', ');
        $ids = $rows->pluck('id')->all();
        $result = ['notified' => false, 'incident' => null, 'charge' => null];

        if ($rules['notify_advisor'] && $reservation?->owner_id) {
            $sent = $this->notices->toUser((string) $reservation->owner_id, self::EVENT, "No se presentó: {$names}", "{$service->name} del ".CarbonImmutable::parse($service->service_date)->format('d/m/Y')." en la reserva {$reservation->code}.", 'ops_no_show', (string) $ids[0], (string) $reservation->id);

            if ($sent > 0) {
                DB::table('ops_no_shows')->whereIn('id', $ids)->update(['advisor_notified_at' => now()]);
                $result['notified'] = true;
            }
        }

        if ($rules['incident']) {
            $result['incident'] = $this->incident($service, $reservation, $names, $ids, $actor);
        }

        if ($rules['charge'] && $reservation !== null) {
            $result['charge'] = $this->charge($service, $reservation, $rows, $actor);
        }

        return $result;
    }

    private function incident(object $service, ?object $reservation, string $names, array $ids, User $actor): ?string
    {
        $order = DB::table('ops_orders')->whereNull('deleted_at')->where('reservation_id', $service->reservation_id)->where('status', '<>', 'cancelada')->first(['code', 'coordinator_id']);
        $assignee = $order?->coordinator_id ? (string) $order->coordinator_id : ($this->common->coordinators()->first()['id'] ?? null);

        if ($order === null || $assignee === null) {
            return null;
        }

        $code = $this->incidents->create([
            'order_code' => $order->code,
            'type' => 'Pasajero',
            'severity' => 'baja',
            'title' => mb_substr("No-show: {$names}", 0, 150),
            'description' => "No se presentaron a {$service->name} del ".CarbonImmutable::parse($service->service_date)->format('d/m/Y').' (reserva '.($reservation->code ?? '—').'). Incidencia abierta automáticamente según Configuración › Operaciones.',
            'assignee_id' => $assignee,
        ], $actor);
        DB::table('ops_no_shows')->whereIn('id', $ids)->update(['incident_id' => DB::table('ops_incidents')->where('code', $code)->value('id')]);

        return $code;
    }

    private function charge(object $service, object $reservation, Collection $rows, User $actor): ?array
    {
        $policy = $service->product_id ? DB::table('catalog_product_policies')->where('product_id', $service->product_id)->value('no_show') : null;
        $pct = self::chargePct(is_string($policy) ? $policy : null);

        if ($pct === null || $pct === 0) {
            DB::table('ops_no_shows')->whereIn('id', $rows->pluck('id')->all())->update(['charge_pct' => $pct]);

            return null;
        }

        $pax = (int) ($service->pax ?: DB::table('booking_passengers')->where('reservation_id', $reservation->id)->count());
        $each = self::chargeAmount($service->price_amount, $pax, $pct);
        $total = $each->multipliedBy($rows->count())->toScale(2);

        if (! $total->isPositive()) {
            return null;
        }

        $code = $this->sequences->next('receivable');
        $receivableId = (string) DB::table('fin_receivables')->insertGetId([
            'code' => $code,
            'reservation_id' => $reservation->id,
            'client_id' => $reservation->client_id,
            'kind' => 'penalidad',
            'concept' => mb_substr("Cargo por no-show ({$pct} %) — {$service->name} · ".$rows->pluck('passenger')->implode(', '), 0, 255),
            'amount' => (string) $total,
            'currency' => $service->currency,
            'fx_rate' => $service->fx_rate,
            'due_date' => CarbonImmutable::parse($this->common->today())->addDays(7)->toDateString(),
            'status' => 'abierta',
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);
        DB::table('ops_no_shows')->whereIn('id', $rows->pluck('id')->all())->update(['receivable_id' => $receivableId, 'charge_pct' => $pct, 'charge_amount' => (string) $each, 'charge_currency' => $service->currency]);
        $this->audit->log('Cuenta por cobrar', $code, 'crear', null, "{$service->currency} {$total} · no-show {$pct} %", actor: $actor);

        return ['receivable' => $code, 'amount' => (string) $total, 'currency' => $service->currency, 'pct' => $pct];
    }
}
