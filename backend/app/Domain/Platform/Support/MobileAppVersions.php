<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class MobileAppVersions
{
    public const KEY = 'mobile_app';

    public const PLATFORMS = ['ios' => 'iOS', 'android' => 'Android'];

    public const VERSION_PATTERN = '/^\d{1,3}(\.\d{1,3}){0,2}$/';

    public const VERSION_HEADER = 'X-App-Version';

    public const PLATFORM_HEADER = 'X-App-Platform';

    public const UPGRADE_CODE = 'APP_UPDATE_REQUIRED';

    private const CACHE_KEY = 'platform:mobile_app_versions';

    private ?array $raw = null;

    public function raw(): array
    {
        return $this->raw ??= (array) Cache::remember(self::CACHE_KEY, 300, fn (): array => PlatformSettings::read(self::KEY));
    }

    public function platform(string $platform): array
    {
        $stored = (array) ($this->raw()[$platform] ?? []);

        return [
            'platform' => $platform,
            'label' => self::PLATFORMS[$platform] ?? $platform,
            'min_version' => isset($stored['min_version']) && $stored['min_version'] !== '' ? (string) $stored['min_version'] : null,
            'store_url' => isset($stored['store_url']) && $stored['store_url'] !== '' ? (string) $stored['store_url'] : null,
        ];
    }

    public function summary(): array
    {
        $row = DB::connection('pgsql_platform')->table('platform_settings')->where('key', self::KEY)->first(['updated_at', 'lock_version']);

        return [
            'platforms' => array_map(fn (string $platform): array => $this->platform($platform), array_keys(self::PLATFORMS)),
            'updated_at' => $row?->updated_at,
            'lock_version' => (int) ($row->lock_version ?? 0),
        ];
    }

    public function store(array $platforms, string $actorId): void
    {
        $value = [];

        foreach (array_keys(self::PLATFORMS) as $platform) {
            $value[$platform] = ['min_version' => $platforms[$platform]['min_version'] ?? null, 'store_url' => $platforms[$platform]['store_url'] ?? null];
        }

        PlatformSettings::write(self::KEY, $value, $actorId);
        Cache::forget(self::CACHE_KEY);
        $this->raw = $value;
    }

    public function requirement(?string $platform, ?string $version): ?array
    {
        if ($platform === null || $version === null || ! isset(self::PLATFORMS[$platform]) || preg_match(self::VERSION_PATTERN, $version) !== 1) {
            return null;
        }

        $config = $this->platform($platform);

        return $config['min_version'] !== null && self::older($version, $config['min_version']) ? $config : null;
    }

    public static function older(string $version, string $minimum): bool
    {
        return version_compare(self::normalize($version), self::normalize($minimum), '<');
    }

    private static function normalize(string $version): string
    {
        return implode('.', array_pad(array_map('intval', explode('.', $version)), 3, 0));
    }
}
