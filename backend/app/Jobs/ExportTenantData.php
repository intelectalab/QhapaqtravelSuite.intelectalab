<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\IntegrationErrors;
use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Admin\Support\TenantDataExport;
use App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext;
use App\Domain\Shared\Tenancy\Jobs\TenantAware;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class ExportTenantData implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use TenantAware;

    public int $tries = 3;

    public int $timeout = 900;

    public function __construct(public readonly string $exportId)
    {
        $this->onQueue('reports');
    }

    public function middleware(): array
    {
        return [new RestoreTenantContext];
    }

    public function handle(TenantDataExport $export, StaffNotices $notices): void
    {
        $row = DB::table('report_exports')->where('id', $this->exportId)->lockForUpdate()->first(['id', 'code', 'status', 'requested_by', 'expires_at']);

        if ($row === null || ! in_array($row->status, ['en_cola', 'procesando'], true)) {
            return;
        }

        DB::table('report_exports')->where('id', $row->id)->update(['status' => 'procesando']);
        $file = $export->build();
        $path = 'exports/'.$this->tenantId.'/'.$row->code.'-'.TenantDataExport::REPORT_KEY.'.xlsx';
        Storage::disk('local')->put($path, $file['content']);
        DB::table('report_exports')->where('id', $row->id)->update([
            'status' => 'disponible',
            'rows_count' => $file['rows'],
            'size_bytes' => strlen($file['content']),
            'file_path' => $path,
            'finished_at' => now(),
        ]);

        $until = substr((string) $row->expires_at, 8, 2).'/'.substr((string) $row->expires_at, 5, 2).'/'.substr((string) $row->expires_at, 0, 4);
        $body = number_format($file['rows'], 0, ',', ' ')." registros en Excel, una hoja por módulo. Disponible en Reportes › Exportaciones hasta el {$until}.";
        $notices->toUser($row->requested_by ? (string) $row->requested_by : null, 'exportacion.lista', "Tu exportación completa {$row->code} está lista", $body, 'Exportación', (string) $row->id);
        $notices->emailUser($row->requested_by ? (string) $row->requested_by : null, 'exportacion.lista', "Tu exportación completa {$row->code} está lista", "Hola:\n\n{$body}\n\n{$notices->agency()}", 'Exportación', (string) $row->id);
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

        IntegrationErrors::record($this->tenantId, 'job', (string) ($code ?? 'EXP'), 'Exportación completa de datos', IntegrationErrors::describe($e), $this->tries, $this->tries);
    }
}
