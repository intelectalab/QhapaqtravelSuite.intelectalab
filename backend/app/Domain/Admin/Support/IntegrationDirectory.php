<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class IntegrationDirectory
{
    public const KINDS = ['fiscal' => 'Facturación', 'payments' => 'Pagos', 'email' => 'Correo', 'messaging' => 'Mensajería', 'maps' => 'Mapas', 'suppliers' => 'Proveedores', 'distribution' => 'Distribución'];

    public const STATUSES = ['activo' => 'Activa', 'por_validar' => 'Por validar', 'sandbox' => 'En pruebas', 'parcial' => 'Parcial', 'futuro' => 'Fase futura'];

    public const QUEUES = ['critical' => 'Crítica', 'default' => 'General', 'notifications' => 'Avisos', 'documents' => 'Documentos', 'integrations' => 'Integraciones', 'reports' => 'Reportes', 'low' => 'Baja prioridad'];

    public const CONTRACTS = [
        'fiscal' => 'FiscalGateway: emitir, anular y consultar comprobantes',
        'payments' => 'PaymentGateway: cobrar, reembolsar y verificar webhooks',
        'email' => 'MessagingChannel: enviar correo y consultar entrega',
        'messaging' => 'MessagingChannel: enviar plantillas y recibir respuestas',
        'maps' => 'Geocodificar direcciones y calcular rutas',
        'suppliers' => 'Consultar disponibilidad y confirmar servicios del proveedor',
        'distribution' => 'Publicar tarifas y recibir reservas de canales',
    ];

    public function __construct(private readonly AuditDirectory $audit) {}

    public function adaptersPage(Request $request, User $viewer): array
    {
        $filters = CursorPage::filters($request);
        $query = $this->adapters()
            ->when($filters['kind'] ?? null, fn (Builder $q, string $kind) => $q->whereIn('a.kind', explode(',', $kind)))
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->whereIn('a.status', explode(',', $status)));
        $open = $this->openErrors();

        return CursorPage::respond($request, $query, ['code' => 'a.code', 'name' => 'a.name', 'status' => 'a.status'], 'code', fn (object $row): array => $this->adapter($row, $open), CursorPage::isFirst($request) ? [
            'kpis' => [
                'total' => DB::table('integration_adapters')->count(),
                'active' => DB::table('integration_adapters')->where('status', 'activo')->count(),
                'production' => DB::table('integration_adapters')->where('environment', 'production')->count(),
                'open_errors' => DB::table('integration_errors')->where('status', '<>', 'resuelto')->count(),
            ],
            'owners' => $this->owners(),
            'history' => $this->audit->recent(['Integración', 'Job'], 8),
            'can_manage' => $viewer->can('admin.settings.manage'),
        ] : []);
    }

    public function adapterById(string $id): array
    {
        $row = $this->adapters()->where(fn (Builder $q) => Str::isUuid($id) ? $q->where('a.id', $id) : $q->where('a.code', $id))->first() ?? throw ApiException::notFound('La integración no existe.');

        return $this->adapter($row, $this->openErrors());
    }

    public function jobsPage(Request $request, User $viewer): array
    {
        $filters = CursorPage::filters($request);
        $query = $this->jobs($viewer)
            ->when($filters['queue'] ?? null, fn (Builder $q, string $queue) => $q->whereIn('j.queue', explode(',', $queue)))
            ->when(isset($filters['paused']), fn (Builder $q) => $q->where('j.paused', filter_var($filters['paused'], FILTER_VALIDATE_BOOLEAN)))
            ->when($filters['status'] ?? $filters['last_status'] ?? null, fn (Builder $q, string $status) => $q->whereIn('j.last_status', explode(',', $status)));
        $page = CursorPage::respond($request, $query, ['code' => 'j.code', 'name' => 'j.name', 'next_run_at' => 'j.next_run_at', 'last_run_at' => 'j.last_run_at'], 'code', fn (object $row): array => $this->job($row, []), CursorPage::isFirst($request) ? [
            'kpis' => [
                'total' => DB::table('sys_scheduled_jobs')->count(),
                'paused' => DB::table('sys_scheduled_jobs')->where('paused', true)->count(),
                'errors' => DB::table('sys_scheduled_jobs')->where('last_status', 'error')->count(),
            ],
        ] : []);
        $runs = DB::table('sys_job_runs')->whereIn('scheduled_job_id', array_column($page['data'], 'id'))->orderByDesc('started_at')->limit(400)->get(['scheduled_job_id', 'trigger', 'status', 'result', 'started_at', 'finished_at'])->groupBy('scheduled_job_id');
        $page['data'] = array_map(fn (array $job): array => [...$job, 'runs' => $this->runs($runs->get($job['id'], collect())->take(6)->all())], $page['data']);

        return $page;
    }

    public function jobById(string $id): array
    {
        $row = $this->jobs(null)->where(fn (Builder $q) => Str::isUuid($id) ? $q->where('j.id', $id) : $q->where('j.code', $id))->first() ?? throw ApiException::notFound('El proceso no existe.');

        return $this->job($row, []);
    }

    public function errorsPage(Request $request, User $viewer): array
    {
        $filters = CursorPage::filters($request);
        $query = $this->errors($viewer)
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->whereIn('e.status', explode(',', $status)))
            ->when($filters['error_class'] ?? $filters['class'] ?? null, fn (Builder $q, string $class) => $q->whereIn('e.error_class', explode(',', $class)))
            ->when($filters['source'] ?? null, fn (Builder $q, string $source) => $q->whereIn('e.source', explode(',', $source)))
            ->when($filters['ref_code'] ?? null, fn (Builder $q, string $ref) => $q->where('e.ref_code', $ref));

        return CursorPage::respond($request, $query, ['created_at' => 'e.created_at', 'status' => 'e.status', 'next_retry_at' => 'e.next_retry_at'], '-created_at', fn (object $row): array => $this->error($row), CursorPage::isFirst($request) ? [
            'kpis' => [
                'open' => (clone $this->errors($viewer))->where('e.status', '<>', 'resuelto')->count(),
                'retrying' => (clone $this->errors($viewer))->where('e.status', 'reintentando')->count(),
                'definitive' => (clone $this->errors($viewer))->where('e.status', 'fallo_definitivo')->count(),
            ],
        ] : []);
    }

    public function errorById(string $id, ?User $viewer = null): array
    {
        $row = $this->errors($viewer)->where(fn (Builder $q) => Str::isUuid($id) ? $q->where('e.id', $id) : $q->where('e.code', $id))->first() ?? throw ApiException::notFound('El error no existe.');

        return $this->error($row);
    }

    public function errors(?User $viewer): Builder
    {
        return DB::table('integration_errors as e')
            ->leftJoin('iam_users as u', 'u.id', '=', 'e.resolved_by')
            ->when($viewer !== null && ! $viewer->can('admin.settings.manage'), fn (Builder $q) => $q->where('e.source', 'job')->whereIn('e.ref_code', DB::table('sys_scheduled_jobs')->whereNotNull('report_key')->where('owner_user_id', $viewer?->getKey())->select('code')))
            ->select(['e.id', 'e.code', 'e.source', 'e.ref_code', 'e.target', 'e.error', 'e.error_class', 'e.attempt', 'e.max_attempts', 'e.next_retry_at', 'e.status', 'e.resolution', 'e.resolved_by', 'e.created_at', 'e.updated_at', 'u.name as resolved_by_name']);
    }

    private function adapters(): Builder
    {
        return DB::table('integration_adapters as a')
            ->leftJoin('iam_users as u', 'u.id', '=', 'a.owner_user_id')
            ->select(['a.id', 'a.code', 'a.name', 'a.kind', 'a.status', 'a.environment', 'a.owner_user_id', 'a.max_retries', 'a.backoff_base_s', 'a.timeout_s', 'a.secret_ref', 'a.secret_rotated_at', 'a.note', 'a.last_test_at', 'a.last_test_ok', 'a.last_test_result', 'a.updated_by', 'a.created_at', 'a.updated_at', 'u.name as owner_name']);
    }

    private function jobs(?User $viewer): Builder
    {
        return DB::table('sys_scheduled_jobs as j')
            ->leftJoin('iam_users as u', 'u.id', '=', 'j.owner_user_id')
            ->when($viewer !== null && ! $viewer->can('admin.settings.manage'), fn (Builder $q) => $q->whereNotNull('j.report_key')->where('j.owner_user_id', $viewer?->getKey()))
            ->select(['j.id', 'j.code', 'j.name', 'j.job_class', 'j.cron', 'j.cron_label', 'j.queue', 'j.paused', 'j.last_run_at', 'j.next_run_at', 'j.last_status', 'j.last_result', 'j.report_key', 'j.report_format', 'j.recipients', 'j.owner_user_id', 'j.is_system', 'j.created_at', 'j.updated_at', 'u.name as owner_name']);
    }

    private function adapter(object $row, array $open): array
    {
        return [
            'id' => $row->id,
            'code' => $row->code,
            'name' => $row->name,
            'kind' => $row->kind,
            'status' => $row->status,
            'environment' => $row->environment,
            'owner_user_id' => $row->owner_user_id,
            'max_retries' => (int) $row->max_retries,
            'backoff_base_s' => (int) $row->backoff_base_s,
            'timeout_s' => (int) $row->timeout_s,
            'secret_ref' => $row->secret_ref === null ? null : 'vault://***',
            'secret_rotated_at' => $row->secret_rotated_at,
            'note' => $row->note,
            'last_test_at' => $row->last_test_at,
            'last_test_ok' => $row->last_test_ok === null ? null : (bool) $row->last_test_ok,
            'last_test_result' => $row->last_test_result,
            'updated_by' => $row->updated_by,
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
            'kind_label' => self::KINDS[$row->kind] ?? $row->kind,
            'status_label' => self::STATUSES[$row->status] ?? $row->status,
            'contract' => self::CONTRACTS[$row->kind] ?? null,
            'backoff' => (int) $row->backoff_base_s,
            'timeout' => (int) $row->timeout_s,
            'has_secret' => $row->secret_ref !== null,
            'owner' => $row->owner_user_id ? ['id' => $row->owner_user_id, 'name' => $row->owner_name] : null,
            'last_test' => $row->last_test_at ? ['at' => $row->last_test_at, 'ok' => (bool) $row->last_test_ok, 'result' => $row->last_test_result] : null,
            'open_errors' => $open[$row->code] ?? 0,
        ];
    }

    private function job(object $row, array $runs): array
    {
        return [
            'id' => $row->id,
            'code' => $row->code,
            'name' => $row->name,
            'job_class' => $row->job_class,
            'cron' => $row->cron,
            'cron_label' => $row->cron_label,
            'queue' => $row->queue,
            'paused' => (bool) $row->paused,
            'last_run_at' => $row->last_run_at,
            'next_run_at' => $row->next_run_at,
            'last_status' => $row->last_status,
            'last_result' => $row->last_result,
            'report_key' => $row->report_key,
            'report_format' => $row->report_format,
            'recipients' => $row->recipients,
            'owner_user_id' => $row->owner_user_id,
            'is_system' => (bool) $row->is_system,
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
            'queue_label' => self::QUEUES[$row->queue] ?? $row->queue,
            'status' => $row->last_status,
            'result' => $row->last_result,
            'system' => (bool) $row->is_system,
            'owner_name' => $row->owner_name,
            'runs' => $runs,
        ];
    }

    private function error(object $row): array
    {
        return [
            'id' => $row->id,
            'code' => $row->code,
            'source' => $row->source,
            'ref_code' => $row->ref_code,
            'target' => $row->target,
            'error' => $row->error,
            'error_class' => $row->error_class,
            'attempt' => (int) $row->attempt,
            'max_attempts' => (int) $row->max_attempts,
            'next_retry_at' => $row->next_retry_at,
            'status' => $row->status,
            'resolution' => $row->resolution,
            'resolved_by' => $row->resolved_by,
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
            'ref' => $row->ref_code,
            'class' => $row->error_class,
            'max' => (int) $row->max_attempts,
            'resolved_by_name' => $row->resolved_by_name,
            'at' => $row->created_at,
        ];
    }

    private function runs(array $runs): array
    {
        $items = [];

        foreach ($runs as $run) {
            $items[] = ['trigger' => $run->trigger, 'status' => $run->status, 'result' => $run->result, 'at' => $run->started_at];
        }

        return $items;
    }

    private function openErrors(): array
    {
        return DB::table('integration_errors')->where('status', '<>', 'resuelto')->selectRaw('ref_code, count(*) as total')->groupBy('ref_code')->pluck('total', 'ref_code')->map(fn ($total): int => (int) $total)->all();
    }

    private function owners(): array
    {
        return DB::table('iam_users as u')
            ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
            ->join('roles as r', 'r.id', '=', 'mr.role_id')
            ->where('u.status', 'activo')
            ->where('mr.model_type', User::class)
            ->whereIn('r.name', ['tenant_admin', 'manager', 'finance', 'operations'])
            ->orderBy('u.name')
            ->distinct()
            ->get(['u.id', 'u.name'])
            ->map(fn (object $user): array => ['value' => $user->id, 'label' => $user->name])
            ->values()
            ->all();
    }
}
