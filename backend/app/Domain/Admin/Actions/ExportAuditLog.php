<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Admin\Support\AuditDirectory;
use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\ReportBranding;
use App\Domain\Reports\Support\ReportExports;
use App\Domain\Reports\Support\ReportFile;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class ExportAuditLog
{
    public const MAX_ROWS = 50000;

    public const MAX_PDF_ROWS = 2000;

    public const FORMATS = ['CSV', 'XLSX', 'PDF'];

    private const COLUMNS = [
        ['key' => 'code', 'label' => 'Código', 'format' => 'text'],
        ['key' => 'at', 'label' => 'Fecha y hora', 'format' => 'datetime'],
        ['key' => 'actor', 'label' => 'Usuario', 'format' => 'text'],
        ['key' => 'role', 'label' => 'Rol', 'format' => 'text'],
        ['key' => 'entity', 'label' => 'Entidad', 'format' => 'text'],
        ['key' => 'entity_id', 'label' => 'Registro', 'format' => 'text'],
        ['key' => 'action', 'label' => 'Acción', 'format' => 'text'],
        ['key' => 'before', 'label' => 'Antes', 'format' => 'text'],
        ['key' => 'after', 'label' => 'Después', 'format' => 'text'],
        ['key' => 'critical', 'label' => 'Crítico', 'format' => 'text'],
        ['key' => 'ip', 'label' => 'IP', 'format' => 'text'],
        ['key' => 'correlation', 'label' => 'Operación', 'format' => 'text'],
    ];

    public function __construct(
        private readonly AuditDirectory $directory,
        private readonly AuditLogger $audit,
        private readonly NotificationLog $notifications,
        private readonly ReportFile $files,
        private readonly TenantContext $context,
    ) {}

    public function __invoke(array $filters, User $actor, ?string $idempotencyKey, string $format = 'CSV'): array
    {
        return DB::transaction(function () use ($filters, $actor, $idempotencyKey, $format): array {
            $id = (string) Str::uuid7();
            $code = ReportExports::nextCode();
            DB::table('report_exports')->insert([
                'id' => $id,
                'code' => $code,
                'report_name' => 'Bitácora de auditoría',
                'report_key' => 'auditoria',
                'filters' => json_encode($filters, JSON_UNESCAPED_UNICODE),
                'scope' => 'filtered',
                'format' => $format,
                'status' => 'procesando',
                'requested_by' => $actor->getKey(),
                'idempotency_key' => $idempotencyKey === null ? null : mb_substr($idempotencyKey, 0, 80),
                'created_by' => $actor->getKey(),
            ]);

            $limit = $format === 'PDF' ? self::MAX_PDF_ROWS : self::MAX_ROWS;
            $events = $this->directory->filtered($filters)->select($this->directory->columns())->orderByDesc('a.occurred_at')->limit($limit)->get()
                ->map(function (object $row): array {
                    $event = $this->directory->row($row);

                    return [...$event, 'critical' => $event['critical'] ? 'sí' : 'no'];
                });
            $content = $this->files->make($format, $this->report($filters, $events->all()), ReportBranding::for($this->context->tenant()));
            $extension = ReportFile::FORMATS[$format]['extension'];
            $path = 'exports/'.$actor->tenant_id.'/'.$code.'-auditoria.'.$extension;
            Storage::disk('local')->put($path, $content);

            DB::table('report_exports')->where('id', $id)->update([
                'status' => 'disponible',
                'rows_count' => $events->count(),
                'size_bytes' => strlen($content),
                'file_path' => $path,
                'finished_at' => now(),
            ]);
            $this->notifications->record([
                'event_code' => 'exportacion.lista',
                'channel' => 'portal',
                'recipient_user_id' => $actor->getKey(),
                'subject' => "Tu exportación {$code} de la bitácora está lista",
                'body_rendered' => $events->count()." eventos en {$format}. Disponible por 7 días.",
                'source_type' => 'Exportación',
                'source_id' => $id,
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Exportación', $code, 'exportar', null, "Bitácora de auditoría · {$events->count()} eventos · {$format}");

            return ['id' => $id, 'export_id' => $id, 'code' => $code, 'status' => 'disponible', 'format' => $format, 'rows' => $events->count(), 'truncated' => $format === 'PDF' && $events->count() >= self::MAX_PDF_ROWS];
        });
    }

    private function report(array $filters, array $rows): array
    {
        $to = CarbonImmutable::now($this->context->timezone());
        $critical = count(array_filter($rows, fn (array $row): bool => $row['critical'] === 'sí'));

        return [
            'title' => 'Bitácora de auditoría',
            'scope' => 'tenant',
            'filters' => ['from' => $to->subDays((int) $filters['days'])->toDateString(), 'to' => $to->toDateString(), 'label' => "Últimos {$filters['days']} días", 'sede' => null],
            'kpis' => [
                ['label' => 'Eventos', 'value' => count($rows), 'format' => 'number', 'hint' => 'Con los filtros aplicados'],
                ['label' => 'Críticos', 'value' => $critical, 'format' => 'number', 'hint' => 'Acciones marcadas como críticas'],
                ['label' => 'Usuarios', 'value' => count(array_unique(array_column($rows, 'actor'))), 'format' => 'number', 'hint' => 'Personas o procesos distintos'],
            ],
            'table' => ['columns' => self::COLUMNS, 'rows' => $rows, 'totals' => null],
            'charts' => [],
        ];
    }
}
