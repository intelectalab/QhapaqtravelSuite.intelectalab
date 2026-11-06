<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class IntegrationDirectory
{
    public const KINDS = ['fiscal' => 'Facturación', 'payments' => 'Pagos', 'email' => 'Correo', 'messaging' => 'Mensajería', 'maps' => 'Mapas', 'suppliers' => 'Proveedores', 'distribution' => 'Distribución'];

    public const STATUSES = ['activo' => 'Activa', 'por_validar' => 'Por validar', 'sandbox' => 'En pruebas', 'parcial' => 'Parcial', 'futuro' => 'Fase futura'];

    public const QUEUES = ['critical' => 'Crítica', 'default' => 'General', 'notifications' => 'Avisos', 'documents' => 'Documentos', 'integrations' => 'Integraciones', 'reports' => 'Reportes', 'low' => 'Baja prioridad'];

    public function __construct(private readonly AuditDirectory $audit) {}

    public function overview(User $viewer): array
    {
        $adapters = DB::table('integration_adapters as a')
            ->leftJoin('iam_users as u', 'u.id', '=', 'a.owner_user_id')
            ->orderBy('a.code')
            ->get(['a.code', 'a.name', 'a.kind', 'a.status', 'a.environment', 'a.max_retries', 'a.backoff_base_s', 'a.timeout_s', 'a.secret_ref', 'a.secret_rotated_at', 'a.note', 'a.last_test_at', 'a.last_test_ok', 'a.last_test_result', 'a.owner_user_id', 'u.name as owner_name']);
        $errors = DB::table('integration_errors as e')
            ->leftJoin('iam_users as u', 'u.id', '=', 'e.resolved_by')
            ->orderByDesc('e.created_at')
            ->limit(200)
            ->get(['e.code', 'e.source', 'e.ref_code', 'e.target', 'e.error', 'e.error_class', 'e.attempt', 'e.max_attempts', 'e.next_retry_at', 'e.status', 'e.resolution', 'e.created_at', 'e.updated_at', 'u.name as resolved_by']);
        $runs = DB::table('sys_job_runs')->whereNotNull('scheduled_job_id')->orderByDesc('started_at')->limit(400)->get(['scheduled_job_id', 'trigger', 'status', 'result', 'started_at', 'finished_at'])->groupBy('scheduled_job_id');
        $jobs = DB::table('sys_scheduled_jobs')->orderBy('code')->get(['id', 'code', 'name', 'cron', 'cron_label', 'queue', 'paused', 'last_run_at', 'next_run_at', 'last_status', 'last_result', 'is_system', 'report_key']);
        $owners = DB::table('iam_users as u')
            ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
            ->join('roles as r', 'r.id', '=', 'mr.role_id')
            ->where('u.status', 'activo')
            ->where('mr.model_type', User::class)
            ->whereIn('r.name', ['tenant_admin', 'manager', 'finance', 'operations'])
            ->orderBy('u.name')
            ->distinct()
            ->get(['u.id', 'u.name']);

        return [
            'adapters' => $adapters->map(fn (object $row): array => [
                'code' => $row->code,
                'name' => $row->name,
                'kind' => $row->kind,
                'kind_label' => self::KINDS[$row->kind] ?? $row->kind,
                'status' => $row->status,
                'status_label' => self::STATUSES[$row->status] ?? $row->status,
                'environment' => $row->environment,
                'max_retries' => (int) $row->max_retries,
                'backoff' => (int) $row->backoff_base_s,
                'timeout' => (int) $row->timeout_s,
                'has_secret' => $row->secret_ref !== null,
                'note' => $row->note,
                'owner' => $row->owner_user_id ? ['id' => $row->owner_user_id, 'name' => $row->owner_name] : null,
                'last_test' => $row->last_test_at ? ['at' => $row->last_test_at, 'ok' => (bool) $row->last_test_ok, 'result' => $row->last_test_result] : null,
                'open_errors' => $errors->where('ref_code', $row->code)->where('status', '<>', 'resuelto')->count(),
            ])->values(),
            'jobs' => $jobs->map(fn (object $row): array => [
                'code' => $row->code,
                'name' => $row->name,
                'cron' => $row->cron,
                'cron_label' => $row->cron_label,
                'queue' => $row->queue,
                'queue_label' => self::QUEUES[$row->queue] ?? $row->queue,
                'paused' => (bool) $row->paused,
                'last_run_at' => $row->last_run_at,
                'next_run_at' => $row->next_run_at,
                'status' => $row->last_status,
                'result' => $row->last_result,
                'system' => (bool) $row->is_system,
                'runs' => collect($runs[$row->id] ?? [])->take(6)->map(fn ($run): array => ['trigger' => $run->trigger, 'status' => $run->status, 'result' => $run->result, 'at' => $run->started_at])->values(),
            ])->values(),
            'errors' => $errors->map(fn (object $row): array => [
                'code' => $row->code,
                'source' => $row->source,
                'ref' => $row->ref_code,
                'target' => $row->target,
                'error' => $row->error,
                'class' => $row->error_class,
                'attempt' => (int) $row->attempt,
                'max' => (int) $row->max_attempts,
                'next_retry_at' => $row->next_retry_at,
                'status' => $row->status,
                'resolution' => $row->resolution,
                'resolved_by' => $row->resolved_by,
                'at' => $row->created_at,
            ])->values(),
            'owners' => $owners->map(fn (object $user): array => ['value' => $user->id, 'label' => $user->name])->values(),
            'history' => $this->audit->recent(['Integración', 'Job'], 8),
            'can_manage' => $viewer->can('admin.settings.manage'),
        ];
    }
}
