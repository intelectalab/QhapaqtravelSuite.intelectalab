<?php

declare(strict_types=1);

namespace App\Domain\Shared\Audit;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class AuditTrail
{
    public function for(string $entity, array $ids, int $limit = 50): array
    {
        $ids = array_values(array_unique(array_filter($ids, fn (mixed $id): bool => is_string($id) && $id !== '')));

        if ($ids === []) {
            return [];
        }

        return DB::table('audit_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')
            ->where('e.entity', $entity)->whereIn('e.entity_id', $ids)
            ->orderByDesc('e.occurred_at')->orderByDesc('e.code')->limit($limit)
            ->get(['e.code', 'e.action', 'e.before_value', 'e.after_value', 'e.actor_type', 'e.ip', 'e.occurred_at', 'u.name as actor'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'action' => $row->action,
                'before' => $row->before_value,
                'after' => $row->after_value,
                'actor' => $row->actor ?? ($row->actor_type === 'system' ? 'Sistema' : null),
                'ip' => $row->ip,
                'at' => Carbon::parse($row->occurred_at)->toIso8601String(),
            ])->values()->all();
    }
}
