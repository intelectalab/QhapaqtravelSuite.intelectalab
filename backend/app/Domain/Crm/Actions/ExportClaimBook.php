<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Crm\Support\ClaimBookDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\ReportBranding;
use App\Domain\Reports\Support\ReportExports;
use App\Domain\Reports\Support\ReportFile;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class ExportClaimBook
{
    public const FORMATS = ['CSV', 'XLSX', 'PDF'];

    private const COLUMNS = [
        ['key' => 'book_number', 'label' => 'Número de hoja', 'format' => 'text'],
        ['key' => 'received_on', 'label' => 'Fecha de registro', 'format' => 'date'],
        ['key' => 'type', 'label' => 'Tipo', 'format' => 'text'],
        ['key' => 'sede', 'label' => 'Establecimiento', 'format' => 'text'],
        ['key' => 'channel', 'label' => 'Canal', 'format' => 'text'],
        ['key' => 'consumer', 'label' => 'Consumidor', 'format' => 'text'],
        ['key' => 'document', 'label' => 'Documento', 'format' => 'text'],
        ['key' => 'good', 'label' => 'Bien contratado', 'format' => 'text'],
        ['key' => 'status', 'label' => 'Estado', 'format' => 'text'],
        ['key' => 'due_date', 'label' => 'Plazo', 'format' => 'date'],
        ['key' => 'decision', 'label' => 'Decisión', 'format' => 'text'],
        ['key' => 'business_days', 'label' => 'Días hábiles a la respuesta', 'format' => 'number'],
        ['key' => 'deadline', 'label' => 'Cumplimiento', 'format' => 'text'],
    ];

    private const DEADLINES = ['respondido_en_plazo' => 'En plazo', 'respondido_fuera_de_plazo' => 'Fuera de plazo', 'vencido' => 'Vencido', 'por_vencer' => 'Por vencer', 'en_plazo' => 'En plazo'];

    public function __construct(
        private readonly ClaimBookDirectory $directory,
        private readonly ReportFile $files,
        private readonly AuditLogger $audit,
        private readonly NotificationLog $notifications,
        private readonly TenantContext $context,
    ) {}

    public function __invoke(int $year, string $format, User $actor, ?string $idempotencyKey): array
    {
        $report = $this->directory->report('month', $year);
        $rows = $this->directory->claims($this->directory->year($year))
            ->map(fn (array $claim): array => [
                'book_number' => $claim['book_number'],
                'received_on' => $claim['received_on'],
                'type' => $claim['type'],
                'sede' => $claim['sede'],
                'channel' => $claim['channel_label'],
                'consumer' => $claim['consumer']['name'],
                'document' => trim(strtoupper((string) $claim['consumer']['doc_type']).' '.($claim['consumer']['doc_number'] ?? '')),
                'good' => $claim['good']['description'] ?? null,
                'status' => $claim['book_status_label'],
                'due_date' => $claim['due_date'],
                'decision' => $claim['response']['decision'] ?? null,
                'business_days' => $claim['business_days_to_answer'],
                'deadline' => self::DEADLINES[$claim['deadline']] ?? $claim['deadline'],
            ])->values()->all();

        return DB::transaction(function () use ($year, $format, $actor, $idempotencyKey, $report, $rows): array {
            $id = (string) Str::uuid7();
            $code = ReportExports::nextCode();
            $content = $this->files->make($format, $this->document($year, $report, $rows), ReportBranding::for($this->context->tenant()));
            $path = "exports/{$this->context->idOrFail()}/{$code}-libro-reclamaciones.".ReportFile::FORMATS[$format]['extension'];
            Storage::disk('local')->put($path, $content);
            DB::table('report_exports')->insert([
                'id' => $id,
                'code' => $code,
                'report_name' => "Libro de Reclamaciones · relación {$year}",
                'report_key' => 'libro_reclamaciones',
                'filters' => json_encode(['year' => $year], JSON_UNESCAPED_UNICODE),
                'scope' => 'detailed',
                'format' => $format,
                'rows_count' => count($rows),
                'size_bytes' => strlen($content),
                'file_path' => $path,
                'status' => 'disponible',
                'requested_by' => $actor->getKey(),
                'idempotency_key' => $idempotencyKey === null ? null : mb_substr($idempotencyKey, 0, 80),
                'expires_at' => now()->addDays(ReportExports::DAYS_AVAILABLE),
                'finished_at' => now(),
                'created_by' => $actor->getKey(),
            ]);
            $this->notifications->record([
                'event_code' => 'exportacion.lista',
                'channel' => 'portal',
                'recipient_user_id' => $actor->getKey(),
                'subject' => "Tu exportación {$code} del Libro de Reclamaciones está lista",
                'body_rendered' => count($rows)." hojas de {$year} en {$format}. Disponible por ".ReportExports::DAYS_AVAILABLE.' días.',
                'source_type' => 'Exportación',
                'source_id' => $id,
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Exportación', $code, 'exportar', null, "Libro de Reclamaciones {$year} · ".count($rows)." hojas · {$format}");

            return ['id' => $id, 'export_id' => $id, 'code' => $code, 'status' => 'disponible', 'format' => $format, 'year' => $year, 'rows' => count($rows)];
        });
    }

    private function document(int $year, array $report, array $rows): array
    {
        return [
            'title' => "Libro de Reclamaciones · relación {$year}",
            'scope' => 'tenant',
            'filters' => ['from' => "{$year}-01-01", 'to' => "{$year}-12-31", 'label' => "Año {$year}", 'sede' => null],
            'kpis' => [
                ['label' => 'Hojas registradas', 'value' => $report['total'], 'format' => 'number', 'hint' => 'Reclamos y quejas del año'],
                ['label' => 'Pendientes', 'value' => $report['kpis']['open'], 'format' => 'number', 'hint' => 'Recibidas o en evaluación'],
                ['label' => 'Respuesta en plazo', 'value' => $report['kpis']['on_time_pct'] ?? 0, 'format' => 'percent', 'hint' => 'Sobre las hojas respondidas'],
            ],
            'table' => ['columns' => self::COLUMNS, 'rows' => $rows, 'totals' => null],
            'charts' => [],
        ];
    }
}
