<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Admin\Support\ApiDirectory;
use App\Domain\Admin\Support\PgArray;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class ManageOAuthApps
{
    private const ENTITY = 'App OAuth';

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public function list(): array
    {
        return DB::table('integration_oauth_apps as a')
            ->join('oauth_clients as c', 'c.id', '=', 'a.client_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'a.created_by')
            ->orderByRaw("case a.status when 'active' then 0 else 1 end")
            ->orderBy('c.name')
            ->get(['a.id', 'a.client_id', 'a.vendor', 'a.allowed_scopes', 'a.status', 'a.created_at', 'c.name', 'c.redirect_uris', 'c.grant_types', 'c.updated_at', 'u.name as created_by'])
            ->map(fn (object $row): array => [
                'id' => $row->id,
                'client_id' => $row->client_id,
                'name' => $row->name,
                'vendor' => $row->vendor,
                'scopes' => PgArray::parse($row->allowed_scopes),
                'redirects' => (array) json_decode((string) $row->redirect_uris, true),
                'grant_types' => (array) json_decode((string) $row->grant_types, true),
                'status' => $row->status,
                'created_at' => $row->created_at,
                'created_by' => $row->created_by,
                'last_token_at' => $row->updated_at,
            ])
            ->values()
            ->all();
    }

    public function create(array $data, User $actor): array
    {
        return DB::transaction(function () use ($data, $actor): array {
            $vendor = trim($data['vendor']);

            if (DB::table('integration_oauth_apps')->whereRaw('lower(vendor) = ?', [Str::lower($vendor)])->where('status', 'active')->exists()) {
                throw ApiException::conflict('API-BR-08', 'Ya hay una aplicación activa de ese proveedor. Revócala antes de registrar otra.');
            }

            $secret = $this->secret();
            $clientId = (string) Str::uuid7();
            $appId = (string) Str::uuid7();

            DB::table('oauth_clients')->insert([
                'id' => $clientId,
                'tenant_id' => $this->context->idOrFail(),
                'name' => trim($data['name']),
                'secret' => hash('sha256', $secret),
                'redirect_uris' => json_encode(array_values($data['redirect_uris'])),
                'grant_types' => json_encode(['authorization_code', 'refresh_token']),
                'revoked' => false,
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            DB::table('integration_oauth_apps')->insert([
                'id' => $appId,
                'tenant_id' => $this->context->idOrFail(),
                'client_id' => $clientId,
                'vendor' => $vendor,
                'allowed_scopes' => PgArray::from(array_values($data['scopes'])),
                'status' => 'active',
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log(self::ENTITY, $clientId, 'crear', null, trim($data['name']).' · '.$vendor.' · '.implode(', ', $data['scopes']));

            return ['id' => $appId, 'client_id' => $clientId, 'name' => trim($data['name']), 'secret' => $secret];
        });
    }

    public function rotate(string $id, User $actor): array
    {
        return DB::transaction(function () use ($id, $actor): array {
            $app = $this->find($id);

            if ($app->status !== 'active') {
                throw ApiException::conflict('API-BR-09', 'La aplicación está revocada: registra una nueva en lugar de rotar su secreto.');
            }

            $secret = $this->secret();
            DB::table('oauth_clients')->where('id', $app->client_id)->update(['secret' => hash('sha256', $secret), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log(self::ENTITY, (string) $app->client_id, 'rotar_secreto', null, (string) $app->name);

            return ['id' => $app->id, 'client_id' => $app->client_id, 'name' => $app->name, 'secret' => $secret];
        });
    }

    public function revoke(string $id, User $actor): void
    {
        DB::transaction(function () use ($id, $actor): void {
            $app = $this->find($id);

            if ($app->status !== 'active') {
                throw ApiException::conflict('API-BR-09', 'La aplicación ya estaba revocada.');
            }

            DB::table('integration_oauth_apps')->where('id', $app->id)->update(['status' => 'revoked']);
            DB::table('oauth_clients')->where('id', $app->client_id)->update(['revoked' => true, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log(self::ENTITY, (string) $app->client_id, 'revocar', 'active', 'revoked · '.$app->name);
        });
    }

    public static function scopes(): array
    {
        return array_keys(ApiDirectory::SCOPES);
    }

    private function find(string $id): stdClass
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('La aplicación no existe.');
        }

        return DB::table('integration_oauth_apps as a')->join('oauth_clients as c', 'c.id', '=', 'a.client_id')
            ->where(fn ($query) => $query->where('a.id', $id)->orWhere('a.client_id', $id))
            ->lock('for no key update')
            ->first(['a.id', 'a.client_id', 'a.status', 'c.name'])
            ?? throw ApiException::notFound('La aplicación no existe.');
    }

    private function secret(): string
    {
        return 'kcs_'.Str::random(40);
    }
}
