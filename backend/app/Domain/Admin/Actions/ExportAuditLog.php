<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Admin\Support\AuditDirectory;
use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class ExportAuditLog
{
    public const MAX_ROWS = 50000;

    private const HEADER = ['Código', 'Fecha y hora', 'Usuario', 'Rol', 'Entidad', 'Registro', 'Acción', 'Antes', 'Después', 'Crítico', 'IP', 'Operación'];

    public function __construct(
        private readonly AuditDirectory $directory,
        private readonly AuditLogger $audit,
        private readonly NotificationLog $notifications,
    ) {}

    public function __invoke(array $filters, User $actor, ?string $idempotencyKey): array
    {
        return DB::transaction(function () use ($filters, $actor, $idempotencyKey): array {
            $id = (string) Str::uuid7();
            $next = (int) DB::table('report_exports')->whereNotNull('code')->selectRaw("coalesce(max(nullif(substring(code from '(\\d+)$'), '')::int), 0) as last")->value('last') + 1;
            $code = 'EXP-'.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
            DB::table('report_exports')->insert([
                'id' => $id,
                'code' => $code,
                'report_name' => 'Bitácora de auditoría',
                'report_key' => 'auditoria',
                'filters' => json_encode($filters, JSON_UNESCAPED_UNICODE),
                'scope' => 'filtered',
                'format' => 'CSV',
                'status' => 'procesando',
                'requested_by' => $actor->getKey(),
                'idempotency_key' => $idempotencyKey === null ? null : mb_substr($idempotencyKey, 0, 80),
                'created_by' => $actor->getKey(),
            ]);

            $rows = $this->directory->filtered($filters)->select($this->directory->columns())->orderByDesc('a.occurred_at')->limit(self::MAX_ROWS)->get();
            $handle = fopen('php://temp', 'w+');
            fputcsv($handle, self::HEADER);

            foreach ($rows as $row) {
                $event = $this->directory->row($row);
                fputcsv($handle, [$event['code'], $event['at'], $event['actor'], $event['role'], $event['entity'], $event['entity_id'], $event['action'], $event['before'], $event['after'], $event['critical'] ? 'sí' : 'no', $event['ip'], $event['correlation']]);
            }

            rewind($handle);
            $content = (string) stream_get_contents($handle);
            fclose($handle);
            $path = 'exports/'.$actor->tenant_id.'/'.$code.'-auditoria.csv';
            Storage::disk('local')->put($path, "\u{FEFF}".$content);

            DB::table('report_exports')->where('id', $id)->update([
                'status' => 'disponible',
                'rows_count' => $rows->count(),
                'size_bytes' => strlen($content) + 3,
                'file_path' => $path,
                'finished_at' => now(),
            ]);
            $this->notifications->record([
                'event_code' => 'exportacion.lista',
                'channel' => 'portal',
                'recipient_user_id' => $actor->getKey(),
                'subject' => "Tu exportación {$code} de la bitácora está lista",
                'body_rendered' => $rows->count().' eventos en CSV. Disponible por 7 días.',
                'source_type' => 'Exportación',
                'source_id' => $id,
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Exportación', $code, 'exportar', null, 'Bitácora de auditoría · '.$rows->count().' eventos');

            return ['id' => $id, 'export_id' => $id, 'code' => $code, 'status' => 'disponible', 'format' => 'CSV', 'rows' => $rows->count()];
        });
    }
}
