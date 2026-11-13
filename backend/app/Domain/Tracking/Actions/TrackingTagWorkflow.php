<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Actions;

use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Tracking\Contracts\TrackingSecretVault;
use App\Domain\Tracking\Jobs\VerifyTrackingTag;
use App\Domain\Tracking\Support\TagInput;
use App\Domain\Tracking\Support\TagScope;
use App\Domain\Tracking\Support\TrackingCatalog;
use App\Domain\Tracking\Support\TrackingPlan;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

final class TrackingTagWorkflow
{
    public const CACHE_PREFIX = 'tracking-tags:';

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly TrackingPlan $plan,
        private readonly TrackingSecretVault $vault,
        private readonly TenantContext $context,
    ) {}

    public function create(TagScope $scope, array $data, Authenticatable $actor): string
    {
        $data = TagInput::validate($data, $scope, null);
        $provider = (string) $data['provider'];
        $values = TagInput::columns($data, $scope, null);

        if (! $scope->isPlatform()) {
            $this->plan->assert($provider, (bool) ($values['config']['server_side'] ?? false));
        }

        $this->assertSecret($values, $data, null);

        return $this->write($scope, function () use ($scope, $data, $provider, $values, $actor): string {
            $this->assertUnique($scope, $provider, $values['measurement_id'] ?? null, $values['site'] ?? null, null);
            $code = $this->nextCode($scope);
            $review = $scope->needsReview($provider);
            $submit = $review && (bool) ($data['submit'] ?? false);
            $values['config'] = $this->storeSecret($scope, $code, $data, $values['config']);
            $row = [
                'id' => (string) Str::uuid7(),
                'code' => $code,
                'provider' => $provider,
                ...TagInput::encode($values),
                'status' => $review ? ($submit ? 'en_revision' : 'borrador') : 'activo',
                'submitted_at' => $submit ? now() : null,
                'secret_ref' => isset($data['secret']) ? $this->reference($scope, $code) : null,
                'created_by' => $actor->getAuthIdentifier(),
                'created_at' => now(),
                'updated_at' => now(),
            ];
            $scope->db()->table($scope->tags)->insert($row);
            $this->log($scope, $provider, $code, $submit ? 'enviar_revision' : 'crear', null, $this->summary($provider, $values, $row['status']), $actor);

            return $code;
        });
    }

    public function update(TagScope $scope, string $code, array $data, Authenticatable $actor): array
    {
        return $this->write($scope, function () use ($scope, $code, $data, $actor): array {
            $tag = $this->lock($scope, $code);
            $data = TagInput::validate(Arr::except($data, ['action']), $scope, $tag);
            $values = TagInput::columns($data, $scope, $tag);

            if (! $scope->isPlatform()) {
                $this->plan->assert((string) $tag->provider, (bool) ($values['config']['server_side'] ?? false));
            }

            $this->assertSecret($values, $data, $tag);
            $this->assertUnique($scope, (string) $tag->provider, $values['measurement_id'] ?? $tag->measurement_id, $values['site'] ?? ($tag->site ?? null), (string) $tag->id);
            $values['config'] = $this->storeSecret($scope, $code, $data, $values['config']);
            $before = $this->snapshot($tag);
            $changes = TagInput::codeChanges($values, $tag);
            $pending = false;

            if ($scope->needsReview((string) $tag->provider) && in_array($tag->status, ['activo', 'pausado', 'en_revision'], true) && $changes !== []) {
                if ($tag->status === 'en_revision') {
                    $update = TagInput::encode($values);
                } else {
                    $pending = true;
                    $update = TagInput::encode(Arr::except($values, array_keys($changes)));
                    $update['revision'] = json_encode([...$changes, 'author' => $actor->getAuthIdentifier(), 'at' => now()->toIso8601String()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                    $update['submitted_at'] = now();
                }
            } else {
                $update = TagInput::encode($values);

                if ($tag->status === 'rechazado') {
                    $update['status'] = 'borrador';
                    $update['reject_reason'] = null;
                }
            }

            if (isset($data['secret'])) {
                $update['secret_ref'] = $this->reference($scope, $code);
            }

            $update['lock_version'] = (int) $tag->lock_version + 1;
            $update['updated_at'] = now();
            $scope->db()->table($scope->tags)->where('id', $tag->id)->update($update);
            $this->forget($scope);
            $this->log($scope, (string) $tag->provider, $code, $pending ? 'nueva_revision' : 'editar', $before, $this->snapshot($this->find($scope, $code)), $actor);

            return ['code' => $code, 'pending_revision' => $pending];
        });
    }

    public function delete(TagScope $scope, string $code, Authenticatable $actor): void
    {
        $this->write($scope, function () use ($scope, $code, $actor): void {
            $tag = $this->lock($scope, $code);
            $scope->db()->table($scope->tags)->where('id', $tag->id)->update(['deleted_at' => now(), 'lock_version' => (int) $tag->lock_version + 1, 'updated_at' => now()]);
            $scope->db()->table($scope->mappings)->where('tag_id', $tag->id)->update(['active' => false, 'updated_at' => now()]);
            $this->forget($scope);
            $this->log($scope, (string) $tag->provider, $code, 'eliminar', $this->snapshot($tag), 'eliminada', $actor);
        });
    }

    public function submit(TagScope $scope, string $code, Authenticatable $actor): void
    {
        $this->write($scope, function () use ($scope, $code, $actor): void {
            $tag = $this->lock($scope, $code);

            if (! $scope->needsReview((string) $tag->provider)) {
                throw ApiException::conflict('TAG_NO_REVIEW', 'Las etiquetas estándar se activan al guardarlas; no necesitan revisión.');
            }

            if (! in_array($tag->status, ['borrador', 'rechazado'], true)) {
                throw ApiException::conflict('TAG_NOT_DRAFT', 'Solo se envía a revisión una etiqueta en borrador o rechazada.');
            }

            $scope->db()->table($scope->tags)->where('id', $tag->id)->update(['status' => 'en_revision', 'submitted_at' => now(), 'reject_reason' => null, 'lock_version' => (int) $tag->lock_version + 1, 'updated_at' => now()]);
            $this->log($scope, (string) $tag->provider, $code, 'enviar_revision', $tag->status, 'en_revision', $actor);
        });
    }

    public function decide(TagScope $scope, string $code, string $decision, ?string $reason, Authenticatable $actor, int $admins = 1): array
    {
        return $this->write($scope, function () use ($scope, $code, $decision, $reason, $actor, $admins): array {
            $tag = $this->lock($scope, $code);
            $revision = $tag->revision ? (array) json_decode((string) $tag->revision, true) : null;

            if ($tag->status !== 'en_revision' && $revision === null) {
                throw ApiException::conflict('TAG_NOT_IN_REVIEW', 'Esta etiqueta no tiene cambios por revisar.');
            }

            $author = (string) ($revision['author'] ?? $tag->created_by);
            $self = $author !== '' && $author === (string) $actor->getAuthIdentifier();

            if ($self && ($scope->isPlatform() || $admins >= 2)) {
                throw ApiException::forbidden('SCRIPT_SELF_APPROVAL', $scope->isPlatform() ? 'La etiqueta la aprueba otro Super Admin.' : 'El script lo aprueba otra persona con permiso de aprobación.', [$scope->isPlatform() ? 'admin.tenant.manage' : 'marketing.tracking.approve']);
            }

            if ($decision === 'rechazar') {
                if (mb_strlen(trim((string) $reason)) < 10) {
                    throw ApiException::unprocessable('VALIDATION_ERROR', 'Escribe el motivo del rechazo (10 caracteres o más).', ['field' => 'reason']);
                }

                $update = $revision !== null && $tag->status !== 'en_revision'
                    ? ['revision' => null, 'submitted_at' => null]
                    : ['status' => 'rechazado', 'reject_reason' => trim((string) $reason)];
                $after = $revision !== null && $tag->status !== 'en_revision' ? 'revisión descartada · '.trim((string) $reason) : 'rechazado · '.trim((string) $reason);
                $action = 'rechazar';
            } else {
                $update = ['approved_by' => $actor->getAuthIdentifier(), 'approved_at' => now(), 'reject_reason' => null];

                if ($tag->status === 'en_revision') {
                    $update['status'] = 'activo';
                }

                if ($revision !== null) {
                    $changes = Arr::except($revision, ['author', 'at']);
                    $update = [...$update, ...TagInput::encode($changes), 'revision' => null];

                    if ($author !== '' && $author !== (string) $tag->created_by) {
                        $update['created_by'] = $author;
                    }
                }

                $after = 'activo'.($revision !== null ? ' · revisión aplicada' : '');
                $action = 'aprobar';
            }

            $update['lock_version'] = (int) $tag->lock_version + 1;
            $update['updated_at'] = now();
            $scope->db()->table($scope->tags)->where('id', $tag->id)->update($update);
            $this->forget($scope);
            $this->log($scope, (string) $tag->provider, $code, $action, $tag->status, $after, $actor);

            return ['code' => $code, 'status' => $update['status'] ?? $tag->status];
        });
    }

    public function pause(TagScope $scope, string $code, Authenticatable $actor): string
    {
        return $this->write($scope, function () use ($scope, $code, $actor): string {
            $tag = $this->lock($scope, $code);

            if (! in_array($tag->status, ['activo', 'pausado'], true)) {
                throw ApiException::conflict('TAG_NOT_ACTIVE', 'Solo se pausa o reanuda una etiqueta activa o pausada.');
            }

            $status = $tag->status === 'activo' ? 'pausado' : 'activo';
            $scope->db()->table($scope->tags)->where('id', $tag->id)->update(['status' => $status, 'lock_version' => (int) $tag->lock_version + 1, 'updated_at' => now()]);
            $this->forget($scope);
            $this->log($scope, (string) $tag->provider, $code, $status === 'pausado' ? 'pausar' : 'reanudar', $tag->status, $status, $actor);

            return $status;
        });
    }

    public function verify(TagScope $scope, string $code, Authenticatable $actor): void
    {
        $tag = $this->find($scope, $code);

        if ($tag->status !== 'activo') {
            throw ApiException::conflict('TAG_NOT_ACTIVE', 'La etiqueta no está activa: reanúdala para verificarla.');
        }

        $this->log($scope, (string) $tag->provider, $code, 'verificar', null, 'solicitada', $actor);
        VerifyTrackingTag::dispatch($scope->name, $code, $this->context->id());
    }

    public function find(TagScope $scope, string $code): object
    {
        return $scope->db()->table($scope->tags)->where('code', $code)->whereNull('deleted_at')->first()
            ?? throw ApiException::notFound('La etiqueta no existe.');
    }

    public static function cacheKey(TagScope $scope, ?string $tenantId): string
    {
        return self::CACHE_PREFIX.($scope->isPlatform() ? 'platform' : (string) $tenantId);
    }

    private function lock(TagScope $scope, string $code): object
    {
        return $scope->db()->table($scope->tags)->where('code', $code)->whereNull('deleted_at')->lock('for no key update')->first()
            ?? throw ApiException::notFound('La etiqueta no existe.');
    }

    private function write(TagScope $scope, callable $callback): mixed
    {
        try {
            return $scope->db()->transaction($callback);
        } catch (QueryException $e) {
            if ((string) $e->getCode() === '23505') {
                throw ApiException::conflict('TAG_DUPLICATE', 'Ese ID ya está configurado en otra etiqueta.');
            }

            throw $e;
        }
    }

    private function assertUnique(TagScope $scope, string $provider, ?string $measurementId, ?string $site, ?string $ignore): void
    {
        if ($measurementId === null) {
            return;
        }

        $exists = $scope->db()->table($scope->tags)->where('provider', $provider)->where('measurement_id', $measurementId)
            ->where('status', '<>', 'rechazado')->whereNull('deleted_at')
            ->when($scope->isPlatform() && $site !== null, fn ($query) => $query->where('site', $site))
            ->when($ignore !== null, fn ($query) => $query->where('id', '<>', $ignore))
            ->exists();

        if ($exists) {
            throw ApiException::conflict('TAG_DUPLICATE', 'Ese ID ya está configurado en otra etiqueta.');
        }
    }

    private function assertSecret(array $values, array $data, ?object $tag): void
    {
        $server = (bool) ($values['config']['server_side'] ?? false);

        if ($server && empty($data['secret']) && ($tag->secret_ref ?? null) === null) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Para enviar conversiones desde el servidor guarda el token del proveedor.', ['field' => 'secret']);
        }
    }

    private function storeSecret(TagScope $scope, string $code, array $data, array $config): array
    {
        if (! empty($data['secret'])) {
            $this->vault->put($this->reference($scope, $code), (string) $data['secret']);
            $config['secret_saved_at'] = now()->toIso8601String();
        }

        return $config;
    }

    private function reference(TagScope $scope, string $code): string
    {
        return 'vault://'.($scope->isPlatform() ? 'platform' : 'tenant/'.$this->context->idOrFail()).'/tracking/'.$code;
    }

    private function nextCode(TagScope $scope): string
    {
        $scope->db()->select('select pg_advisory_xact_lock(hashtext(?))', [($scope->isPlatform() ? 'platform' : $this->context->idOrFail()).':'.$scope->tags]);
        $last = $scope->db()->table($scope->tags)->where('code', 'like', $scope->prefix.'%')->orderByRaw('length(code) desc, code desc')->value('code');

        return $scope->prefix.str_pad((string) ((int) substr((string) $last, strlen($scope->prefix)) + 1), 4, '0', STR_PAD_LEFT);
    }

    private function snapshot(object $tag): string
    {
        $rules = (array) json_decode((string) $tag->page_rules, true);

        return mb_substr(implode(' · ', array_filter([
            $tag->measurement_id,
            $tag->script_src,
            $tag->script_body !== null ? 'código en línea '.hash('crc32b', (string) $tag->script_body) : null,
            'páginas '.implode(',', (array) ($rules['include'] ?? [])),
            ($rules['exclude'] ?? []) !== [] ? 'excepto '.implode(',', (array) $rules['exclude']) : null,
            $tag->status,
        ])), 0, 1000);
    }

    private function summary(string $provider, array $values, string $status): string
    {
        return implode(' · ', array_filter([TrackingCatalog::provider($provider)['short'], $values['name'] ?? null, $values['measurement_id'] ?? ($values['script_src'] ?? null), $status]));
    }

    private function forget(TagScope $scope): void
    {
        Cache::forget(self::cacheKey($scope, $this->context->id()));
    }

    private function log(TagScope $scope, string $provider, string $code, string $action, ?string $before, ?string $after, Authenticatable $actor): void
    {
        $this->audit->log($scope->entityFor($provider), $code, $action, $before, $after, actor: $actor, connection: $scope->connection);
    }
}
