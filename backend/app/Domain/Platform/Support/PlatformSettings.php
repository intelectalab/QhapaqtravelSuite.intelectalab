<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Support\Facades\DB;

final class PlatformSettings
{
    public const KEY = 'billing';

    private const CONNECTION = 'pgsql_platform';

    private const DEFAULTS = [
        'igv_pct' => 18,
        'currency' => 'PEN',
        'dunning' => ['retry_days' => [1, 3, 7], 'suspend_after_last' => true],
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
}
