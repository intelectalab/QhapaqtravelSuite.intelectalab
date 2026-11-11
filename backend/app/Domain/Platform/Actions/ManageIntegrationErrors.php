<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageIntegrationErrors
{
    private const CONNECTION = 'pgsql_platform';

    private const ENTITY = 'Integración';

    public function __construct(private readonly PlatformSession $session) {}

    public function retry(string $id, PlatformUser $actor): void
    {
        $this->db()->transaction(function () use ($id, $actor): void {
            $error = $this->error($id);

            if ($error->status === 'resuelto') {
                throw ApiException::unprocessable('INT-BR-05', 'El error ya está resuelto.');
            }

            if ($error->error_class === 'permanente') {
                throw ApiException::conflict('INT-BR-05', 'Es un error permanente: reintentar no cambia el resultado. La agencia debe corregir el dato; luego márcalo como resuelto.');
            }

            $this->db()->table('integration_errors')->where('id', $error->id)->update(['status' => 'reintentando', 'attempt' => 0, 'next_retry_at' => now()->addMinute(), 'updated_at' => now()]);
            $this->session->log(self::ENTITY, $this->subject($error), 'reintentar', $error->status, 'reintentando', $actor);
        });
    }

    public function resolve(string $id, string $resolution, PlatformUser $actor): void
    {
        $this->db()->transaction(function () use ($id, $resolution, $actor): void {
            $error = $this->error($id);

            if ($error->status === 'resuelto') {
                throw ApiException::unprocessable('INT-BR-06', 'El error ya está resuelto.');
            }

            $note = mb_substr(trim($resolution).' · Plataforma: '.$actor->name, 0, 1000);
            $this->db()->table('integration_errors')->where('id', $error->id)->update(['status' => 'resuelto', 'resolution' => $note, 'next_retry_at' => null, 'updated_at' => now()]);
            $this->session->log(self::ENTITY, $this->subject($error), 'resolver_error', $error->status, trim($resolution), $actor);
        });
    }

    private function error(string $id): object
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('El error no existe.');
        }

        return $this->db()->table('integration_errors')->where('id', $id)->whereNotNull('tenant_id')->lockForUpdate()->first() ?? throw ApiException::notFound('El error no existe.');
    }

    private function subject(object $error): string
    {
        $tenant = (string) $this->db()->table('tenants')->where('id', $error->tenant_id)->value('code');

        return ($error->code ?: $error->ref_code).'@'.$tenant;
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
