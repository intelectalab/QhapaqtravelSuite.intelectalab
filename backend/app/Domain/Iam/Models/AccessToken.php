<?php

declare(strict_types=1);

namespace App\Domain\Iam\Models;

use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;

final class AccessToken extends PersonalAccessToken
{
    use HasUuids;

    private const PLATFORM_CONNECTION = 'pgsql_platform';

    protected $table = 'personal_access_tokens';

    protected $fillable = ['tenant_id', 'name', 'token', 'abilities', 'experience', 'expires_at', 'device_name', 'ip'];

    protected function casts(): array
    {
        return [
            'abilities' => 'json',
            'last_used_at' => 'datetime',
            'expires_at' => 'datetime',
            'mfa_verified_at' => 'immutable_datetime',
        ];
    }

    public static function findToken($token): ?static
    {
        if (app(TenantContext::class)->id() !== null) {
            return parent::findToken($token);
        }

        [$id, $secret] = str_contains($token, '|') ? explode('|', $token, 2) : [null, $token];
        $query = self::on(self::PLATFORM_CONNECTION)->whereNull('tenant_id');
        $found = $id !== null ? $query->whereKey($id)->first() : $query->where('token', hash('sha256', $secret))->first();

        return $found !== null && hash_equals((string) $found->token, hash('sha256', $secret)) ? $found : null;
    }

    public static function expiresAfter(int $minutes): CarbonImmutable
    {
        return CarbonImmutable::parse((string) DB::selectOne('select now() as now')->now)->addMinutes($minutes);
    }

    public function isMfaVerified(): bool
    {
        return $this->mfa_verified_at !== null;
    }
}
