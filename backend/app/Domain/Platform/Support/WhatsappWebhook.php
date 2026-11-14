<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Integrations\Support\ChannelWebhooks;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

final class WhatsappWebhook
{
    public const KEY = 'whatsapp_webhook';

    public const PATH = '/api/v1/integrations/whatsapp/webhook';

    public const API_VERSION = 'v21.0';

    public const ROTATION_HOURS = 24;

    public function raw(): array
    {
        return PlatformSettings::read(self::KEY);
    }

    public function verifyToken(): string
    {
        return $this->decrypt((string) ($this->raw()['verify_token'] ?? ''));
    }

    public function matches(string $candidate): bool
    {
        $token = $this->verifyToken();

        return $token !== '' && $candidate !== '' && hash_equals($token, $candidate);
    }

    public function appId(): string
    {
        return (string) ($this->raw()['app_id'] ?? '');
    }

    public function appSecret(): string
    {
        return $this->decrypt((string) ($this->raw()['app_secret'] ?? ''));
    }

    public function previousSecret(): string
    {
        $raw = $this->raw();
        $until = $raw['previous_until'] ?? null;

        if (! is_string($until) || CarbonImmutable::parse($until)->isPast()) {
            return '';
        }

        return $this->decrypt((string) ($raw['previous_secret'] ?? ''));
    }

    public function apiVersion(): string
    {
        return (string) ($this->raw()['api_version'] ?? '') ?: self::API_VERSION;
    }

    public function ready(): bool
    {
        return $this->appId() !== '' && $this->appSecret() !== '';
    }

    public function signedByPlatform(string $raw, string $signature): bool
    {
        $signature = str_starts_with($signature, 'sha256=') ? $signature : 'sha256='.$signature;

        if ($signature === 'sha256=') {
            return false;
        }

        foreach (array_filter([$this->appSecret(), $this->previousSecret()]) as $secret) {
            if (hash_equals(ChannelWebhooks::sign($raw, $secret), $signature)) {
                return true;
            }
        }

        return false;
    }

    public function summary(): array
    {
        $raw = $this->raw();

        return [
            'verify_token_set' => $this->verifyToken() !== '',
            'callback_url' => rtrim((string) config('app.url'), '/').self::PATH,
            'changed_at' => $raw['changed_at'] ?? null,
        ];
    }

    public function app(bool $simulated): array
    {
        $raw = $this->raw();
        $secret = $this->appSecret();
        $previous = $this->previousSecret();

        return [
            ...$this->summary(),
            'status' => match (true) {
                $this->ready() && $this->verifyToken() !== '' => 'lista',
                $this->appId() !== '' || $secret !== '' || $this->verifyToken() !== '' => 'incompleta',
                default => 'sin_configurar',
            },
            'app_id' => $this->appId(),
            'app_secret_set' => $secret !== '',
            'app_secret_hint' => $secret === '' ? null : '••••'.substr($secret, -4),
            'config_id' => (string) ($raw['config_id'] ?? ''),
            'api_version' => $this->apiVersion(),
            'secret_rotated_at' => $raw['secret_rotated_at'] ?? null,
            'previous_secret_until' => $previous !== '' ? ($raw['previous_until'] ?? null) : null,
            'last_test' => isset($raw['last_test']) ? (array) $raw['last_test'] : null,
            'signature_header' => ChannelWebhooks::SIGNATURE_HEADER,
            'simulated' => $simulated,
        ];
    }

    public function store(?string $token, string $actorId): void
    {
        PlatformSettings::write(self::KEY, [
            ...$this->raw(),
            'verify_token' => $token === null ? '' : Crypt::encryptString($token),
            'changed_at' => now()->toIso8601String(),
        ], $actorId);
    }

    public function storeApp(array $values, ?string $secret, ?string $token, string $actorId): void
    {
        $raw = $this->raw();
        $current = $this->appSecret();
        $rotated = $secret !== null && $current !== '' && $secret !== $current;

        PlatformSettings::write(self::KEY, [
            ...$raw,
            ...$values,
            'app_secret' => $secret === null ? ($raw['app_secret'] ?? '') : Crypt::encryptString($secret),
            'verify_token' => $token === null ? ($raw['verify_token'] ?? '') : Crypt::encryptString($token),
            'previous_secret' => $rotated ? Crypt::encryptString($current) : ($raw['previous_secret'] ?? ''),
            'previous_until' => $rotated ? now()->addHours(self::ROTATION_HOURS)->utc()->toIso8601String() : ($raw['previous_until'] ?? null),
            'secret_rotated_at' => $rotated ? now()->utc()->toIso8601String() : ($raw['secret_rotated_at'] ?? null),
            'changed_at' => now()->toIso8601String(),
        ], $actorId);
    }

    public function recordTest(bool $ok, string $message, string $actorId): void
    {
        PlatformSettings::write(self::KEY, [...$this->raw(), 'last_test' => ['ok' => $ok, 'message' => $message, 'at' => now()->utc()->toIso8601String()]], $actorId);
    }

    private function decrypt(string $encrypted): string
    {
        if ($encrypted === '') {
            return '';
        }

        try {
            return Crypt::decryptString($encrypted);
        } catch (DecryptException) {
            return '';
        }
    }
}
