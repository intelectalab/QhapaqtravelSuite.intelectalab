<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class RecordHistory
{
    public function for(array $codes, int $limit = 60): Collection
    {
        $codes = array_values(array_unique(array_filter($codes)));

        if ($codes === []) {
            return collect();
        }

        return DB::table('audit_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')
            ->whereIn('e.entity_id', $codes)
            ->whereIn('e.entity', ['Lead', 'Oportunidad', 'Actividad', 'Cotización', 'Cotizacion'])
            ->orderByDesc('e.occurred_at')->orderByDesc('e.code')->limit($limit)
            ->get(['e.id', 'e.entity', 'e.entity_id', 'e.action', 'e.before_value', 'e.after_value', 'e.actor_type', 'e.occurred_at', 'u.name as actor'])
            ->map(fn (object $row) => [
                'id' => $row->id,
                'entity' => $row->entity,
                'entity_id' => $row->entity_id,
                'action' => $row->action,
                'before' => $row->before_value,
                'after' => $row->after_value,
                'actor' => $row->actor ?? ($row->actor_type === 'system' ? 'Sistema' : null),
                'occurred_at' => Carbon::parse($row->occurred_at)->toIso8601String(),
            ]);
    }
}
