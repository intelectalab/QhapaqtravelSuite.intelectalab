<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Admin\Support\ApiDirectory;
use App\Domain\Admin\Support\PgArray;
use App\Domain\Iam\Models\AccessToken;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OAuthAuthorization
{
    public const CODE_MINUTES = 10;

    private const ENTITY = 'App OAuth';

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public function describe(array $data): array
    {
        $app = $this->app($data);

        return [
            'client_id' => $app->client_id,
            'name' => $app->name,
            'vendor' => $app->vendor,
            'agency' => (string) $this->context->tenant()->commercial_name,
            'redirect_uri' => $data['redirect_uri'],
            'state' => $data['state'] ?? null,
            'scopes' => collect($this->scopes($data, $app))->map(fn (string $scope): array => ['value' => $scope, 'label' => ApiDirectory::SCOPES[$scope] ?? $scope])->values()->all(),
        ];
    }

    public function decide(array $data, bool $approve, User $actor): array
    {
        $app = $this->app($data);
        $scopes = $this->scopes($data, $app);

        if (! $approve) {
            $this->audit->log(self::ENTITY, (string) $app->client_id, 'rechazar', null, $app->name.' · '.$actor->name);

            return ['redirect_to' => $this->redirect($data['redirect_uri'], ['error' => 'access_denied', 'error_description' => 'La agencia no autorizó el acceso.', 'state' => $data['state'] ?? null])];
        }

        $code = Str::random(64);
        $this->db()->table('integration_oauth_codes')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->context->idOrFail(),
            'client_id' => $app->client_id,
            'user_id' => $actor->getKey(),
            'code_hash' => hash('sha256', $code),
            'redirect_uri' => $data['redirect_uri'],
            'scopes' => PgArray::from($scopes),
            'code_challenge' => $data['code_challenge'],
            'expires_at' => AccessToken::expiresAfter(self::CODE_MINUTES)->utc(),
        ]);
        $this->audit->log(self::ENTITY, (string) $app->client_id, 'autorizar', null, $app->name.' · '.implode(', ', $scopes));

        return ['redirect_to' => $this->redirect($data['redirect_uri'], ['code' => $code, 'state' => $data['state'] ?? null])];
    }

    private function app(array $data): object
    {
        $app = $this->db()->table('integration_oauth_apps as a')
            ->join('oauth_clients as c', 'c.id', '=', 'a.client_id')
            ->where('c.tenant_id', $this->context->idOrFail())
            ->where('c.id', $data['client_id'])
            ->first(['a.client_id', 'a.vendor', 'a.allowed_scopes', 'a.status', 'c.name', 'c.redirect_uris', 'c.revoked']);

        if ($app === null) {
            throw ApiException::notFound('La aplicación no existe en tu agencia.');
        }

        if ($app->status !== 'active' || $app->revoked) {
            throw ApiException::conflict('API-BR-09', 'Esta aplicación fue revocada. Regístrala otra vez para conectarla.');
        }

        if (! in_array($data['redirect_uri'], (array) json_decode((string) $app->redirect_uris, true), true)) {
            throw ApiException::unprocessable('OAUTH_REDIRECT', 'La URL de retorno no está registrada para esta aplicación.');
        }

        return $app;
    }

    private function scopes(array $data, object $app): array
    {
        $allowed = PgArray::parse($app->allowed_scopes);
        $requested = array_values(array_filter(preg_split('/\s+/', trim((string) ($data['scope'] ?? ''))) ?: []));

        if ($requested === []) {
            return $allowed;
        }

        $extra = array_diff($requested, $allowed);

        if ($extra !== []) {
            throw ApiException::unprocessable('OAUTH_SCOPE', 'La aplicación pide permisos que la agencia no le concedió: '.implode(', ', $extra).'.');
        }

        return array_values(array_unique($requested));
    }

    private function redirect(string $uri, array $params): string
    {
        return $uri.(str_contains($uri, '?') ? '&' : '?').http_build_query(array_filter($params, fn (mixed $value): bool => $value !== null));
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
