<?php

declare(strict_types=1);

namespace App\Domain\Shared\Sequences;

use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class SequenceService
{
    public function __construct(private readonly TenantContext $context) {}

    public function next(string $docType, string $series = 'default'): string
    {
        $row = DB::table('sys_sequences')
            ->where('tenant_id', $this->context->idOrFail())
            ->where('doc_type', $docType)
            ->where('series', $series)
            ->lockForUpdate()
            ->first(['id', 'prefix', 'pad_width', 'next_number']);

        if ($row === null) {
            throw new RuntimeException("No existe la serie {$docType}/{$series} en sys_sequences para el tenant (sembrar en el alta del tenant, PROC-001).");
        }

        DB::table('sys_sequences')->where('id', $row->id)->update([
            'next_number' => DB::raw('next_number + 1'),
            'updated_at' => now(),
        ]);

        return $row->prefix.str_pad((string) $row->next_number, (int) $row->pad_width, '0', STR_PAD_LEFT);
    }

    public static function numberOf(string $code): int
    {
        return preg_match('/(\d+)$/', $code, $m) === 1 ? (int) $m[1] : 0;
    }
}
