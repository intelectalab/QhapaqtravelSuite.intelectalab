<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class TenantSettings
{
    public function __construct(private readonly TenantContext $context) {}

    public function section(string $section): array
    {
        $values = DB::table('sys_settings')->where('section', $section)->value('values');

        return is_string($values) ? (array) json_decode($values, true) : [];
    }

    public function sections(array $sections): array
    {
        $rows = DB::table('sys_settings as s')
            ->leftJoin('iam_users as u', 'u.id', '=', 's.updated_by')
            ->whereIn('s.section', $sections)
            ->get(['s.section', 's.values', 's.updated_at', 's.lock_version', 'u.name as user_name'])
            ->keyBy('section');

        return collect($sections)->mapWithKeys(fn (string $section): array => [$section => [
            'values' => isset($rows[$section]) ? (array) json_decode((string) $rows[$section]->values, true) : [],
            'updated_at' => $rows[$section]->updated_at ?? null,
            'updated_by' => $rows[$section]->user_name ?? null,
            'lock_version' => isset($rows[$section]) ? (int) $rows[$section]->lock_version : 0,
        ]])->all();
    }

    public function save(string $section, array $values, User $actor): void
    {
        $tenantId = $this->context->idOrFail();
        $payload = ['values' => json_encode($values, JSON_UNESCAPED_UNICODE), 'updated_by' => $actor->getKey(), 'updated_at' => now()];
        $exists = DB::table('sys_settings')->where('tenant_id', $tenantId)->where('section', $section)->exists();

        if ($exists) {
            DB::table('sys_settings')->where('tenant_id', $tenantId)->where('section', $section)->update([...$payload, 'lock_version' => DB::raw('lock_version + 1')]);

            return;
        }

        DB::table('sys_settings')->insert(['tenant_id' => $tenantId, 'section' => $section, ...$payload]);
    }

    public static function changes(array $before, array $after): array
    {
        $changed = [];

        foreach ($after as $key => $value) {
            $old = $before[$key] ?? null;

            if (self::text($old) !== self::text($value)) {
                $changed[$key] = [$old, $value];
            }
        }

        return $changed;
    }

    public static function text(mixed $value): ?string
    {
        return match (true) {
            $value === null => null,
            is_bool($value) => $value ? 'sí' : 'no',
            is_array($value) => json_encode($value, JSON_UNESCAPED_UNICODE) ?: null,
            is_float($value) && floor($value) === $value => (string) (int) $value,
            default => (string) $value,
        };
    }
}
