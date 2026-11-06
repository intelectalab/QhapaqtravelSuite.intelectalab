<?php

declare(strict_types=1);

namespace Database\Support;

use App\Domain\Platform\Models\Tenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

trait SeedsTenant
{
    private const KIT_TODAY = '2026-09-29';

    private ?int $shiftDays = null;

    private array $userIds = [];

    abstract protected function tenant(): Tenant;

    protected function shift(): int
    {
        return $this->shiftDays ??= (int) Carbon::parse(self::KIT_TODAY)->diffInDays(Carbon::parse(Carbon::today('America/Lima')->toDateString()), false);
    }

    protected function upsert(string $table, array $key, array $values): string
    {
        $where = ['tenant_id' => $this->tenant()->getKey(), ...$key];
        $existing = DB::table($table)->where($where)->value('id');

        if ($existing) {
            DB::table($table)->where('id', $existing)->update($values);

            return (string) $existing;
        }

        $id = (string) Str::uuid7();
        DB::table($table)->insert(['id' => $id, ...$where, ...$values]);

        return $id;
    }

    protected function day(?string $date): ?string
    {
        return $date ? Carbon::parse($date)->addDays($this->shift())->toDateString() : null;
    }

    protected function moment(?string $value): ?string
    {
        return $value ? Carbon::parse($value, 'America/Lima')->addDays($this->shift())->toIso8601String() : null;
    }

    protected function userId(?string $code): ?string
    {
        if ($this->userIds === []) {
            $this->userIds = DB::table('iam_users')->where('tenant_id', $this->tenant()->getKey())->pluck('id', 'code')->all();
        }

        return $code && isset($this->userIds[$code]) ? (string) $this->userIds[$code] : (reset($this->userIds) ?: null);
    }

    protected function idByCode(string $table, ?string $code, string $column = 'code'): ?string
    {
        return $code ? DB::table($table)->where('tenant_id', $this->tenant()->getKey())->where($column, $code)->value('id') : null;
    }
}
