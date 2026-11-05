<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CodeSequence
{
    public function __construct(private readonly TenantContext $context)
    {
    }

    public function next(string $table, string $prefix, int $digits = 4): string
    {
        DB::select('select pg_advisory_xact_lock(hashtext(?))', ["{$this->context->idOrFail()}:{$table}"]);
        $last = DB::table($table)->where('code', 'like', "{$prefix}%")->orderByDesc('code')->value('code');
        $number = $last ? (int) Str::after($last, $prefix) + 1 : 1;

        return $prefix.str_pad((string) $number, $digits, '0', STR_PAD_LEFT);
    }
}
