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
use Cron\CronExpression;
use Illuminate\Support\Facades\DB;
use Throwable;

final class ManageIntegrations
{
    private const CONTRACTS = ['fiscal' => FiscalGateway::class, 'payments' => PaymentGateway::class, 'email' => MessagingChannel::class, 'messaging' => MessagingChannel::class];

    public function __construct(private readonly AuditLogger $audit) {}

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
            $this->audit->log('Integración', $code, 'configurar', $this->summary($before), $this->summary($after));
        });
    }

    public function test(string $code, User $actor): array
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

        DB::table('integration_adapters')->where('id', $adapter->id)->update(['last_test_at' => now(), 'last_test_ok' => $ok, 'last_test_result' => $result, 'updated_by' => $actor->getKey()]);
        $this->audit->log('Integración', $code, 'probar_conexion', null, ($ok ? 'ok · ' : 'error · ').$result);

        return ['ok' => $ok, 'result' => $result];
    }

    public function job(string $code, string $mode): void
    {
        DB::transaction(function () use ($code, $mode): void {
            $job = DB::table('sys_scheduled_jobs')->where('code', $code)->lockForUpdate()->first(['id', 'paused', 'cron']) ?? throw ApiException::notFound('El proceso no existe.');
            $pause = $mode === 'pause';

            if ((bool) $job->paused === $pause) {
                throw ApiException::unprocessable('JOB-BR-02', $pause ? 'El proceso ya está pausado.' : 'El proceso ya está en marcha.');
            }

            $next = $pause ? null : (new CronExpression($job->cron))->getNextRunDate(now('America/Lima'))->format(DATE_ATOM);
            DB::table('sys_scheduled_jobs')->where('id', $job->id)->update(['paused' => $pause, 'next_run_at' => $next, 'updated_at' => now()]);
            $this->audit->log('Job', $code, $pause ? 'pausar' : 'reanudar', $pause ? 'activo' : 'pausado', $pause ? 'pausado' : "activo · próxima {$next}");
        });
    }

    public function retryError(string $code): void
    {
        DB::transaction(function () use ($code): void {
            $error = $this->error($code);

            if ($error->status === 'resuelto') {
                throw ApiException::unprocessable('INT-BR-05', 'El error ya está resuelto.');
            }

            if ($error->error_class === 'permanente') {
                throw ApiException::conflict('INT-BR-05', 'Es un error permanente: reintentar no cambia el resultado. Corrige el dato y márcalo como resuelto.');
            }

            DB::table('integration_errors')->where('id', $error->id)->update(['status' => 'reintentando', 'attempt' => 0, 'next_retry_at' => now()->addMinute(), 'updated_at' => now()]);
            $this->audit->log('Integración', $code, 'reintentar', $error->status, 'reintentando');
        });
    }

    public function resolveError(string $code, string $resolution, User $actor): void
    {
        DB::transaction(function () use ($code, $resolution, $actor): void {
            $error = $this->error($code);

            if ($error->status === 'resuelto') {
                throw ApiException::unprocessable('INT-BR-06', 'El error ya está resuelto.');
            }

            DB::table('integration_errors')->where('id', $error->id)->update(['status' => 'resuelto', 'resolution' => $resolution, 'resolved_by' => $actor->getKey(), 'next_retry_at' => null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Integración', $code, 'resolver_error', $error->status, $resolution);
        });
    }

    private function driver(string $contract): object
    {
        return app()->make($contract);
    }

    private function adapter(string $code): object
    {
        return DB::table('integration_adapters')->where('code', $code)->first() ?? throw ApiException::notFound('La integración no existe.');
    }

    private function error(string $code): object
    {
        return DB::table('integration_errors')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('El error no existe.');
    }

    private function summary(array $values): string
    {
        return "{$values['environment']} · {$values['max_retries']} reintentos · {$values['backoff_base_s']} s · {$values['timeout_s']} s";
    }
}
