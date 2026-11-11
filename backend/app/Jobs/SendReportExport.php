<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Iam\Models\User;
use App\Domain\Reports\Actions\ExportReport;
use App\Domain\Reports\Support\ReportExports;
use App\Domain\Reports\Support\ReportFile;
use App\Domain\Reports\Support\ReportTabs;
use Illuminate\Support\Facades\DB;

final class SendReportExport extends TenantJob
{
    public const QUEUE = 'reports';

    protected function run(): string
    {
        $job = DB::table('sys_scheduled_jobs')->where('id', $this->scheduledJobId)->first(['code', 'report_key', 'report_format', 'recipients', 'owner_user_id']);

        if ($job === null || $job->report_key === null) {
            return $this->warn('El envío programado ya no existe');
        }

        $owner = User::query()->whereKey($job->owner_user_id)->where('status', 'activo')->whereNull('deleted_at')->first();

        if ($owner === null) {
            return $this->warn('Quien programó el envío ya no está activo');
        }

        $settings = json_decode((string) $job->recipients, true) ?: [];
        $emails = array_values(array_filter((array) ($settings['emails'] ?? [])));

        if ($emails === []) {
            return $this->warn('Sin destinatarios');
        }

        $format = (string) ($job->report_format ?: 'PDF');
        $export = app(ExportReport::class)($owner, (string) $job->report_key, $settings['period'] ?? 'month', $settings['sede'] ?? null, $format, 'detailed', null, $this->scheduledJobId);
        $meta = ReportFile::FORMATS[$format];
        $title = ReportTabs::TITLES[$job->report_key] ?? $job->report_key;
        $attachment = [['disk' => 'local', 'path' => $export['path'], 'name' => "{$export['code']}-{$job->report_key}.{$meta['extension']}", 'mime' => $meta['mime']]];
        $body = "Hola:\n\nTe enviamos el reporte {$title} ({$export['name']}), con {$export['rows']} filas en {$format}.\n\nEl archivo también queda en Reportes por ".ReportExports::DAYS_AVAILABLE." días.\n\nKipuControl";

        foreach ($emails as $email) {
            dispatch(new SendReportMail($email, null, "Reporte {$title} · {$export['name']}", $body, $attachment))->afterCommit();
        }

        return "Reporte {$title} enviado a ".self::plural(count($emails), 'destinatario', 'destinatarios')." ({$format})";
    }
}
