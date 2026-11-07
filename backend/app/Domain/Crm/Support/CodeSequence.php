<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class CodeSequence
{
    public function __construct(private readonly TenantContext $context) {}

    public function next(string $table, string $prefix, int $digits = 4, string $column = 'code'): string
    {
        DB::select('select pg_advisory_xact_lock(hashtext(?))', ["{$this->context->idOrFail()}:{$table}:{$column}"]);
        $start = mb_strlen($prefix) + 1;
        $last = DB::table($table)
            ->whereRaw("left({$column}, cast(? as int)) = ?", [mb_strlen($prefix), $prefix])
            ->whereRaw("substring({$column} from cast(? as int)) ~ ?", [$start, '^[0-9]+$'])
            ->selectRaw("max(cast(substring({$column} from cast(? as int)) as bigint)) as n", [$start])
            ->value('n');

        return $prefix.str_pad((string) ((int) $last + 1), $digits, '0', STR_PAD_LEFT);
    }
}
