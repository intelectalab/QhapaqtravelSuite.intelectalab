<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Admin\Support\OAuthTokenError;
use App\Domain\Admin\Support\PgArray;
use App\Domain\Iam\Models\AccessToken;
use App\Domain\Platform\Support\Entitlements;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class IssueOAuthTokens
{
    public const ACCESS_PREFIX = 'kco_';

    public const REFRESH_PREFIX = 'kcr_';

    public const ACCESS_MINUTES = 60;

    public const REFRESH_DAYS = 30;

    public const FEATURE = 'module.oauth_apps';

    private const VERIFIER = '/^[A-Za-z0-9\-._~]{43,128}$/';

    public function __construct(private readonly Entitlements $entitlements) {}

    public function exchange(array $input): array
    {
        $grant = (string) ($input['grant_type'] ?? '');

        if (! in_array($grant, ['authorization_code', 'refresh_token'], true)) {
            throw new OAuthTokenError('unsupported_grant_type', 'Solo se admiten authorization_code y refresh_token.');
        }

        $client = $this->client((string) ($input['client_id'] ?? ''), (string) ($input['client_secret'] ?? ''));

        try {
            return $this->db()->transaction(fn (): array => $grant === 'authorization_code' ? $this->fromCode($client, $input) : $this->fromRefresh($client, $input));
        } catch (OAuthTokenError $e) {
            if ($e->replayedCode !== null) {
                $this->db()->table('integration_oauth_tokens')->where('code_id', $e->replayedCode)->whereNull('revoked_at')->update(['revoked_at' => now()->utc()]);
            }

            throw $e;
        }
    }

    public static function challenge(string $verifier): string
    {
        return rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
    }

    private function client(string $id, string $secret): object
    {
        if (! Str::isUuid($id) || $secret === '') {
            throw new OAuthTokenError('invalid_client', 'Envía el client_id y el client_secret de la aplicación.', 401);
        }

        $client = $this->db()->table('oauth_clients as c')
            ->join('integration_oauth_apps as a', 'a.client_id', '=', 'c.id')
            ->join('tenants as t', 't.id', '=', 'c.tenant_id')
            ->where('c.id', $id)
            ->first(['c.id', 'c.tenant_id', 'c.secret', 'c.revoked', 'a.status', 'a.allowed_scopes', 't.status as tenant_status']);

        if ($client === null || ! hash_equals((string) $client->secret, hash('sha256', $secret))) {
            throw new OAuthTokenError('invalid_client', 'El client_id o el client_secret no son válidos.', 401);
        }

        if ($client->revoked || $client->status !== 'active') {
            throw new OAuthTokenError('invalid_client', 'La agencia revocó esta aplicación.', 401);
        }

        if (in_array($client->tenant_status, ['suspendido', 'cancelado'], true) || ! $this->entitlements->enabled((string) $client->tenant_id, self::FEATURE)) {
            throw new OAuthTokenError('unauthorized_client', 'La agencia no tiene habilitadas las aplicaciones OAuth en este momento.');
        }

        return $client;
    }

    private function fromCode(object $client, array $input): array
    {
        foreach (['code', 'redirect_uri', 'code_verifier'] as $field) {
            if (! is_string($input[$field] ?? null) || $input[$field] === '') {
                throw new OAuthTokenError('invalid_request', "Falta el parámetro {$field}.");
            }
        }

        $code = $this->db()->table('integration_oauth_codes')
            ->where('code_hash', hash('sha256', (string) $input['code']))
            ->lockForUpdate()
            ->first(['id', 'tenant_id', 'client_id', 'user_id', 'redirect_uri', 'scopes', 'code_challenge', 'used_at', $this->db()->raw('expires_at <= now() as expired')]);

        if ($code === null || $code->client_id !== $client->id) {
            throw new OAuthTokenError('invalid_grant', 'El código de autorización no es válido.');
        }

        if ($code->used_at !== null) {
            throw new OAuthTokenError('invalid_grant', 'El código de autorización ya se usó. Por seguridad se anularon los tokens que generó.', 400, (string) $code->id);
        }

        if ($code->expired) {
            throw new OAuthTokenError('invalid_grant', 'El código de autorización venció. Vuelve a pedir permiso a la agencia.');
        }

        if ($code->redirect_uri !== $input['redirect_uri']) {
            throw new OAuthTokenError('invalid_grant', 'La URL de retorno no coincide con la del pedido de autorización.');
        }

        if (preg_match(self::VERIFIER, (string) $input['code_verifier']) !== 1 || ! hash_equals((string) $code->code_challenge, self::challenge((string) $input['code_verifier']))) {
            throw new OAuthTokenError('invalid_grant', 'El code_verifier no corresponde al code_challenge (PKCE S256).');
        }

        $this->db()->table('integration_oauth_codes')->where('id', $code->id)->update(['used_at' => now()->utc()]);

        return $this->issue($client, (string) $code->user_id, PgArray::parse($code->scopes), (string) $code->id);
    }

    private function fromRefresh(object $client, array $input): array
    {
        if (! is_string($input['refresh_token'] ?? null) || ! str_starts_with($input['refresh_token'], self::REFRESH_PREFIX)) {
            throw new OAuthTokenError('invalid_request', 'Falta el parámetro refresh_token.');
        }

        $token = $this->db()->table('integration_oauth_tokens')
            ->where('refresh_hash', hash('sha256', $input['refresh_token']))
            ->lockForUpdate()
            ->first(['id', 'client_id', 'code_id', 'user_id', 'scopes', 'revoked_at', $this->db()->raw('refresh_expires_at <= now() as expired')]);

        if ($token === null || $token->client_id !== $client->id || $token->revoked_at !== null || $token->expired) {
            throw new OAuthTokenError('invalid_grant', 'El token de renovación no es válido, venció o fue revocado.');
        }

        $this->db()->table('integration_oauth_tokens')->where('id', $token->id)->update(['revoked_at' => now()->utc()]);

        return $this->issue($client, (string) $token->user_id, PgArray::parse($token->scopes), $token->code_id === null ? null : (string) $token->code_id);
    }

    private function issue(object $client, string $userId, array $scopes, ?string $codeId): array
    {
        $scopes = array_values(array_intersect($scopes, PgArray::parse($client->allowed_scopes)));
        $access = self::ACCESS_PREFIX.Str::random(48);
        $refresh = self::REFRESH_PREFIX.Str::random(48);

        $this->db()->table('integration_oauth_tokens')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $client->tenant_id,
            'client_id' => $client->id,
            'code_id' => $codeId,
            'user_id' => $userId,
            'access_hash' => hash('sha256', $access),
            'refresh_hash' => hash('sha256', $refresh),
            'scopes' => PgArray::from($scopes),
            'expires_at' => AccessToken::expiresAfter(self::ACCESS_MINUTES)->utc(),
            'refresh_expires_at' => AccessToken::expiresAfter(self::REFRESH_DAYS * 1440)->utc(),
        ]);

        return [
            'access_token' => $access,
            'token_type' => 'Bearer',
            'expires_in' => self::ACCESS_MINUTES * 60,
            'refresh_token' => $refresh,
            'scope' => implode(' ', $scopes),
        ];
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
