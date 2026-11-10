<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class UserCodes
{
    public function __construct(private readonly TenantContext $context) {}

    public function next(): string
    {
        DB::select('select pg_advisory_xact_lock(hashtext(?))', ["{$this->context->idOrFail()}:iam_users"]);
        $numbers = DB::table('iam_users')->where('code', 'like', 'U%')->pluck('code')->map(fn (string $code) => (int) Str::after($code, 'U'));

        return 'U'.str_pad((string) (($numbers->max() ?? 0) + 1), 2, '0', STR_PAD_LEFT);
    }
}
