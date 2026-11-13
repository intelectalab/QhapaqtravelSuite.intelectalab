<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Crm\Support\CrmExports;
use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\ReportExports;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Jobs\BuildCrmExport;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RequestCrmExport
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function __invoke(User $actor, string $resource, array $filters, string $format): array
    {
        $meta = CrmExports::RESOURCES[$resource];

        if (! CrmExports::allows($actor, $resource)) {
            $this->audit->logOutsideTransaction('Exportación', $resource, 'exportar_denegado', null, 'Requiere permiso '.implode(' o ', $meta['permissions']));

            throw ApiException::forbidden('CRM-EXP-01', "Para exportar {$meta['title']} necesitas el permiso para verlos.", $meta['permissions']);
        }

        $filters = CrmExports::filters($resource, $filters);
        $tenantId = $this->context->idOrFail();
        $id = (string) Str::uuid7();

        $code = DB::transaction(function () use ($actor, $resource, $filters, $format, $meta, $tenantId, $id): string {
            $code = ReportExports::nextCode();
            DB::table('report_exports')->insert([
                'id' => $id,
                'code' => $code,
                'report_name' => mb_substr("CRM · {$meta['title']}".($filters === [] ? '' : ' · filtrado'), 0, 200),
                'report_key' => $meta['key'],
                'filters' => json_encode(['resource' => $resource, ...$filters], JSON_UNESCAPED_UNICODE),
                'scope' => $filters === [] ? 'detailed' : 'filtered',
                'format' => $format,
                'status' => 'en_cola',
                'requested_by' => $actor->getKey(),
                'expires_at' => now()->addDays(ReportExports::DAYS_AVAILABLE),
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Exportación', $code, 'solicitar', null, "CRM · {$meta['title']} · {$format} · en cola", ['resource' => $resource, 'filters' => $filters]);
            dispatch((new BuildCrmExport($id))->forTenant($tenantId))->afterCommit();

            return $code;
        });

        $row = DB::table('report_exports')->where('id', $id)->first(['status', 'rows_count', 'expires_at']);

        return [
            'id' => $id,
            'export_id' => $id,
            'code' => $code,
            'resource' => $resource,
            'name' => "CRM · {$meta['title']}",
            'format' => $format,
            'filters' => $filters,
            'status' => $row->status ?? 'en_cola',
            'rows' => $row?->rows_count === null ? null : (int) $row->rows_count,
            'expires_at' => $row->expires_at ?? null,
            'download_url' => "/api/v1/reports/exports/{$id}/download",
        ];
    }
}
