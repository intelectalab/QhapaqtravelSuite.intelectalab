<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

final class ManageWebhookDeliveries
{
    public const GRACE_HOURS = 24;

    public const DISABLE_AFTER = 10;

    public function __construct(
        private readonly ManageApiAccess $access,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function rotate(string $code, User $actor): array
    {
        return DB::transaction(function () use ($code, $actor): array {
            $hook = $this->hook($code);
            $secret = 'whsec_'.Str::random(32);
            $expires = CarbonImmutable::now()->addHours(self::GRACE_HOURS);

            DB::table('integration_webhooks')->where('id', $hook->id)->update([
                'previous_secret_encrypted' => $hook->secret_encrypted,
                'previous_secret_expires_at' => $expires,
                'secret_encrypted' => Crypt::encryptString($secret),
                'secret_prefix' => substr($secret, 0, 10),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->audit->log('Webhook', $code, 'rotar_secreto', $hook->secret_prefix.'••••', substr($secret, 0, 10).'•••• · el anterior vale hasta '.$expires->toIso8601String());

            return ['code' => $code, 'secret' => $secret, 'previous_expires_at' => $expires->toIso8601String()];
        });
    }

    public function ping(string $code, User $actor): array
    {
        $hook = $this->hook($code, false);

        if ($hook->status !== 'active') {
            throw ApiException::unprocessable('API-BR-07', 'Activa el webhook antes de enviarle un ping.');
        }

        $eventId = 'evt_'.Str::lower(Str::random(16));
        $payload = ['id' => $eventId, 'type' => 'ping', 'api_version' => $hook->api_version, 'created_at' => now()->toIso8601String(), 'tenant_id' => $this->context->idOrFail(), 'data' => ['webhook' => $hook->code]];
        $delivery = $this->deliver($hook, 'ping', $eventId, null, $payload, true, false);
        $this->audit->log('Webhook', $code, 'ping', null, $delivery['status'].($delivery['http'] ? " · HTTP {$delivery['http']}" : ''));

        return $delivery;
    }

    public function redeliver(string $deliveryCode, User $actor): array
    {
        $original = DB::table('integration_webhook_deliveries')->where('code', $deliveryCode)->first() ?? throw ApiException::notFound('La entrega no existe.');
        $hook = DB::table('integration_webhooks')->where('id', $original->webhook_id)->where('status', '<>', 'deleted')->first() ?? throw ApiException::notFound('El webhook de esta entrega ya no existe.');

        if ($hook->status === 'paused') {
            throw ApiException::unprocessable('API-BR-07', 'El webhook está pausado: reanúdalo para reenviar.');
        }

        $payload = (array) json_decode((string) $original->payload, true);
        $delivery = $this->deliver($hook, (string) $original->event_type, (string) $original->event_id, $original->entity_code, $payload, true, true);
        $this->audit->log('Webhook', $hook->code, 'reenviar', $deliveryCode, "{$delivery['code']} · {$delivery['status']}");

        return $delivery;
    }

    public function detail(string $code): array
    {
        $row = DB::table('integration_webhook_deliveries as d')->join('integration_webhooks as w', 'w.id', '=', 'd.webhook_id')->where('d.code', $code)
            ->first(['d.code', 'd.event_type', 'd.event_id', 'd.entity_code', 'd.payload', 'd.attempt', 'd.status', 'd.http_status', 'd.duration_ms', 'd.response_excerpt', 'd.error', 'd.next_retry_at', 'd.manual', 'd.created_at', 'w.code as webhook', 'w.url', 'w.api_version'])
            ?? throw ApiException::notFound('La entrega no existe.');
        $retries = DB::table('integration_webhook_deliveries')->where('event_id', $row->event_id)->where('code', '<>', $row->code)->orderByDesc('created_at')->limit(10)->get(['code', 'status', 'http_status', 'manual', 'created_at']);

        return [
            'code' => $row->code,
            'webhook' => $row->webhook,
            'url' => $row->url,
            'event' => $row->event_type,
            'event_id' => $row->event_id,
            'entity' => $row->entity_code,
            'attempt' => (int) $row->attempt,
            'status' => $row->status,
            'http' => $row->http_status !== null ? (int) $row->http_status : null,
            'ms' => $row->duration_ms !== null ? (int) $row->duration_ms : null,
            'error' => $row->error,
            'response' => $row->response_excerpt,
            'next_retry_at' => $row->next_retry_at,
            'manual' => (bool) $row->manual,
            'at' => $row->created_at,
            'payload' => json_decode((string) $row->payload, true),
            'headers' => [
                'Content-Type' => 'application/json',
                'User-Agent' => 'KipuControl-Webhooks/1.0',
                'KipuControl-Event-Id' => $row->event_id,
                'KipuControl-Event-Type' => $row->event_type,
                'KipuControl-Delivery-Id' => $row->code,
                'KipuControl-Signature' => 't={unix},v1={hmac_sha256(secreto, t + "." + cuerpo)}',
            ],
            'related' => $retries->map(fn (object $item): array => ['code' => $item->code, 'status' => $item->status, 'http' => $item->http_status !== null ? (int) $item->http_status : null, 'manual' => (bool) $item->manual, 'at' => $item->created_at])->values()->all(),
        ];
    }

    private function deliver(object $hook, string $type, string $eventId, ?string $entity, array $payload, bool $manual, bool $counts): array
    {
        $this->access->assertSafeUrl((string) $hook->url);
        $code = $this->nextCode();
        $body = (string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $time = time();
        $signatures = array_map(fn (string $secret): string => 'v1='.hash_hmac('sha256', $time.'.'.$body, $secret), $this->secrets($hook));
        $started = microtime(true);
        $http = null;
        $excerpt = null;
        $error = null;

        try {
            $response = Http::withoutRedirecting()->timeout(10)->connectTimeout(10)
                ->withHeaders([
                    'User-Agent' => 'KipuControl-Webhooks/1.0',
                    'KipuControl-Event-Id' => $eventId,
                    'KipuControl-Event-Type' => $type,
                    'KipuControl-Delivery-Id' => $code,
                    'KipuControl-Signature' => "t={$time},".implode(',', $signatures),
                ])
                ->withBody($body, 'application/json')
                ->post((string) $hook->url);
            $http = $response->status();
            $excerpt = mb_substr($response->body(), 0, 2000);
            $error = $response->successful() ? null : "HTTP {$http}";
        } catch (Throwable $exception) {
            $error = mb_substr(class_basename($exception).': '.$exception->getMessage(), 0, 300);
        }

        $ms = (int) round((microtime(true) - $started) * 1000);
        $ok = $http !== null && $http >= 200 && $http < 300;
        DB::table('integration_webhook_deliveries')->insert([
            'id' => (string) Str::uuid7(),
            'code' => $code,
            'webhook_id' => $hook->id,
            'event_type' => $type,
            'event_id' => $eventId,
            'entity_code' => $entity,
            'payload' => $body,
            'attempt' => 1,
            'status' => $ok ? 'delivered' : 'failed',
            'http_status' => $http,
            'duration_ms' => $ms,
            'response_excerpt' => $excerpt,
            'error' => $error,
            'manual' => $manual,
            'created_at' => now(),
        ]);

        if ($counts) {
            $failures = $ok ? 0 : (int) $hook->consecutive_failures + 1;
            $disable = ! $ok && ($http === 410 || $failures >= self::DISABLE_AFTER);
            DB::table('integration_webhooks')->where('id', $hook->id)->update([
                'consecutive_failures' => $failures,
                'status' => $disable ? 'disabled' : $hook->status,
                'disabled_reason' => $disable ? ($http === 410 ? 'El destino respondió 410 (ya no existe)' : self::DISABLE_AFTER.' fallos seguidos') : $hook->disabled_reason,
                'updated_at' => now(),
            ]);
        }

        return ['code' => $code, 'status' => $ok ? 'delivered' : 'failed', 'http' => $http, 'ms' => $ms, 'error' => $error];
    }

    private function secrets(object $hook): array
    {
        $secrets = [Crypt::decryptString((string) $hook->secret_encrypted)];

        if ($hook->previous_secret_encrypted && $hook->previous_secret_expires_at && CarbonImmutable::parse((string) $hook->previous_secret_expires_at)->isFuture()) {
            $secrets[] = Crypt::decryptString((string) $hook->previous_secret_encrypted);
        }

        return $secrets;
    }

    private function nextCode(): string
    {
        DB::select('select pg_advisory_xact_lock(hashtext(?))', ["{$this->context->idOrFail()}:integration_webhook_deliveries:code"]);
        $last = DB::table('integration_webhook_deliveries')->where('code', 'like', 'WHD-%')->selectRaw('max(cast(substring(code from 5) as bigint)) as n')->whereRaw("substring(code from 5) ~ '^[0-9]+$'")->value('n');

        return 'WHD-'.str_pad((string) ((int) $last + 1), 6, '0', STR_PAD_LEFT);
    }

    private function hook(string $code, bool $lock = true): object
    {
        $query = DB::table('integration_webhooks')->where('code', $code)->where('status', '<>', 'deleted');

        return ($lock ? $query->lockForUpdate() : $query)->first() ?? throw ApiException::notFound('El webhook no existe.');
    }
}
