<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Integrations\Fake\FakeFiscalGateway;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

final class FiscalWebhookSecret
{
    public const KEY = 'fiscal_provider';

    public const ACTIVITY_KEY = 'fiscal_provider_activity';

    public const ROTATION_HOURS = 24;

    public function record(string $code): array
    {
        return (array) ((PlatformSettings::read(self::KEY)['providers'] ?? [])[$this->code($code)] ?? []);
    }

    public function secret(string $code): string
    {
        return $this->decrypt((string) ($this->record($code)['secret'] ?? ''));
    }

    public function previousSecret(string $code): string
    {
        $record = $this->record($code);
        $until = $record['previous_until'] ?? null;

        if (! is_string($until) || CarbonImmutable::parse($until)->isPast()) {
            return '';
        }

        return $this->decrypt((string) ($record['previous_secret'] ?? ''));
    }

    public function secrets(string $code): array
    {
        return array_filter(['actual' => $this->secret($code), 'anterior' => $this->previousSecret($code)], fn (string $secret): bool => $secret !== '');
    }

    public function store(string $code, string $secret, ?string $actorId): bool
    {
        $code = $this->code($code);
        $providers = (array) (PlatformSettings::read(self::KEY)['providers'] ?? []);
        $record = (array) ($providers[$code] ?? []);
        $current = $this->secret($code);
        $rotated = $current !== '';
        $now = now()->utc();

        $providers[$code] = [
            ...$record,
            'secret' => Crypt::encryptString($secret),
            'previous_secret' => $rotated ? Crypt::encryptString($current) : '',
            'previous_until' => $rotated ? $now->copy()->addHours(self::ROTATION_HOURS)->toIso8601String() : null,
            'secret_generated_at' => $now->toIso8601String(),
            'secret_rotated_at' => $rotated ? $now->toIso8601String() : ($record['secret_rotated_at'] ?? null),
        ];
        PlatformSettings::write(self::KEY, ['providers' => $providers], $actorId);

        return $rotated;
    }

    public function forget(string $code, string $actorId): void
    {
        $code = $this->code($code);
        $providers = (array) (PlatformSettings::read(self::KEY)['providers'] ?? []);

        if (array_key_exists($code, $providers)) {
            unset($providers[$code]);
            PlatformSettings::write(self::KEY, ['providers' => $providers], $actorId);
        }
    }

    public function signedWith(string $code, string $rawBody, string $signature, callable $verify): ?string
    {
        foreach ($this->secrets($code) as $key => $secret) {
            if ($verify($rawBody, $signature, $secret)) {
                return $key;
            }
        }

        return null;
    }

    public function recordSigned(string $code, string $key): void
    {
        $code = $this->code($code);
        $activity = PlatformSettings::read(self::ACTIVITY_KEY);
        $now = now()->utc()->toIso8601String();
        $current = (array) ($activity[$code] ?? []);

        PlatformSettings::write(self::ACTIVITY_KEY, [
            ...$activity,
            $code => ['last_signed_at' => $now, 'last_key' => $key, 'current_seen_at' => $key === 'actual' ? $now : ($current['current_seen_at'] ?? null)],
        ], null);
    }

    public function summary(string $code): array
    {
        $record = $this->record($code);
        $activity = (array) (PlatformSettings::read(self::ACTIVITY_KEY)[$this->code($code)] ?? []);
        $secret = $this->secret($code);
        $rotatedAt = $record['secret_rotated_at'] ?? null;
        $seenAt = $activity['current_seen_at'] ?? null;

        return [
            'secret_set' => $secret !== '',
            'secret_hint' => $secret === '' ? null : '••••'.substr($secret, -4),
            'secret_generated_at' => $record['secret_generated_at'] ?? null,
            'previous_secret_until' => is_string($rotatedAt) ? ($record['previous_until'] ?? null) : null,
            'previous_secret_valid' => $this->previousSecret($code) !== '',
            'still_previous' => is_string($rotatedAt) && (! is_string($seenAt) || CarbonImmutable::parse($seenAt)->lt(CarbonImmutable::parse($rotatedAt))),
            'last_signed_at' => $activity['last_signed_at'] ?? null,
            'last_key' => $activity['last_key'] ?? null,
            'callback_url' => $this->callbackUrl($code),
            'signature_header' => FakeFiscalGateway::SIGNATURE_HEADER,
        ];
    }

    public function callbackUrl(string $code): string
    {
        return rtrim((string) config('app.url'), '/').'/api/v1/integrations/fiscal/'.strtolower($this->code($code)).'/webhook';
    }

    private function code(string $code): string
    {
        return strtoupper(trim($code));
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
