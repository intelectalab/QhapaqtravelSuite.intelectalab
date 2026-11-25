<?php

declare(strict_types=1);

namespace App\Domain\Landing\Support;

use Illuminate\Support\Facades\DB;

final class CommentCodes
{
    public static function next(): string
    {
        $db = DB::connection('pgsql_platform');
        $db->select('select pg_advisory_xact_lock(hashtext(?))', ['platform_blog_comments:code']);
        $last = (string) $db->table('platform_blog_comments')->max('code');
        $number = preg_match('/^CMT-(\d+)$/', $last, $match) === 1 ? (int) $match[1] + 1 : 1;

        return sprintf('CMT-%04d', $number);
    }
}
