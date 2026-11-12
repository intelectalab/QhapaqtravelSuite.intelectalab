<?php

declare(strict_types=1);

namespace App\Domain\Reports\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\ReportTabs;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Jobs\SendReportExport;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ScheduleReport
{
    public const FREQUENCIES = ['daily' => 'Diario', 'weekly' => 'Semanal (lunes)', 'monthly' => 'Mensual (día 1)'];

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public function __invoke(User $actor, array $data): array
    {
        if (! $actor->can('reports.export')) {
            $this->audit->logOutsideTransaction('Exportación', $data['report_key'], 'exportar_denegado', null, 'Programar envío requiere reports.export');

            throw ApiException::forbidden('REP-BR-05', 'Programar envíos requiere el permiso reports.export.');
        }

        ReportTabs::assert($actor, $data['report_key']);
        [$hour, $minute] = array_map('intval', explode(':', $data['time']));
        $cron = match ($data['frequency']) {
            'daily' => "{$minute} {$hour} * * *",
            'weekly' => "{$minute} {$hour} * * 1",
            default => "{$minute} {$hour} 1 * *",
        };
        $label = mb_strtolower(self::FREQUENCIES[$data['frequency']]).' '.str_pad((string) $hour, 2, '0', STR_PAD_LEFT).':'.str_pad((string) $minute, 2, '0', STR_PAD_LEFT);
        $title = ReportTabs::TITLES[$data['report_key']];
        $recipients = array_values(array_unique(array_map(fn (string $email): string => Str::lower(trim($email)), $data['recipients'])));

        $code = DB::transaction(function () use ($actor, $data, $cron, $label, $title, $recipients): string {
            DB::select('select pg_advisory_xact_lock(hashtext(?))', ['sys_scheduled_jobs:report']);
            $next = (int) DB::table('sys_scheduled_jobs')->where('code', 'like', 'REP-%')->selectRaw("coalesce(max(nullif(substring(code from '(\\d+)$'), '')::int), 0) as last")->value('last') + 1;
            $code = 'REP-'.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
            DB::table('sys_scheduled_jobs')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->context->idOrFail(),
                'code' => $code,
                'name' => "Envío del reporte {$title}",
                'job_class' => SendReportExport::class,
                'cron' => $cron,
                'cron_label' => $label,
                'queue' => SendReportExport::QUEUE,
                'paused' => false,
                'report_key' => $data['report_key'],
                'report_format' => $data['format'],
                'recipients' => json_encode(['emails' => $recipients, 'period' => $data['period'] ?? 'month', 'sede' => $data['sede'] ?? null], JSON_UNESCAPED_UNICODE),
                'owner_user_id' => $actor->getKey(),
                'is_system' => false,
                'created_by' => $actor->getKey(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $code;
        });

        $this->audit->log('Proceso programado', $code, 'programar_envio', null, "Reporte {$title} · {$label} · {$data['format']} · ".count($recipients).' destinatarios');

        return ['code' => $code, 'cron' => $cron, 'label' => $label];
    }

    public function update(User $actor, string $code, array $data): array
    {
        $job = DB::table('sys_scheduled_jobs')->where('code', $code)->where('is_system', false)->where('job_class', SendReportExport::class)->first() ?? throw ApiException::notFound('El envío programado no existe.');

        if (! $actor->can('reports.export')) {
            throw ApiException::forbidden('REP-BR-05', 'Editar envíos requiere el permiso reports.export.');
        }

        [$hour, $minute] = array_map('intval', explode(':', $data['time']));
        $cron = match ($data['frequency']) {
            'daily' => "{$minute} {$hour} * * *",
            'weekly' => "{$minute} {$hour} * * 1",
            default => "{$minute} {$hour} 1 * *",
        };
        $label = mb_strtolower(self::FREQUENCIES[$data['frequency']]).' '.str_pad((string) $hour, 2, '0', STR_PAD_LEFT).':'.str_pad((string) $minute, 2, '0', STR_PAD_LEFT);
        $recipients = array_values(array_unique(array_map(fn (string $email): string => Str::lower(trim($email)), $data['recipients'])));
        $previous = (array) json_decode((string) $job->recipients, true);
        DB::table('sys_scheduled_jobs')->where('id', $job->id)->update([
            'cron' => $cron,
            'cron_label' => $label,
            'report_format' => $data['format'],
            'recipients' => json_encode(['emails' => $recipients, 'period' => $data['period'] ?? ($previous['period'] ?? 'month'), 'sede' => $data['sede'] ?? ($previous['sede'] ?? null)], JSON_UNESCAPED_UNICODE),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->audit->log('Proceso programado', $code, 'editar_envio', "{$job->cron_label} · {$job->report_format}", "{$label} · {$data['format']} · ".count($recipients).' destinatarios');

        return ['code' => $code, 'cron' => $cron, 'label' => $label];
    }
}
