<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\IntegrationErrors;
use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Crm\Support\CrmExports;
use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\ReportBranding;
use App\Domain\Reports\Support\ReportExports;
use App\Domain\Reports\Support\ReportFile;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext;
use App\Domain\Shared\Tenancy\Jobs\TenantAware;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\PermissionRegistrar;
use Throwable;

final class BuildCrmExport implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use TenantAware;

    public int $tries = 3;

    public int $timeout = 600;

    public function __construct(public readonly string $exportId)
    {
        $this->onQueue('reports');
    }

    public function middleware(): array
    {
        return [new RestoreTenantContext];
    }

    public function handle(CrmExports $exports, ReportFile $files, StaffNotices $notices, AuditLogger $audit, TenantContext $context): void
    {
        $row = DB::table('report_exports')->where('id', $this->exportId)->lockForUpdate()->first(['id', 'code', 'report_key', 'report_name', 'format', 'filters', 'status', 'requested_by']);
        $resource = $row ? CrmExports::resourceFor((string) $row->report_key) : null;

        if ($row === null || $resource === null || ! in_array($row->status, ['en_cola', 'procesando'], true)) {
            return;
        }

        app(PermissionRegistrar::class)->setPermissionsTeamId($this->tenantId);
        $user = User::query()->whereKey($row->requested_by)->where('status', 'activo')->whereNull('deleted_at')->first();

        if ($user === null || ! CrmExports::allows($user, $resource)) {
            DB::table('report_exports')->where('id', $row->id)->update(['status' => 'fallido', 'finished_at' => now()]);

            return;
        }

        DB::table('report_exports')->where('id', $row->id)->update(['status' => 'procesando']);
        $filters = json_decode((string) $row->filters, true) ?: [];
        $document = $exports->document($user, $resource, $filters);
        $content = $files->make((string) $row->format, $document, ReportBranding::for($context->tenant()));
        $path = 'exports/'.$this->tenantId.'/'.$row->code.'-'.$row->report_key.'.'.ReportFile::FORMATS[$row->format]['extension'];
        $count = count($document['table']['rows']);
        Storage::disk('local')->put($path, $content);
        DB::table('report_exports')->where('id', $row->id)->update([
            'status' => 'disponible',
            'rows_count' => $count,
            'size_bytes' => strlen($content),
            'file_path' => $path,
            'finished_at' => now(),
        ]);

        $title = CrmExports::RESOURCES[$resource]['title'];
        $audit->log('Exportación', (string) $row->code, 'exportar', null, "{$count} filas · CRM {$title} · {$row->format}", ['resource' => $resource, 'filters' => $filters], actor: $user);
        $notices->toUser((string) $user->getKey(), 'exportacion.lista', "Tu exportación {$row->code} está lista", "CRM · {$title}: {$count} filas en {$row->format}. Disponible en Reportes, Exportaciones por ".ReportExports::DAYS_AVAILABLE.' días.', 'Exportación', (string) $row->id);
    }

    public function failed(Throwable $e): void
    {
        if ($this->tenantId === null) {
            return;
        }

        $code = app(TenantDatabase::class)->run($this->tenantId, function (): ?string {
            DB::table('report_exports')->where('id', $this->exportId)->whereIn('status', ['en_cola', 'procesando'])->update(['status' => 'fallido', 'finished_at' => now()]);

            return DB::table('report_exports')->where('id', $this->exportId)->value('code');
        });

        IntegrationErrors::record($this->tenantId, 'job', (string) ($code ?? 'EXP'), 'Exportación del CRM', IntegrationErrors::describe($e), $this->tries, $this->tries);
    }
}
