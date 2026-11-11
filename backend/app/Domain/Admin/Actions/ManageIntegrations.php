<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\FiscalGateway;
use App\Domain\Integrations\Contracts\HealthCheckable;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Contracts\PaymentGateway;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Http\Middleware\AssignCorrelationId;
use App\Jobs\TenantJob;
use Cron\CronExpression;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class ManageIntegrations
{
    private const CONTRACTS = ['fiscal' => FiscalGateway::class, 'payments' => PaymentGateway::class, 'email' => MessagingChannel::class, 'messaging' => MessagingChannel::class];

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function configure(string $code, array $data, User $actor): void
    {
        DB::transaction(function () use ($code, $data, $actor): void {
            $adapter = $this->adapter($code);

            if ($data['environment'] === 'production' && $adapter->environment !== 'production' && in_array($adapter->status, ['por_validar', 'futuro', 'sandbox'], true)) {
                throw ApiException::unprocessable('INT-BR-02', $adapter->status === 'sandbox'
                    ? 'WhatsApp necesita plantillas aprobadas por Meta antes de pasar a producción.'
                    : 'Esta integración aún no tiene proveedor validado: no puede pasar a producción.');
            }

            $values = [
                'environment' => $data['environment'],
                'owner_user_id' => $data['owner_user_id'] ?? null,
                'max_retries' => (int) $data['max_retries'],
                'backoff_base_s' => (int) $data['backoff_base_s'],
                'timeout_s' => (int) $data['timeout_s'],
            ];
            $before = collect($values)->map(fn (mixed $value, string $key): string => (string) $adapter->{$key})->all();
            $after = collect($values)->map(fn (mixed $value): string => (string) $value)->all();

            if ($before === $after) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            DB::table('integration_adapters')->where('id', $adapter->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Integración', $adapter->code, 'configurar', $this->summary($before), $this->summary($after));
        });
    }

    public function test(string $code, ?User $actor = null): array
    {
        $adapter = $this->adapter($code);

        if (in_array($adapter->status, ['por_validar', 'futuro'], true)) {
            [$ok, $result] = [false, 'Proveedor por validar: la prueba no envía credenciales (INT-BR-01).'];
        } elseif (! isset(self::CONTRACTS[$adapter->kind])) {
            [$ok, $result] = [false, 'Aún no hay un adaptador con prueba de conexión para este tipo.'];
        } else {
            try {
                $driver = $this->driver(self::CONTRACTS[$adapter->kind]);
                $check = $driver instanceof HealthCheckable ? $driver->healthcheck() : null;
                $simulated = (bool) ($check?->payload['simulated'] ?? false);
                [$ok, $result] = $check === null
                    ? [false, 'El adaptador no expone prueba de conexión.']
                    : [$check->ok, $check->ok ? ($simulated ? 'Respuesta correcta del adaptador simulado.' : 'Conexión correcta.') : ($check->message ?? 'El proveedor rechazó la prueba.')];
            } catch (Throwable $e) {
                [$ok, $result] = [false, mb_substr($e->getMessage(), 0, 240)];
            }
        }

        DB::table('integration_adapters')->where('id', $adapter->id)->update(['last_test_at' => now(), 'last_test_ok' => $ok, 'last_test_result' => $result, 'updated_by' => $actor?->getKey()]);
        $this->audit->log('Integración', $adapter->code, 'probar_conexion', null, ($ok ? 'ok · ' : 'error · ').$result);

        return ['ok' => $ok, 'result' => $result];
    }

    public function job(string $id, string $mode): void
    {
        DB::transaction(function () use ($id, $mode): void {
            $job = $this->scheduled($id);
            $pause = $mode === 'pause';

            if ((bool) $job->paused === $pause) {
                throw ApiException::conflict('JOB-BR-02', $pause ? 'El proceso ya está pausado.' : 'El proceso ya está en marcha.');
            }

            $next = $pause ? null : (new CronExpression($job->cron))->getNextRunDate(now('America/Lima'))->format(DATE_ATOM);
            DB::table('sys_scheduled_jobs')->where('id', $job->id)->update(['paused' => $pause, 'next_run_at' => $next, 'updated_at' => now()]);
            $this->audit->log('Job', $job->code, $pause ? 'pausar' : 'reanudar', $pause ? 'activo' : 'pausado', $pause ? 'pausado' : "activo · próxima {$next}");
        });
    }

    public function reportSchedule(string $id, string $mode, User $actor): void
    {
        $job = DB::table('sys_scheduled_jobs')->where(Str::isUuid($id) ? 'id' : 'code', $id)->first() ?? throw ApiException::notFound('El proceso no existe.');

        if ($job->is_system || $job->report_key === null) {
            throw ApiException::conflict('JOB-BR-03', 'Aquí solo se pausan los envíos programados de reportes.');
        }

        if (! $actor->can('admin.settings.manage') && $job->owner_user_id !== $actor->getKey()) {
            throw ApiException::forbidden('SCOPE_OWNERSHIP', 'Solo puedes pausar los envíos que programaste.', ['admin.settings.manage']);
        }

        $this->job((string) $job->id, $mode);
    }

    public function run(string $id, User $actor): array
    {
        return DB::transaction(function () use ($id, $actor): array {
            $job = $this->scheduled($id);

            if ($job->last_status === 'en_curso' || DB::table('sys_job_runs')->where('scheduled_job_id', $job->id)->where('status', 'en_curso')->exists()) {
                throw ApiException::conflict('JOB-BR-01', 'El proceso ya se está ejecutando. Espera a que termine.');
            }

            if ($job->paused) {
                throw ApiException::conflict('JOB-BR-02', 'El proceso está pausado. Reanúdalo antes de ejecutarlo.');
            }

            $available = $this->available((string) $job->job_class);
            $status = $available ? 'en_curso' : 'advertencia';
            $result = $available ? 'Ejecución manual en cola.' : 'Ejecución manual registrada: el proceso aún no está disponible en este entorno.';
            $runId = (string) Str::uuid7();
            DB::table('sys_job_runs')->insert([
                'id' => $runId,
                'scheduled_job_id' => $job->id,
                'job_class' => $job->job_class,
                'trigger' => 'manual',
                'triggered_by' => $actor->getKey(),
                'status' => $status,
                'result' => $result,
                'started_at' => now(),
                'finished_at' => $available ? null : now(),
                'correlation_id' => mb_substr(AssignCorrelationId::current(), 0, 40),
            ]);
            DB::table('sys_scheduled_jobs')->where('id', $job->id)->update(['last_run_at' => now(), 'last_status' => $status, 'last_result' => $result, 'updated_at' => now()]);

            if ($available) {
                $this->enqueue((string) $job->job_class, (string) $job->queue, (string) $job->id, $runId);
            }

            $this->audit->log('Job', $job->code, 'ejecutar', null, $result);

            return ['id' => $runId, 'job_id' => (string) $job->id, 'code' => (string) $job->code, 'status' => $status, 'result' => $result];
        });
    }

    public function delete(string $id, User $actor): void
    {
        DB::transaction(function () use ($id, $actor): void {
            $job = $this->scheduled($id);

            if ($job->is_system || $job->report_key === null) {
                throw ApiException::conflict('JOB-BR-03', 'Solo se eliminan los envíos programados de reportes.');
            }

            if (! $actor->can('admin.settings.manage') && $job->owner_user_id !== $actor->getKey()) {
                throw ApiException::forbidden('SCOPE_OWNERSHIP', 'Solo puedes eliminar los envíos que programaste.', ['admin.settings.manage']);
            }

            DB::table('report_exports')->where('scheduled_job_id', $job->id)->update(['scheduled_job_id' => null]);
            DB::table('sys_job_runs')->where('scheduled_job_id', $job->id)->update(['scheduled_job_id' => null]);
            DB::table('sys_scheduled_jobs')->where('id', $job->id)->delete();
            $this->audit->log('Job', $job->code, 'eliminar', $job->name, null);
        });
    }

    public function retryError(string $id, ?User $actor = null): void
    {
        DB::transaction(function () use ($id, $actor): void {
            $error = $this->error($id, $actor);

            if ($error->status === 'resuelto') {
                throw ApiException::unprocessable('INT-BR-05', 'El error ya está resuelto.');
            }

            if ($error->error_class === 'permanente') {
                throw ApiException::conflict('INT-BR-05', 'Es un error permanente: reintentar no cambia el resultado. Corrige el dato y márcalo como resuelto.');
            }

            DB::table('integration_errors')->where('id', $error->id)->update(['status' => 'reintentando', 'attempt' => 0, 'next_retry_at' => now()->addMinute(), 'updated_at' => now()]);
            $this->audit->log('Integración', $error->code, 'reintentar', $error->status, 'reintentando');
        });
    }

    public function resolveError(string $id, string $resolution, User $actor): void
    {
        DB::transaction(function () use ($id, $resolution, $actor): void {
            $error = $this->error($id, $actor);

            if ($error->status === 'resuelto') {
                throw ApiException::unprocessable('INT-BR-06', 'El error ya está resuelto.');
            }

            DB::table('integration_errors')->where('id', $error->id)->update(['status' => 'resuelto', 'resolution' => $resolution, 'resolved_by' => $actor->getKey(), 'next_retry_at' => null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Integración', $error->code, 'resolver_error', $error->status, $resolution);
        });
    }

    private function available(string $class): bool
    {
        return class_exists($class) && is_subclass_of($class, TenantJob::class);
    }

    private function enqueue(string $class, string $queue, string $scheduledJobId, string $runId): void
    {
        $job = (new $class)->forTenant($this->context->idOrFail())->scheduled($scheduledJobId, 'manual', $runId);
        dispatch($job->onQueue($queue))->afterCommit();
    }

    private function driver(string $contract): object
    {
        return app()->make($contract);
    }

    private function adapter(string $id): object
    {
        return DB::table('integration_adapters')->where(Str::isUuid($id) ? 'id' : 'code', $id)->first() ?? throw ApiException::notFound('La integración no existe.');
    }

    private function scheduled(string $id): object
    {
        return DB::table('sys_scheduled_jobs')->where(Str::isUuid($id) ? 'id' : 'code', $id)->lockForUpdate()->first() ?? throw ApiException::notFound('El proceso no existe.');
    }

    private function error(string $id, ?User $actor): object
    {
        $error = DB::table('integration_errors')->where(Str::isUuid($id) ? 'id' : 'code', $id)->lockForUpdate()->first() ?? throw ApiException::notFound('El error no existe.');

        if ($actor !== null && ! $actor->can('admin.settings.manage')) {
            $owned = $error->source === 'job' && DB::table('sys_scheduled_jobs')->where('code', $error->ref_code)->whereNotNull('report_key')->where('owner_user_id', $actor->getKey())->exists();

            if (! $owned) {
                throw ApiException::notFound('El error no existe.');
            }
        }

        return $error;
    }

    private function summary(array $values): string
    {
        return "{$values['environment']} · {$values['max_retries']} reintentos · {$values['backoff_base_s']} s · {$values['timeout_s']} s";
    }
}
