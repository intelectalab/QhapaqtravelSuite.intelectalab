<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;

final class PayloadWebhook
{
    public const KEY = 'payload_webhook';

    public const ACTIVITY_KEY = 'payload_webhook_activity';

    public const PATH = '/api/v1/platform/blog/webhooks/payload';

    public const SIGNATURE_HEADER = 'X-Kipu-Signature';

    public const TIMESTAMP_HEADER = 'X-Kipu-Timestamp';

    public const ROTATION_HOURS = 24;

    public const TOLERANCE_SECONDS = 300;

    private const REJECTIONS_KEY = 'payload-webhook:rejections';

    private const REJECTIONS_CAP = 500;

    public function raw(): array
    {
        return PlatformSettings::read(self::KEY);
    }

    public function activity(): array
    {
        return PlatformSettings::read(self::ACTIVITY_KEY);
    }

    public function adminUrl(): string
    {
        return (string) ($this->raw()['admin_url'] ?? '') ?: (string) config('seguimiento.payload.admin_url', '');
    }

    public function secret(): string
    {
        return $this->decrypt((string) ($this->raw()['secret'] ?? ''));
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

    public function configured(): bool
    {
        return $this->secret() !== '';
    }

    public function signedWith(string $timestamp, string $payload, string $signature): ?string
    {
        if ($signature === '' || ! ctype_digit($timestamp) || abs(time() - (int) $timestamp) > self::TOLERANCE_SECONDS) {
            return null;
        }

        foreach (['actual' => $this->secret(), 'anterior' => $this->previousSecret()] as $key => $secret) {
            if ($secret !== '' && hash_equals('sha256='.hash_hmac('sha256', $timestamp.'.'.$payload, $secret), $signature)) {
                return $key;
            }
        }

        return null;
    }

    public function storeAdminUrl(string $url, string $actorId): void
    {
        PlatformSettings::write(self::KEY, [...$this->raw(), 'admin_url' => $url, 'changed_at' => now()->utc()->toIso8601String()], $actorId);
    }

    public function storeSecret(string $secret, string $actorId): bool
    {
        $raw = $this->raw();
        $current = $this->secret();
        $rotated = $current !== '';
        $now = now()->utc();

        PlatformSettings::write(self::KEY, [
            ...$raw,
            'secret' => Crypt::encryptString($secret),
            'previous_secret' => $rotated ? Crypt::encryptString($current) : '',
            'previous_until' => $rotated ? $now->copy()->addHours(self::ROTATION_HOURS)->toIso8601String() : null,
            'secret_generated_at' => $now->toIso8601String(),
            'secret_rotated_at' => $rotated ? $now->toIso8601String() : ($raw['secret_rotated_at'] ?? null),
            'changed_at' => $now->toIso8601String(),
        ], $actorId);

        return $rotated;
    }

    public function recordSigned(string $key, string $event, string $slug, string $title): void
    {
        $now = now()->utc()->toIso8601String();
        $activity = $this->activity();

        PlatformSettings::write(self::ACTIVITY_KEY, [
            ...$activity,
            'last_signed' => ['at' => $now, 'event' => $event, 'slug' => $slug, 'title' => $title, 'key' => $key],
            'current_seen_at' => $key === 'actual' ? $now : ($activity['current_seen_at'] ?? null),
        ], null);
    }

    public function recordRejection(): void
    {
        $since = now()->subDay()->getTimestamp();
        $list = array_values(array_filter((array) Cache::get(self::REJECTIONS_KEY, []), fn (mixed $at): bool => is_int($at) && $at >= $since));
        $list[] = now()->getTimestamp();

        Cache::put(self::REJECTIONS_KEY, array_slice($list, -self::REJECTIONS_CAP), now()->addDay());
    }

    public function rejections(): array
    {
        $since = now()->subDay()->getTimestamp();
        $list = array_values(array_filter((array) Cache::get(self::REJECTIONS_KEY, []), fn (mixed $at): bool => is_int($at) && $at >= $since));

        return ['count' => count($list), 'last_at' => $list === [] ? null : CarbonImmutable::createFromTimestampUTC((int) max($list))->toIso8601String()];
    }

    public function summary(): array
    {
        $raw = $this->raw();
        $activity = $this->activity();
        $secret = $this->secret();
        $rotatedAt = $raw['secret_rotated_at'] ?? null;
        $seenAt = $activity['current_seen_at'] ?? null;
        $previousUntil = $raw['previous_until'] ?? null;
        $last = isset($activity['last_signed']) ? (array) $activity['last_signed'] : null;
        $rejections = $this->rejections();

        return [
            'status' => $secret === '' ? 'sin_clave' : 'lista',
            'admin_url' => $this->adminUrl(),
            'secret_set' => $secret !== '',
            'secret_hint' => $secret === '' ? null : '••••'.substr($secret, -4),
            'secret_generated_at' => $raw['secret_generated_at'] ?? null,
            'secret_rotated_at' => $rotatedAt,
            'previous_secret_until' => is_string($rotatedAt) ? $previousUntil : null,
            'previous_secret_valid' => $this->previousSecret() !== '',
            'still_previous' => is_string($rotatedAt) && (! is_string($seenAt) || CarbonImmutable::parse($seenAt)->lt(CarbonImmutable::parse($rotatedAt))),
            'last_signed' => $last,
            'rejections_24h' => $rejections['count'],
            'last_rejection_at' => $rejections['last_at'],
            'callback_url' => rtrim((string) config('app.url'), '/').self::PATH,
            'signature_header' => self::SIGNATURE_HEADER,
            'timestamp_header' => self::TIMESTAMP_HEADER,
            'changed_at' => $raw['changed_at'] ?? null,
        ];
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
