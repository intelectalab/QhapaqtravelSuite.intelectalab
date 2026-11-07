<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class PlatformHome
{
    private const CONNECTION = 'pgsql_platform';

    private const METRIC_LABELS = ['users' => 'usuarios', 'sedes' => 'sedes', 'storage_gb' => 'almacenamiento', 'reservations_month' => 'reservas del mes', 'whatsapp_month' => 'mensajes de WhatsApp', 'email_month' => 'correos', 'api_calls_month' => 'llamadas a la API'];

    public function __construct(
        private readonly BillingMetrics $metrics,
        private readonly BillingDirectory $billing,
        private readonly PlatformAudit $audit,
    ) {}

    public function overview(): array
    {
        $live = $this->metrics->snapshot();
        $series = $this->metrics->series($live);
        $previous = $series->slice(-2, 1)->first();
        $status = $this->db()->table('tenants')->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $plans = $this->db()->table('plans as p')->leftJoin('tenants as t', 't.plan_id', '=', 'p.id')->groupBy('p.code', 'p.name', 'p.rank')->orderBy('p.rank')
            ->selectRaw('p.code, p.name, p.rank, count(t.id) as tenants')->get();

        return [
            'tenants' => [
                'active' => (int) ($status['activo'] ?? 0),
                'trial' => (int) ($status['prueba'] ?? 0),
                'suspended' => (int) ($status['suspendido'] ?? 0),
                'total' => (int) $status->sum(),
                'users' => $this->db()->table('iam_users')->whereNotNull('tenant_id')->whereNull('deleted_at')->where('status', 'activo')->count(),
            ],
            'mrr' => $live['mrr'],
            'arr' => $live['arr'],
            'arpa' => $live['arpa'],
            'mrr_change' => $previous && $previous['mrr'] > 0 ? round(($live['mrr'] - $previous['mrr']) / $previous['mrr'] * 100, 1) : null,
            'series' => $series->map(fn (array $point) => ['month' => $point['month'], 'mrr' => $point['mrr']])->values(),
            'failed' => $this->metrics->failed(),
            'plans' => $plans->map(fn (object $plan) => ['code' => $plan->code, 'name' => $plan->name, 'rank' => (int) $plan->rank, 'tenants' => (int) $plan->tenants])->values(),
            'alerts' => $this->alerts(),
            'activity' => $this->audit->recent(6)->values(),
        ];
    }

    public function alerts(): Collection
    {
        $today = Carbon::today('America/Lima');
        $alerts = collect();

        $dunning = $this->db()->table('platform_invoices as i')->join('tenants as t', 't.id', '=', 'i.tenant_id')->where('i.status', 'failed')->get(['t.commercial_name', 'i.total', 'i.dunning_next_retry_at']);
        foreach ($dunning as $row) {
            $alerts->push(['tone' => 'bad', 'kind' => 'cobranza', 'title' => "Cobro fallido de {$row->commercial_name}", 'detail' => 'S/ '.number_format((float) $row->total, 0, '.', ' ').($row->dunning_next_retry_at ? ' · próximo reintento el '.Carbon::parse($row->dunning_next_retry_at)->timezone('America/Lima')->format('d/m H:i') : ''), 'href' => '/plataforma/facturacion/cobranza']);
        }

        $uncollectible = $this->db()->table('platform_invoices')->where('status', 'uncollectible')->selectRaw('count(*) as total, coalesce(sum(total), 0) as amount')->first();
        if ((int) $uncollectible->total > 0) {
            $alerts->push(['tone' => 'bad', 'kind' => 'cobranza', 'title' => "{$uncollectible->total} ".((int) $uncollectible->total === 1 ? 'factura incobrable' : 'facturas incobrables'), 'detail' => 'S/ '.number_format((float) $uncollectible->amount, 0, '.', ' ').' sin recuperar tras agotar los reintentos', 'href' => '/plataforma/facturacion/cobranza']);
        }

        foreach ($this->db()->table('subscriptions as s')->join('tenants as t', 't.id', '=', 's.tenant_id')->where('s.status', 'trialing')->where('s.trial_ends_at', '<=', $today->copy()->addDays(7))->get(['t.commercial_name', 's.trial_ends_at']) as $row) {
            $days = (int) $today->diffInDays(Carbon::parse($row->trial_ends_at, 'America/Lima'), false);
            $alerts->push(['tone' => 'warn', 'kind' => 'prueba', 'title' => "Prueba de {$row->commercial_name}", 'detail' => $days < 0 ? 'Venció hace '.abs($days).' días' : ($days === 0 ? 'Vence hoy' : "Vence en {$days} ".($days === 1 ? 'día' : 'días')), 'href' => '/plataforma/facturacion/trials']);
        }

        foreach ($this->db()->table('tenants')->where('status', 'suspendido')->get(['code', 'commercial_name', 'suspended_at']) as $row) {
            $alerts->push(['tone' => 'mute', 'kind' => 'suspendida', 'title' => "{$row->commercial_name} está suspendida", 'detail' => $row->suspended_at ? 'Desde el '.Carbon::parse($row->suspended_at)->timezone('America/Lima')->format('d/m/Y') : 'Sin fecha de suspensión', 'href' => "/plataforma/agencias/{$row->code}"]);
        }

        foreach ($this->db()->table('feature_overrides as o')->join('tenants as t', 't.id', '=', 'o.tenant_id')->join('features as f', 'f.key', '=', 'o.feature_key')->whereBetween('o.valid_until', [$today, $today->copy()->addDays(30)])->get(['t.commercial_name', 'f.label', 'o.valid_until']) as $row) {
            $alerts->push(['tone' => 'info', 'kind' => 'excepcion', 'title' => "Excepción por vencer: {$row->label}", 'detail' => "{$row->commercial_name} · hasta el ".Carbon::parse($row->valid_until)->format('d/m/Y'), 'href' => '/plataforma/facturacion/flags']);
        }

        foreach ($this->billing->usage()['items'] as $tenant) {
            $metric = $tenant['alert'];

            if ($metric !== null) {
                $alerts->push(['tone' => $metric['pct'] >= 100 ? 'bad' : 'warn', 'kind' => 'uso', 'title' => "{$tenant['name']} usa el {$metric['pct']} %", 'detail' => 'Del límite de '.(self::METRIC_LABELS[$metric['metric']] ?? $metric['metric'])." del plan {$tenant['plan']['name']}", 'href' => '/plataforma/facturacion/uso']);
            }
        }

        $jobs = $this->db()->table('sys_scheduled_jobs')->whereNull('tenant_id')->whereIn('last_status', ['error', 'advertencia'])->get(['name', 'last_status', 'last_result']);
        foreach ($jobs as $job) {
            $alerts->push(['tone' => $job->last_status === 'error' ? 'bad' : 'warn', 'kind' => 'tarea', 'title' => $job->name, 'detail' => (string) $job->last_result, 'href' => '/plataforma/integraciones']);
        }

        $definitive = $this->db()->table('integration_errors')->where('status', 'fallo_definitivo')->count();
        if ($definitive > 0) {
            $alerts->push(['tone' => 'warn', 'kind' => 'tarea', 'title' => "{$definitive} ".($definitive === 1 ? 'error definitivo' : 'errores definitivos').' en integraciones', 'detail' => 'Necesitan revisión manual de la agencia', 'href' => '/plataforma/integraciones']);
        }

        $order = ['bad' => 0, 'warn' => 1, 'info' => 2, 'mute' => 3];

        return $alerts->sortBy(fn (array $alert) => $order[$alert['tone']] ?? 9)->values();
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
