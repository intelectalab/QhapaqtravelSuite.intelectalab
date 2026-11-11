<?php

declare(strict_types=1);

namespace App\Domain\Reports\Builders;

use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\ReportFilters;
use App\Domain\Reports\Support\ReportShape as S;
use Illuminate\Support\Carbon;

final class QuotesReport extends ReportBuilder
{
    private const STATUS = ['borrador' => 'Borrador', 'enviada' => 'Enviada', 'vista' => 'Vista', 'negociacion' => 'Negociación', 'aprobada' => 'Aprobada', 'rechazada' => 'Rechazada', 'vencida' => 'Vencida', 'convertida' => 'Convertida', 'cancelada' => 'Cancelada'];

    public function build(User $viewer, ReportFilters $filters): array
    {
        $quotes = $this->owned('quote_quotes', 'q', $viewer, $filters)
            ->leftJoin('quote_versions as v', 'v.id', '=', 'q.current_version_id')
            ->leftJoin('crm_clients as c', 'c.id', '=', 'q.client_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'q.owner_id')
            ->orderByDesc('q.created_at')
            ->get(['q.code', 'q.status', 'q.current_version_no', 'q.created_at', 'q.viewed_at', 'q.approved_at', 'q.valid_until', 'q.rejected_reason', 'q.opportunity_id', 'v.grand_total', 'v.fx_rate', 'v.margin_pct', 'c.name as client', 'u.name as seller']);
        $won = $quotes->whereIn('status', ['aprobada', 'convertida']);
        $decided = $quotes->whereIn('status', ['aprobada', 'convertida', 'rechazada', 'vencida']);
        $hours = $quotes->whereNotNull('viewed_at')->map(fn (object $row): float => max(0, Carbon::parse($row->created_at)->diffInMinutes(Carbon::parse($row->viewed_at)) / 60));
        $cycle = $won->whereNotNull('approved_at')->map(fn (object $row): float => max(0, Carbon::parse($row->created_at)->diffInHours(Carbon::parse($row->approved_at)) / 24));
        $value = $quotes->sum(fn (object $row): float => (float) $row->grand_total * (float) ($row->fx_rate ?: 1));
        $margins = $quotes->whereNotNull('margin_pct');
        $lost = $this->owned('crm_opportunities', 'o', $viewer, $filters)->where('o.stage', 'perdida')->whereNotIn('o.id', $quotes->where('status', 'rechazada')->pluck('opportunity_id')->filter())->pluck('o.lost_reason_code');
        $lostLabels = S::labels(['lost_reason']);
        $reasons = $quotes->where('status', 'rechazada')->map(fn (object $row): string => (string) $row->rejected_reason)
            ->merge($quotes->where('status', 'vencida')->map(fn (): string => 'Venció sin respuesta'))
            ->merge($lost->map(fn (?string $code): string => $lostLabels[$code] ?? ($code ?: 'Sin motivo')))
            ->countBy()->sortDesc()->take(8);
        $buckets = ['Menos de 1 h' => 1, '1 a 6 h' => 6, '6 a 24 h' => 24, '1 a 3 días' => 72, 'Más de 3 días' => PHP_INT_MAX];
        $opened = collect($buckets)->map(fn (int $limit, string $label) => 0)->all();

        foreach ($hours as $hour) {
            foreach ($buckets as $label => $limit) {
                if ($hour < $limit) {
                    $opened[$label]++;
                    break;
                }
            }
        }

        return [
            'kpis' => [
                S::kpi('issued', 'Cotizaciones emitidas', $quotes->count(), 'number', ((int) $quotes->sum('current_version_no')).' versiones'),
                S::kpi('approval', 'Tasa de aprobación', S::rate($won->count(), $decided->count()), 'percent', "{$won->count()} de {$decided->count()} decididas"),
                S::kpi('first_view', 'Tiempo a primera vista', $hours->isEmpty() ? null : round((float) $hours->avg(), 1), 'hours'),
                S::kpi('cycle', 'Ciclo hasta aprobación', $cycle->isEmpty() ? null : round((float) $cycle->avg(), 1), 'days'),
                S::kpi('value', 'Valor cotizado', round($value, 2), 'money', $margins->isEmpty() ? null : 'Margen medio '.round((float) $margins->avg('margin_pct'), 1).' %'),
            ],
            'charts' => [
                S::chart('status', 'Cotizaciones por estado', 'donut', $quotes->countBy('status')->map(fn (int $count, string $status): array => S::point(self::STATUS[$status] ?? $status, $count))->all()),
                S::chart('reasons', 'Motivos de rechazo y pérdida', 'hbar', $reasons->map(fn (int $count, string $reason): array => S::point($reason, $count))->all()),
                S::chart('opened', 'Horas hasta la primera apertura', 'bar', collect($opened)->map(fn (int $count, string $label): array => S::point($label, $count))->all()),
            ],
            'table' => S::table([
                S::column('code', 'Cotización'),
                S::column('client', 'Cliente'),
                S::column('seller', 'Vendedor'),
                S::column('status', 'Estado', 'status'),
                S::column('versions', 'Vers.', 'number'),
                S::column('total', 'Total S/', 'money'),
                S::column('margin', 'Margen', 'percent', ['warn_below' => 15]),
                S::column('viewed_at', 'Vista en', 'datetime'),
                S::column('valid_until', 'Vence', 'date'),
            ], $quotes->map(fn (object $row): array => [
                'code' => $row->code,
                'client' => $row->client,
                'seller' => $row->seller,
                'status' => self::STATUS[$row->status] ?? $row->status,
                'status_key' => $row->status,
                'versions' => (int) $row->current_version_no,
                'total' => round((float) $row->grand_total * (float) ($row->fx_rate ?: 1), 2),
                'margin' => $row->margin_pct === null ? null : round((float) $row->margin_pct, 1),
                'viewed_at' => $row->viewed_at,
                'valid_until' => $row->valid_until,
            ])->all(), null, '/cotizaciones/{code}'),
        ];
    }
}
