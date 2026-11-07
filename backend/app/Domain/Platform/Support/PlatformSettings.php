<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Support\Facades\DB;

final class PlatformSettings
{
    public const KEY = 'billing';

    public const NOTICE_DEFAULTS = ['trial_days' => [7, 3, 1], 'usage_warn_pct' => 80, 'api_key_days' => 7];

    private const CONNECTION = 'pgsql_platform';

    private const DEFAULTS = [
        'igv_pct' => 18,
        'currency' => 'PEN',
        'dunning' => ['retry_days' => [1, 3, 7], 'suspend_after_last' => true],
        'issuer' => ['name' => '', 'ruc' => '', 'address' => '', 'email' => '', 'web' => ''],
        'notices' => self::NOTICE_DEFAULTS,
    ];

    private ?array $values = null;

    public function all(): array
    {
        if ($this->values !== null) {
            return $this->values;
        }

        $raw = DB::connection(self::CONNECTION)->table('platform_settings')->where('key', self::KEY)->value('value');

        return $this->values = array_replace(self::DEFAULTS, $raw ? (array) json_decode((string) $raw, true) : []);
    }

    public function dunning(): array
    {
        $policy = $this->all()['dunning'];

        return ['retry_days' => array_map('intval', $policy['retry_days']), 'suspend_after_last' => (bool) $policy['suspend_after_last']];
    }

    public function igv(): float
    {
        return (float) $this->all()['igv_pct'];
    }

    public function issuer(): array
    {
        return [...self::DEFAULTS['issuer'], ...(array) $this->all()['issuer']];
    }

    public function notices(): array
    {
        $notices = [...self::NOTICE_DEFAULTS, ...(array) $this->all()['notices']];

        return ['trial_days' => array_values(array_map('intval', (array) $notices['trial_days'])), 'usage_warn_pct' => (int) $notices['usage_warn_pct'], 'api_key_days' => (int) $notices['api_key_days']];
    }

    public function version(): int
    {
        return (int) (DB::connection(self::CONNECTION)->table('platform_settings')->where('key', self::KEY)->value('lock_version') ?? 0);
    }

    public function updatedAt(): ?string
    {
        $value = DB::connection(self::CONNECTION)->table('platform_settings')->where('key', self::KEY)->value('updated_at');

        return $value === null ? null : (string) $value;
    }

    public function put(string $key, mixed $value, ?string $actorId): void
    {
        $values = [...$this->all(), $key => $value];
        $query = DB::connection(self::CONNECTION)->table('platform_settings')->where('key', self::KEY);
        $payload = ['value' => json_encode($values, JSON_UNESCAPED_UNICODE), 'updated_by' => $actorId, 'updated_at' => now()];

        if ($query->exists()) {
            $query->update([...$payload, 'lock_version' => DB::raw('lock_version + 1')]);
        } else {
            DB::connection(self::CONNECTION)->table('platform_settings')->insert(['key' => self::KEY, ...$payload]);
        }

        $this->values = $values;
    }

    public static function read(string $key): array
    {
        $raw = DB::connection(self::CONNECTION)->table('platform_settings')->where('key', $key)->value('value');

        return $raw ? (array) json_decode((string) $raw, true) : [];
    }

    public static function write(string $key, array $value, ?string $actorId): void
    {
        $db = DB::connection(self::CONNECTION);
        $payload = ['value' => json_encode($value, JSON_UNESCAPED_UNICODE), 'updated_by' => $actorId, 'updated_at' => now()];

        if ($db->table('platform_settings')->where('key', $key)->exists()) {
            $db->table('platform_settings')->where('key', $key)->update([...$payload, 'lock_version' => DB::raw('lock_version + 1')]);
        } else {
            $db->table('platform_settings')->insert(['key' => $key, ...$payload]);
        }
    }
}
