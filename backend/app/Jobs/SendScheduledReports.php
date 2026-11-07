<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Reports\Support\ReportExports;
use App\Domain\Reports\Support\ReportFormat;
use App\Domain\Reports\Support\WeeklyManagementReport;
use App\Domain\Reports\Support\WeeklyReportFiles;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class SendScheduledReports extends TenantJob
{
    public const QUEUE = 'reports';

    public const REPORT_KEY = 'gerencia_semanal';

    public const ROLES = ['tenant_admin', 'manager'];

    private const FORMATS = [
        'PDF' => ['extension' => 'pdf', 'mime' => 'application/pdf'],
        'XLSX' => ['extension' => 'xlsx', 'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ];

    protected function run(): string
    {
        $report = app(WeeklyManagementReport::class)->build($this->today());
        $from = $report['period']['from'];

        if ($this->trigger !== 'manual' && DB::table('report_exports')->where('report_key', self::REPORT_KEY)->where('idempotency_key', "gerencia:{$from}:PDF")->where('status', 'disponible')->exists()) {
            return "El reporte de la semana del {$report['period']['label']} ya se envió";
        }

        $recipients = $this->recipients();

        if ($recipients->isEmpty()) {
            return $this->warn('Sin destinatarios: no hay usuarios activos de administración o gerencia con correo');
        }

        $files = app(WeeklyReportFiles::class);
        $tenant = (string) app(TenantContext::class)->idOrFail();
        $attachments = [];
        $codes = [];
        $ids = [];

        foreach (self::FORMATS as $format => $meta) {
            $content = $format === 'PDF' ? $files->pdf($report) : $files->xlsx($report);
            $code = ReportExports::nextCode();
            $name = "Reporte-gerencia-{$from}.{$meta['extension']}";
            $path = "exports/{$tenant}/{$code}-gerencia-{$from}.{$meta['extension']}";
            Storage::disk('local')->put($path, $content);
            $ids[] = $id = (string) Str::uuid7();
            DB::table('report_exports')->insert([
                'id' => $id,
                'code' => $code,
                'report_name' => 'Reporte semanal de gerencia',
                'report_key' => self::REPORT_KEY,
                'filters' => json_encode(['from' => $from, 'to' => $report['period']['to']]),
                'scope' => 'detailed',
                'format' => $format,
                'rows_count' => count($report['upcoming']) + count($report['channels']) + count($report['advisors']),
                'size_bytes' => strlen($content),
                'file_path' => $path,
                'status' => 'disponible',
                'requested_by' => null,
                'scheduled_job_id' => $this->scheduledJobId,
                'idempotency_key' => $this->trigger === 'manual' ? null : "gerencia:{$from}:{$format}",
                'expires_at' => CarbonImmutable::now()->addDays(ReportExports::DAYS_AVAILABLE),
                'finished_at' => now(),
            ]);
            $attachments[] = ['disk' => 'local', 'path' => $path, 'name' => $name, 'mime' => $meta['mime']];
            $codes[] = $code;
        }

        $subject = "Reporte semanal de gerencia · {$report['agency']['name']} · {$report['period']['label']}";
        $sales = collect($report['kpis'])->firstWhere('label', 'Ventas');
        $body = "Hola:\n\nTe enviamos el reporte de gerencia de la semana del {$report['period']['label']}, en PDF y en Excel.\n\nVentas de la semana: ".ReportFormat::value($sales).' ('.ReportFormat::change($sales).").\nPor cobrar: ".ReportFormat::money($report['collection']['open']).', de los que '.ReportFormat::money($report['collection']['overdue'])." están vencidos.\n\nLos archivos también quedan en Reportes por ".ReportExports::DAYS_AVAILABLE." días.\n\n{$report['agency']['name']}";

        foreach ($recipients as $user) {
            dispatch(new SendReportMail((string) $user->email, (string) $user->name, $subject, $body, $attachments))->afterCommit();
            app(NotificationLog::class)->record([
                'event_code' => 'reporte.programado',
                'channel' => 'portal',
                'recipient_user_id' => $user->id,
                'subject' => 'Tu reporte semanal de gerencia está listo',
                'body_rendered' => "Semana del {$report['period']['label']}. PDF y Excel enviados a tu correo.",
                'source_type' => 'Exportación',
                'source_id' => $ids[0],
            ]);
        }

        app(AuditLogger::class)->log('Exportación', $codes[0], 'enviar_reporte_programado', null, 'Reporte semanal de gerencia · '.self::plural($recipients->count(), 'destinatario', 'destinatarios'));

        return 'Reporte de la semana del '.$report['period']['label'].' enviado a '.self::plural($recipients->count(), 'persona', 'personas').' (PDF y Excel)';
    }

    private function recipients(): Collection
    {
        return DB::table('iam_users as u')->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')->join('roles as r', 'r.id', '=', 'mr.role_id')
            ->whereIn('r.name', self::ROLES)->where('u.status', 'activo')->whereNull('u.deleted_at')->whereNotNull('u.email')
            ->orderBy('u.name')->distinct()->get(['u.id', 'u.name', 'u.email']);
    }
}
