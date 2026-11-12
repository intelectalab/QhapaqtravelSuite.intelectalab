<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Catalog\Support\AllotmentConsumption;
use App\Domain\Catalog\Support\AllotmentNotices;
use App\Domain\Finance\Support\Consolidation;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;

final class ReleaseAllotments extends TenantJob
{
    protected function run(): string
    {
        $today = $this->today()->toDateString();
        $audit = app(AuditLogger::class);
        $this->resync($today);
        $days = DB::table('catalog_allotment_days as d')
            ->join('catalog_allotments as a', 'a.id', '=', 'd.allotment_id')
            ->whereIn('a.status', ['activo', 'en_release'])
            ->whereNull('a.deleted_at')
            ->whereNull('d.closed_at')
            ->whereNull('d.retained_at')
            ->where('d.release_deadline', '<=', $today)
            ->whereRaw('d.blocked_qty - d.released_qty - d.used_qty - d.pending_qty > 0')
            ->orderBy('d.id')
            ->lock('for update of d')
            ->get(['d.id', 'd.allotment_id', 'd.service_date', 'a.code', DB::raw('d.blocked_qty - d.released_qty - d.used_qty - d.pending_qty as free')]);

        $units = 0;

        foreach ($days as $day) {
            DB::table('catalog_allotment_days')->where('id', $day->id)->update([
                'released_qty' => DB::raw('released_qty + '.(int) $day->free),
                'updated_at' => now(),
            ]);
            DB::table('catalog_allotment_events')->insert([
                'allotment_id' => $day->allotment_id,
                'message' => mb_substr("Release automático: {$day->free} unidad(es) liberadas del {$day->service_date} (JOB-10)", 0, 300),
            ]);
            $units += (int) $day->free;
        }

        foreach ($days->groupBy('allotment_id') as $allotmentId => $released) {
            app(AllotmentNotices::class)->toProvider((string) $allotmentId, 'cupo.release', 'Release automático de cupo', 'Se liberaron por fecha límite de release: '.$released->map(fn (object $day): string => "{$day->service_date} ({$day->free})")->implode(', ').'.');
        }

        [$charges, $chargedTotal] = $this->charge($today, $audit);
        $this->settleStatus($today);

        $expired = DB::table('catalog_allotments')->whereIn('status', ['activo', 'en_release'])->whereNull('deleted_at')
            ->where('valid_to', '<', $today)->lockForUpdate()->get(['id', 'code', 'status']);

        foreach ($expired as $allotment) {
            DB::table('catalog_allotments')->where('id', $allotment->id)->update(['status' => 'vencido', 'updated_at' => now()]);
            $audit->log('Cupo', (string) $allotment->code, 'vencer', (string) $allotment->status, 'vencido');
        }

        $dates = $days->count();
        $result = $units === 0 ? 'Sin cupos por liberar' : "{$units} unidad(es) liberadas en ".self::plural($dates, 'fecha', 'fechas');

        $result = $charges === 0 ? $result : $result.' · '.self::plural($charges, 'cargo por no uso', 'cargos por no uso')." ({$chargedTotal})";

        return $expired->isEmpty() ? $result : $result.' · '.self::plural($expired->count(), 'contrato vencido', 'contratos vencidos');
    }

    private function resync(string $today): void
    {
        $consumption = app(AllotmentConsumption::class);
        DB::table('catalog_allotments as a')->whereNull('a.deleted_at')
            ->whereExists(fn ($query) => $query->from('catalog_allotment_days as d')->whereColumn('d.allotment_id', 'a.id')->whereNull('d.closed_at')
                ->where(fn ($due) => $due->where('d.release_deadline', '<=', $today)->orWhere('d.service_date', '<', $today)))
            ->whereExists(fn ($query) => $query->from('catalog_allotment_consumptions as c')->join('catalog_allotment_days as cd', 'cd.id', '=', 'c.allotment_day_id')
                ->whereColumn('cd.allotment_id', 'a.id'))
            ->orderBy('a.id')->lock('for no key update of a')->get(['a.id', 'a.code', 'a.service_id', 'a.provider_id', 'a.kind', 'a.valid_from', 'a.valid_to', 'a.status'])
            ->each(fn (object $contract) => $consumption->sync($contract));
    }

