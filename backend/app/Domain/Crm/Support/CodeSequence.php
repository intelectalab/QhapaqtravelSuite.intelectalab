<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CodeSequence
{
    public function __construct(private readonly TenantContext $context) {}

    public function next(string $table, string $prefix, int $digits = 4, string $column = 'code'): string
    {
        DB::select('select pg_advisory_xact_lock(hashtext(?))', ["{$this->context->idOrFail()}:{$table}:{$column}"]);
        $last = DB::table($table)->where($column, 'like', "{$prefix}%")->orderByDesc($column)->value($column);
        $number = $last ? (int) Str::after($last, $prefix) + 1 : 1;

        return $prefix.str_pad((string) $number, $digits, '0', STR_PAD_LEFT);
    }
}
