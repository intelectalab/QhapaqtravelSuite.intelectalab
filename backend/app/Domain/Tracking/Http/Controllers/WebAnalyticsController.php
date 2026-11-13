<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Http\Controllers;

use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Tracking\Support\AnalyticsScope;
use App\Domain\Tracking\Support\CookielessCounter;
use App\Domain\Tracking\Support\TagScope;
use App\Domain\Tracking\Support\TrackingPlan;
use App\Domain\Tracking\Support\WebAnalyticsReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class WebAnalyticsController
{
    public function __construct(private readonly WebAnalyticsReport $report, private readonly TrackingPlan $plan, private readonly TenantContext $context) {}

    public function overview(Request $request): JsonResponse
    {
        $data = $this->report->overview($this->scope(), $this->period($request));
        $ga4 = TagScope::tenant()->db()->table('mkt_tracking_tags')->where('provider', 'ga4')->where('status', 'activo')->whereNull('deleted_at')->value('measurement_id');

        return response()->json(['data' => [...$data, 'ga4' => $ga4 === null ? null : ['measurement_id' => $ga4, 'note' => 'Google Analytics cuenta solo a quien acepta cookies analíticas, por eso muestra menos visitas que este conteo sin cookies.'], 'can_export' => $this->plan->full()]]);
    }

    public function pages(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->report->pages($this->scope(), $this->period($request))]);
    }

    public function sources(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->report->sources($this->scope(), $this->period($request))]);
    }

    public function devices(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->report->devices($this->scope(), $this->period($request))]);
    }

    public function realtime(CookielessCounter $counter): JsonResponse
    {
        return response()->json(['data' => $counter->live($this->scope()->liveKey())]);
    }

    public function export(Request $request, AuditLogger $audit): Response
    {
        if (! $this->plan->full()) {
            throw ApiException::unprocessable('TRACKING_PLAN_REQUIRED', 'La exportación de visitas está disponible desde el plan Professional o con el complemento Marketing Pro.');
        }

        $period = $this->period($request);
        $rows = $this->report->daily($this->scope(), $period);
        $name = 'visitas-'.$period['from']->toDateString().'-a-'.$period['to']->toDateString().'.csv';
        $audit->log('Visitas', 'export', 'exportar', null, $rows->count().' días · '.$period['from']->toDateString().' a '.$period['to']->toDateString());

        $lines = ['fecha;visitas;visitantes;paginas_vistas;rebotes;segundos_con_interaccion;conversiones;ingresos'];

        foreach ($rows as $row) {
            $lines[] = implode(';', [substr((string) $row->day, 0, 10), (int) $row->visits, (int) $row->visitors, (int) $row->pageviews, (int) $row->bounces, (int) $row->engaged, (int) $row->conversions, number_format((float) $row->revenue, 2, '.', '')]);
        }

        return response("\xEF\xBB\xBF".implode("\r\n", $lines)."\r\n", 200, ['Content-Type' => 'text/csv; charset=UTF-8', 'Content-Disposition' => 'attachment; filename="'.$name.'"']);
    }

    private function period(Request $request): array
    {
        return WebAnalyticsReport::period($request->query(), $this->plan->retentionDays());
    }

    private function scope(): AnalyticsScope
    {
        return AnalyticsScope::tenant($this->context->idOrFail());
    }
}
