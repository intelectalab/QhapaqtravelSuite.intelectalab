<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Actions;

use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Tracking\Contracts\ConversionGateway;
use App\Domain\Tracking\Support\TagScope;
use App\Domain\Tracking\Support\TrackingCatalog;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

final class ConversionWorkflow
{
    public const MAX_ATTEMPTS = 10;

    public function __construct(private readonly AuditLogger $audit, private readonly ConversionGateway $gateway) {}

    public function map(TagScope $scope, string $tagCode, string $event, array $data, Authenticatable $actor): array
    {
        $events = $scope->events();

        if (! isset($events[$event])) {
            throw ApiException::notFound('Ese evento no existe.');
        }

        $data = Validator::make($data, [
            'provider_event' => ['required', 'string', 'min:2', 'max:80'],
            'conversion_label' => ['nullable', 'string', 'max:60'],
            'send_value' => ['nullable', 'boolean'],
            'server_side' => ['nullable', 'boolean'],
            'active' => ['nullable', 'boolean'],
        ], [
            'provider_event.*' => 'Escribe el nombre del evento en el proveedor.',
            'conversion_label.max' => 'La etiqueta de conversión admite hasta 60 caracteres.',
        ])->validate();

        return $scope->db()->transaction(function () use ($scope, $tagCode, $event, $data, $actor, $events): array {
            $tag = $this->tag($scope, $tagCode);
            $provider = (string) $tag->provider;
            $config = (array) json_decode((string) $tag->config, true);
            $label = trim((string) ($data['conversion_label'] ?? '')) ?: null;

            if (in_array($provider, ['script', 'gtm'], true) || $tag->status === 'rechazado') {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Esta etiqueta no recibe conversiones.');
            }

            if ($provider === 'google_ads' && ($label === null || preg_match('/^[A-Za-z0-9_-]{6,60}$/', $label) !== 1)) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Google Ads necesita la etiqueta de la conversión (Objetivos › Conversiones).', ['field' => 'conversion_label']);
            }

            $server = (bool) ($data['server_side'] ?? false);

            if ($server && (! TrackingCatalog::supportsServer($provider) || ! ($config['server_side'] ?? false))) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Activa el envío desde el servidor en la etiqueta antes de usarlo en una conversión.', ['field' => 'server_side']);
            }

            $current = $scope->db()->table($scope->mappings)->where('tag_id', $tag->id)->where('internal_event', $event)->lock('for no key update')->first();
            $values = [
                'provider_event' => trim((string) $data['provider_event']),
                'conversion_label' => $provider === 'google_ads' ? $label : null,
                'send_value' => (bool) ($data['send_value'] ?? $events[$event]['value']),
                'server_side' => $server,
                'active' => (bool) ($data['active'] ?? true),
                'updated_at' => now(),
            ];

            if ($current === null) {
                $scope->db()->table($scope->mappings)->insert(['id' => (string) Str::uuid7(), 'tag_id' => $tag->id, 'internal_event' => $event, ...$values, 'created_at' => now()]);
            } else {
                $scope->db()->table($scope->mappings)->where('id', $current->id)->update($values);
            }

            $before = $current ? "{$current->provider_event}".($current->active ? '' : ' (inactivo)') : null;
            $this->audit->log('Conversión', "{$tagCode}/{$event}", $current ? 'editar' : 'configurar', $before, $events[$event]['label'].' → '.TrackingCatalog::provider($provider)['short'].' '.$values['provider_event'].($server ? ' · servidor' : ''), actor: $actor, connection: $scope->connection);

            return ['tag' => $tagCode, 'event' => $event, ...$values];
        });
    }

    public function unmap(TagScope $scope, string $tagCode, string $event, Authenticatable $actor): void
    {
        $scope->db()->transaction(function () use ($scope, $tagCode, $event, $actor): void {
            $tag = $this->tag($scope, $tagCode);
            $mapping = $scope->db()->table($scope->mappings)->where('tag_id', $tag->id)->where('internal_event', $event)->where('active', true)->lock('for no key update')->first()
                ?? throw ApiException::notFound('Ese evento no se envía a esta etiqueta.');
            $scope->db()->table($scope->mappings)->where('id', $mapping->id)->update(['active' => false, 'updated_at' => now()]);
            $this->audit->log('Conversión', "{$tagCode}/{$event}", 'quitar', (string) $mapping->provider_event, null, actor: $actor, connection: $scope->connection);
        });
    }

    public function record(TagScope $scope, string $event, string $eventId, ?string $value = null, ?string $currency = null, bool $marketingConsent = false, array $context = []): array
    {
        $mappings = $scope->db()->table($scope->mappings.' as m')->join($scope->tags.' as t', 't.id', '=', 'm.tag_id')
            ->where('m.internal_event', $event)->where('m.active', true)->where('m.server_side', true)
            ->where('t.status', 'activo')->whereNull('t.deleted_at')
            ->get(['m.id', 'm.provider_event', 'm.send_value', 't.provider', 't.secret_ref', 't.code']);
        $results = [];

        foreach ($mappings as $mapping) {
            $row = [
                'event_id' => $eventId,
                'mapping_id' => $mapping->id,
                'internal_event' => $event,
                'channel' => 'servidor',
                'status' => $marketingConsent ? 'pendiente' : 'sin_consentimiento',
                'value' => $mapping->send_value ? $value : null,
                'currency' => $mapping->send_value && $value !== null ? ($currency ?? 'PEN') : null,
                'occurred_at' => now(),
                ...($scope->isPlatform() ? ['agency_id' => $context['agency_id'] ?? null] : ['order_id' => $context['order_id'] ?? null]),
            ];

            try {
                $id = $scope->db()->transaction(fn () => $scope->db()->table($scope->dispatches)->insertGetId($row));
            } catch (QueryException $e) {
                if ((string) $e->getCode() !== '23505') {
                    throw $e;
                }

                $results[] = ['mapping' => $mapping->code, 'status' => 'duplicado'];

                continue;
            }

            $results[] = ['mapping' => $mapping->code, 'status' => $marketingConsent ? $this->deliver($scope, (int) $id, (string) ($context['reference'] ?? $eventId)) : 'sin_consentimiento'];
        }

        return $results;
    }

    public function retry(TagScope $scope, string $id, Authenticatable $actor): array
    {
        return $scope->db()->transaction(function () use ($scope, $id, $actor): array {
            $dispatch = ctype_digit($id) ? $scope->db()->table($scope->dispatches)->where('id', (int) $id)->lock('for no key update')->first() : null;

            if ($dispatch === null) {
                throw ApiException::notFound('El envío no existe.');
            }

            if ($dispatch->status !== 'fallido') {
                throw ApiException::conflict('DISPATCH_NOT_FAILED', 'Solo se reintenta un envío fallido.');
            }

            if ((int) $dispatch->attempts >= self::MAX_ATTEMPTS) {
                throw ApiException::conflict('DISPATCH_MAX_ATTEMPTS', 'El envío ya llegó a 10 intentos. Revisa la etiqueta y su token.');
            }

            $scope->db()->table($scope->dispatches)->where('id', $dispatch->id)->update(['status' => 'pendiente', 'error' => null]);
            $status = $this->deliver($scope, (int) $dispatch->id, (string) $dispatch->event_id);
            $this->audit->log('Conversión', (string) $dispatch->id, 'reintentar', 'fallido', $status, actor: $actor, connection: $scope->connection);

            return ['id' => (int) $dispatch->id, 'status' => $status];
        });
    }

    private function deliver(TagScope $scope, int $id, string $reference): string
    {
        $row = $scope->db()->table($scope->dispatches.' as d')->join($scope->mappings.' as m', 'm.id', '=', 'd.mapping_id')->join($scope->tags.' as t', 't.id', '=', 'm.tag_id')
            ->where('d.id', $id)->first(['d.*', 'm.provider_event', 'm.conversion_label', 't.provider', 't.measurement_id', 't.secret_ref']);
        $result = $this->gateway->send((string) $row->provider, [
            'event_id' => $row->event_id,
            'event_name' => $row->provider_event,
            'conversion_label' => $row->conversion_label,
            'measurement_id' => $row->measurement_id,
            'value' => $row->value,
            'currency' => $row->currency,
            'secret_ref' => $row->secret_ref,
            'reference' => $reference,
            'action_source' => 'website',
        ]);
        $status = $result->ok ? 'enviado' : 'fallido';
        $scope->db()->table($scope->dispatches)->where('id', $id)->update([
            'status' => $status,
            'attempts' => min(self::MAX_ATTEMPTS, (int) $row->attempts + 1),
            'http_status' => $result->payload['http_status'] ?? null,
            'error' => $result->ok ? null : mb_substr((string) $result->message, 0, 300),
            'sent_at' => $result->ok ? now() : null,
        ]);

        return $status;
    }

    private function tag(TagScope $scope, string $code): object
    {
        return $scope->db()->table($scope->tags)->where('code', $code)->whereNull('deleted_at')->first()
            ?? throw ApiException::notFound('La etiqueta no existe.');
    }
}