    private function charge(string $today, AuditLogger $audit): array
    {
        $days = DB::table('catalog_allotment_days as d')
            ->join('catalog_allotments as a', 'a.id', '=', 'd.allotment_id')
            ->whereNull('a.deleted_at')
            ->whereNull('d.closed_at')
            ->where('d.service_date', '<', $today)
            ->orderBy('d.id')
            ->lock('for update of d')
            ->get(['d.id', 'd.allotment_id', 'd.service_date', 'a.code', 'a.name', 'a.provider_id', 'a.net_rate', 'a.penalty_pct', 'a.currency', DB::raw('d.blocked_qty - d.released_qty - d.used_qty - d.pending_qty as free')]);
        $sequences = app(SequenceService::class);
        $money = app(Consolidation::class);
        $count = 0;
        $totals = [];

        foreach ($days as $day) {
            $free = max(0, (int) $day->free);

            if ($free > 0 && ! DB::table('catalog_allotment_charges')->where('allotment_day_id', $day->id)->exists()) {
                $amount = Decimal::round2(BigDecimal::of((string) $day->net_rate)->multipliedBy($free)->multipliedBy((string) $day->penalty_pct)->dividedBy(100, 6, RoundingMode::HALF_UP));
                $fx = $day->currency === 'USD' ? number_format($money->usdRate(), 6, '.', '') : null;
                $payableId = null;

                if ($amount->isPositive()) {
                    $code = $sequences->next('payable');
                    $payableId = (string) DB::table('fin_payables')->insertGetId([
                        'code' => $code,
                        'provider_id' => $day->provider_id,
                        'kind' => 'costo_adicional',
                        'cost_type' => 'penalidad_proveedor',
                        'concept' => mb_substr("Penalidad por no uso de cupo {$day->code} · {$free} unidad(es) del {$day->service_date}", 0, 255),
                        'amount' => (string) $amount,
                        'currency' => $day->currency,
                        'fx_rate' => $fx,
                        'due_date' => $this->today()->addDays(15)->toDateString(),
                        'status' => 'abierta',
                    ], 'id');
                    $audit->log('Cuenta por pagar', $code, 'registrar', null, "Cupo {$day->code} · {$day->currency} {$amount} · no uso");
                    $totals[$day->currency] = ($totals[$day->currency] ?? BigDecimal::zero()->toScale(2))->plus($amount);
                }

                DB::table('catalog_allotment_charges')->insert([
                    'allotment_day_id' => $day->id,
                    'qty' => $free,
                    'amount' => (string) $amount,
                    'currency' => $day->currency,
                    'fx_rate' => $fx,
                    'reason' => mb_substr("No uso de {$free} unidad(es) sin liberar del {$day->service_date}", 0, 200),
                    'payable_id' => $payableId,
                ]);
                DB::table('catalog_allotment_events')->insert([
                    'allotment_id' => $day->allotment_id,
                    'message' => mb_substr("Cargo por no uso: {$free} unidad(es) del {$day->service_date} · {$day->currency} {$amount} (JOB-10)", 0, 300),
                ]);
                $audit->log('Cupo', (string) $day->code, 'cargo_no_uso', null, "{$day->service_date} · {$free} unidad(es) · {$day->currency} {$amount}");
                $count++;
            }

            DB::table('catalog_allotment_days')->where('id', $day->id)->update(['closed_at' => now(), 'updated_at' => now()]);
        }

        return [$count, collect($totals)->map(fn (BigDecimal $total, string $currency): string => "{$currency} {$total}")->implode(' + ') ?: 'sin monto'];
    }

    private function settleStatus(string $today): void
    {
        DB::table('catalog_allotments as a')->where('a.status', 'en_release')->whereNull('a.deleted_at')
            ->whereNotExists(fn ($query) => $query->from('catalog_allotment_days as d')->whereColumn('d.allotment_id', 'a.id')
                ->whereNull('d.closed_at')->whereNull('d.retained_at')->where('d.service_date', '>=', $today)->where('d.release_deadline', '<=', $today)
                ->whereRaw('d.blocked_qty - d.released_qty - d.used_qty - d.pending_qty > 0'))
            ->update(['status' => 'activo', 'updated_at' => now()]);
    }
}
