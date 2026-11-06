<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ChannelKit
{
    public function __construct(private readonly TenantContext $context) {}

    public function today(): string
    {
        return Carbon::now($this->context->tenant()->timezone ?: 'America/Lima')->toDateString();
    }

    public function nextCode(string $table, string $prefix, int $pad): string
    {
        $last = DB::table($table)->where('code', 'like', $prefix.'%')->selectRaw("max(substring(code from '[0-9]+$')::int) as n")->value('n');

        return $prefix.str_pad((string) ((int) $last + 1), $pad, '0', STR_PAD_LEFT);
    }

    public function row(string $table, string $code, array $columns = ['*']): object
    {
        $row = DB::table($table)->where('code', $code)->when(in_array($table, ['channel_b2b_agencies', 'cms_contents', 'crm_own_reviews'], true), fn ($query) => $query->whereNull('deleted_at'))->first($columns);

        if ($row === null) {
            throw ApiException::notFound();
        }

        return $row;
    }

    public static function money(mixed $value): float
    {
        return round((float) $value, 2);
    }
}
