<?php

declare(strict_types=1);

namespace App\Domain\Reports\Actions;

use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\ReportBranding;
use App\Domain\Reports\Support\ReportCatalog;
use App\Domain\Reports\Support\ReportExports;
use App\Domain\Reports\Support\ReportFile;
use App\Domain\Reports\Support\ReportFilters;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class ExportReport
{
    public function __construct(
        private readonly ReportCatalog $catalog,
        private readonly ReportFile $files,
        private readonly AuditLogger $audit,
        private readonly NotificationLog $notifications,
        private readonly TenantContext $context,
    ) {}

    public function __invoke(User $actor, string $report, ?string $period, ?string $sede, string $format, string $scope, ?string $idempotencyKey = null, ?string $scheduledJobId = null): array
    {
        if (! $actor->can('reports.export')) {
            $this->audit->logOutsideTransaction('Exportación', $report, 'exportar_denegado', null, 'Requiere permiso reports.export');

            throw ApiException::forbidden('REP-BR-05', 'Exportar reportes requiere el permiso reports.export.');
        }

        $data = $this->catalog->build($actor, $report, $period, $sede);
        $agency = ReportBranding::for($this->context->tenant());
        $content = $this->files->make($format, $data, $agency);
        $label = ReportFilters::PERIODS[$data['filters']['period']];
        $name = "{$data['title']} · {$label}".($data['filters']['sede'] ? " · {$data['filters']['sede']['name']}" : '');

        return DB::transaction(function () use ($actor, $report, $format, $scope, $idempotencyKey, $scheduledJobId, $data, $content, $name): array {
            $id = (string) Str::uuid7();
            $code = ReportExports::nextCode();
            $extension = ReportFile::FORMATS[$format]['extension'];
            $path = "exports/{$this->context->idOrFail()}/{$code}-{$report}.{$extension}";
            Storage::disk('local')->put($path, $content);
            DB::table('report_exports')->insert([
                'id' => $id,
                'code' => $code,
                'report_name' => mb_substr($name, 0, 200),
                'report_key' => $report,
                'filters' => json_encode(['period' => $data['filters']['period'], 'sede' => $data['filters']['sede']['id'] ?? null], JSON_UNESCAPED_UNICODE),
                'scope' => $scope,
                'format' => $format,
                'rows_count' => count($data['table']['rows']),
                'size_bytes' => strlen($content),
                'file_path' => $path,
                'status' => 'disponible',
                'requested_by' => $scheduledJobId ? null : $actor->getKey(),
                'scheduled_job_id' => $scheduledJobId,
                'idempotency_key' => $idempotencyKey === null ? null : mb_substr($idempotencyKey, 0, 80),
                'expires_at' => now()->addDays(ReportExports::DAYS_AVAILABLE),
                'finished_at' => now(),
                'created_by' => $actor->getKey(),
            ]);

            if ($scheduledJobId === null) {
                $this->notifications->record([
                    'event_code' => 'exportacion.lista',
                    'channel' => 'portal',
                    'recipient_user_id' => $actor->getKey(),
                    'subject' => "Tu exportación {$code} está lista",
                    'body_rendered' => "{$name}. ".count($data['table']['rows'])." filas en {$format}. Disponible por ".ReportExports::DAYS_AVAILABLE.' días.',
                    'source_type' => 'Exportación',
                    'source_id' => $id,
                    'created_by' => $actor->getKey(),
                ]);
            }

            $this->audit->log('Exportación', $code, 'exportar', null, "{$name} · {$format} · ".count($data['table']['rows']).' filas');

            return ['id' => $id, 'export_id' => $id, 'code' => $code, 'name' => $name, 'status' => 'disponible', 'format' => $format, 'rows' => count($data['table']['rows']), 'path' => $path];
        });
    }
}
