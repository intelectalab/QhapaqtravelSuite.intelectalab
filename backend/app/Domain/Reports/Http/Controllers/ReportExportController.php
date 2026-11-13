<?php

declare(strict_types=1);

namespace App\Domain\Reports\Http\Controllers;

use App\Domain\Crm\Support\CrmExports;
use App\Domain\Iam\Models\User;
use App\Domain\Reports\Actions\ExportReport;
use App\Domain\Reports\Actions\ScheduleReport;
use App\Domain\Reports\Support\ReportFile;
use App\Domain\Reports\Support\ReportFilters;
use App\Domain\Reports\Support\ReportTabs;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Http\Middleware\IdempotencyMiddleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class ReportExportController
{
    public function index(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $keys = [...array_column(ReportTabs::for($user), 'key'), ...CrmExports::keysFor($user)];
        $exports = DB::table('report_exports')->whereIn('report_key', $keys)->where(fn ($query) => $query->where('requested_by', $user->getKey())->orWhere('created_by', $user->getKey()))
            ->orderByDesc('created_at')->limit(15)
            ->get(['id', 'code', 'report_name', 'report_key', 'format', 'scope', 'rows_count', 'size_bytes', 'status', 'scheduled_job_id', 'expires_at', 'created_at']);
        $schedules = DB::table('sys_scheduled_jobs as j')->leftJoin('iam_users as u', 'u.id', '=', 'j.owner_user_id')->whereIn('j.report_key', $keys)
            ->when(! $user->can('admin.settings.manage'), fn ($query) => $query->where('j.owner_user_id', $user->getKey()))
            ->orderBy('j.code')->get(['j.code', 'j.name', 'j.report_key', 'j.report_format', 'j.cron_label', 'j.recipients', 'j.paused', 'j.last_run_at', 'j.last_status', 'u.name as owner']);

        return response()->json([
            'data' => $exports->map(fn (object $row): array => [
                'id' => $row->id,
                'code' => $row->code,
                'name' => $row->report_name,
                'report' => $row->report_key,
                'format' => $row->format,
                'rows' => $row->rows_count === null ? null : (int) $row->rows_count,
                'size' => $row->size_bytes === null ? null : (int) $row->size_bytes,
                'status' => $row->status === 'disponible' && $row->expires_at !== null && $row->expires_at < now() ? 'expirado' : $row->status,
                'scheduled' => $row->scheduled_job_id !== null,
                'expires_at' => $row->expires_at,
                'created_at' => $row->created_at,
            ])->values(),
            'meta' => [
                'schedules' => $schedules->map(function (object $row): array {
                    $settings = json_decode((string) $row->recipients, true) ?: [];

                    return [
                        'code' => $row->code,
                        'report' => $row->report_key,
                        'title' => ReportTabs::TITLES[$row->report_key] ?? $row->report_key,
                        'format' => $row->report_format,
                        'label' => $row->cron_label,
                        'recipients' => array_values((array) ($settings['emails'] ?? [])),
                        'period' => ReportFilters::PERIODS[$settings['period'] ?? 'month'] ?? null,
                        'paused' => (bool) $row->paused,
                        'last_run_at' => $row->last_run_at,
                        'last_status' => $row->last_status,
                        'owner' => $row->owner,
                    ];
                })->values(),
                'can_export' => $user->can('reports.export'),
                'tabs' => ReportTabs::for($user),
                'periods' => collect(ReportFilters::PERIODS)->map(fn (string $label, string $key): array => ['key' => $key, 'label' => $label])->values(),
                'frequencies' => collect(ScheduleReport::FREQUENCIES)->map(fn (string $label, string $key): array => ['key' => $key, 'label' => $label])->values(),
            ],
        ]);
    }

    public function store(Request $request, ExportReport $export): JsonResponse
    {
        $data = $request->validate([
            'report_key' => ['required', 'in:'.implode(',', array_keys(ReportTabs::TITLES))],
            'format' => ['required', 'in:CSV,XLSX,PDF'],
            'scope' => ['nullable', 'in:filtered,detailed'],
            'filters' => ['nullable', 'array'],
            'filters.period' => ['nullable', 'string', 'max:10'],
            'filters.sede' => ['nullable', 'string', 'max:40'],
        ], ['report_key.*' => 'Elige un reporte.', 'format.*' => 'El formato es CSV, XLSX o PDF.']);
        $result = $export($this->user($request), $data['report_key'], $data['filters']['period'] ?? null, $data['filters']['sede'] ?? null, $data['format'], $data['scope'] ?? 'filtered', $request->header(IdempotencyMiddleware::HEADER));
        unset($result['path']);

        return response()->json(['data' => $result], 202);
    }

    public function download(Request $request, string $id, AuditLogger $audit): StreamedResponse
    {
        $user = $this->user($request);
        $row = DB::table('report_exports')->where(Str::isUuid($id) ? 'id' : 'code', $id)->first(['id', 'code', 'report_key', 'format', 'file_path', 'status', 'expires_at', 'requested_by', 'created_by']);

        if ($row === null || ! in_array($user->getKey(), [$row->requested_by, $row->created_by], true) || ! in_array($row->report_key, [...array_column(ReportTabs::for($user), 'key'), ...CrmExports::keysFor($user)], true)) {
            throw ApiException::notFound('La exportación no existe.');
        }

        if ($row->status !== 'disponible' || ($row->expires_at !== null && $row->expires_at < now())) {
            throw new ApiException(410, 'GONE', 'EXPORT_EXPIRED', 'La exportación ya no está disponible. Vuelve a generarla.');
        }

        if (! $row->file_path || ! Storage::disk('local')->exists($row->file_path)) {
            throw ApiException::notFound('El archivo de la exportación no existe.');
        }

        $audit->log('Exportación', (string) $row->code, 'descargar', null, (string) $row->format);
        $meta = ReportFile::FORMATS[$row->format] ?? ReportFile::FORMATS['CSV'];

        return Storage::disk('local')->download($row->file_path, "{$row->code}-{$row->report_key}.{$meta['extension']}", ['Content-Type' => $meta['mime']]);
    }

    public function schedule(Request $request, ScheduleReport $schedule): JsonResponse
    {
        $data = $request->validate([
            'report_key' => ['required', 'in:'.implode(',', array_keys(ReportTabs::TITLES))],
            'frequency' => ['required', 'in:'.implode(',', array_keys(ScheduleReport::FREQUENCIES))],
            'time' => ['required', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'format' => ['required', 'in:CSV,XLSX,PDF'],
            'recipients' => ['required', 'array', 'min:1', 'max:10'],
            'recipients.*' => ['required', 'email', 'max:150'],
            'period' => ['nullable', 'in:'.implode(',', array_keys(ReportFilters::PERIODS))],
            'sede' => ['nullable', 'string', 'max:40'],
        ], [
            'report_key.*' => 'Elige un reporte.',
            'frequency.*' => 'Elige la frecuencia: diaria, semanal o mensual.',
            'time.*' => 'La hora va como HH:MM.',
            'format.*' => 'El formato es CSV, XLSX o PDF.',
            'recipients.*' => 'Agrega entre 1 y 10 correos válidos.',
            'recipients.*.*' => 'Revisa los correos de los destinatarios.',
        ]);

        return response()->json(['data' => $schedule($this->user($request), $data)], 201);
    }

    public function updateSchedule(Request $request, string $id, ScheduleReport $schedule): JsonResponse
    {
        $data = $request->validate([
            'frequency' => ['required', 'in:'.implode(',', array_keys(ScheduleReport::FREQUENCIES))],
            'time' => ['required', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'format' => ['required', 'in:CSV,XLSX,PDF'],
            'recipients' => ['required', 'array', 'min:1', 'max:10'],
            'recipients.*' => ['required', 'email', 'max:150'],
            'period' => ['nullable', 'in:'.implode(',', array_keys(ReportFilters::PERIODS))],
            'sede' => ['nullable', 'string', 'max:40'],
        ], [
            'frequency.*' => 'Elige la frecuencia: diaria, semanal o mensual.',
            'time.*' => 'La hora va como HH:MM.',
            'format.*' => 'El formato es CSV, XLSX o PDF.',
            'recipients.*' => 'Agrega entre 1 y 10 correos válidos.',
            'recipients.*.*' => 'Revisa los correos de los destinatarios.',
        ]);

        return response()->json(['data' => $schedule->update($this->user($request), $id, $data)]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
