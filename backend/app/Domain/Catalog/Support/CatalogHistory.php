<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class CatalogHistory
{
    public static function of(string $entity, string $id, int $limit = 60): Collection
    {
        return DB::table('audit_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')
            ->where('e.entity', $entity)->where('e.entity_id', $id)->orderByDesc('e.occurred_at')->limit($limit)
            ->get(['e.code', 'e.action', 'e.before_value', 'e.after_value', 'e.occurred_at', 'u.name as actor']);
    }
}
