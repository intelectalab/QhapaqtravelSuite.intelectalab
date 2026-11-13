<?php

declare(strict_types=1);

namespace App\Domain\Reports\Builders;

use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\ReportFilters;
use App\Domain\Reports\Support\ReportShape as S;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ProvidersReport extends ReportBuilder
{
    private const STATUS = ['activo' => 'Activo', 'inactivo' => 'Inactivo', 'vencido' => 'Contrato vencido'];

    public function build(User $viewer, ReportFilters $filters): array
    {
        $payables = $viewer->can('finance.payables');
        $services = $filters->sede(DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')->whereNull('r.deleted_at'), 'r.sede_id')
            ->whereBetween('s.service_date', [$filters->from->toDateString(), $filters->to->toDateString()])->where('s.status', '<>', 'cancelado')->whereNotNull('s.provider_id')
            ->get(['s.provider_id', 's.status', DB::raw(S::pen('s.cost_amount', 's.fx_rate').' as cost')]);
        $providers = DB::table('catalog_providers')->whereNull('deleted_at')->whereIn('id', $services->pluck('provider_id')->unique())->get(['id', 'name', 'type', 'rating', 'contract_end', 'status'])->keyBy('id');
        $due = $payables ? DB::table('fin_payables')->whereNull('deleted_at')->whereIn('provider_id', $providers->keys())->whereNotIn('status', ['pagada', 'cancelada'])->selectRaw('provider_id, sum('.S::pen('amount - paid_amount', 'fx_rate').') as due')->groupBy('provider_id')->pluck('due', 'provider_id') : collect();
        $limit = Carbon::now($filters->timezone)->addDays(60)->toDateString();
        $today = Carbon::now($filters->timezone)->toDateString();
        $expiring = DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')->whereBetween('contract_end', [$today, $limit])->count();
        $confirmed = fn ($rows): int => $rows->whereIn('status', ['confirmado', 'en_curso', 'completado'])->count();
        $rows = $services->groupBy('provider_id')->map(function ($group, string $id) use ($providers, $due, $payables, $confirmed): array {
            $provider = $providers[$id] ?? null;
            $row = [
                'name' => $provider->name ?? 'Proveedor eliminado',
                'type' => $provider->type ?? null,
                'services' => $group->count(),
                'cost' => round((float) $group->sum('cost'), 2),
                'confirmation' => S::rate($confirmed($group), $group->count()),
                'rating' => $provider?->rating === null ? null : round((float) $provider->rating, 1),
                'contract_end' => $provider->contract_end ?? null,
                'status' => self::STATUS[$provider->status ?? ''] ?? '—',
                'status_key' => $provider->status ?? null,
            ];

            return $payables ? [...$row, 'due' => round((float) ($due[$id] ?? 0), 2)] : $row;
        })->sortByDesc('cost')->values();
        $rated = $providers->whereNotNull('rating');
        $columns = [S::column('name', 'Proveedor'), S::column('type', 'Tipo', 'text', ['filter' => true]), S::column('services', 'Servicios', 'number'), S::column('cost', 'Costo', 'money'), S::column('confirmation', 'Confirmación', 'percent'), S::column('rating', 'Calificación', 'rating')];

        if ($payables) {
            $columns[] = S::column('due', 'Por pagar', 'money');
        }

        return [
            'kpis' => [
                S::kpi('providers', 'Proveedores utilizados', $providers->count()),
                S::kpi('services', 'Servicios', $services->count(), 'number', S::rate($confirmed($services), $services->count()) !== null ? S::rate($confirmed($services), $services->count()).' % confirmados' : null),
                S::kpi('cost', 'Costo de proveedores', round((float) $services->sum('cost'), 2), 'money'),
                S::kpi('rating', 'Calificación media', $rated->isEmpty() ? null : round((float) $rated->avg('rating'), 1), 'rating'),
                S::kpi('expiring', 'Contratos por vencer', $expiring, 'number', 'En los próximos 60 días'),
            ],
            'charts' => [
                S::chart('cost', 'Costo por proveedor', 'hbar', $rows->take(8)->map(fn (array $row): array => S::point($row['name'], $row['cost']))->all(), 'money'),
                S::chart('volume', 'Servicios por proveedor', 'hbar', $rows->sortByDesc('services')->take(8)->map(fn (array $row): array => S::point($row['name'], $row['services']))->values()->all()),
                S::chart('types', 'Costo por tipo', 'donut', $rows->groupBy(fn (array $row): string => (string) ($row['type'] ?: 'Sin tipo'))->map(fn ($group, string $type): array => S::point($type, round((float) $group->sum('cost'), 2)))->all(), 'money'),
            ],
            'table' => S::table([...$columns, S::column('contract_end', 'Contrato hasta', 'date'), S::column('status', 'Estado', 'status', ['filter' => true])], $rows->all()),
        ];
    }
}
