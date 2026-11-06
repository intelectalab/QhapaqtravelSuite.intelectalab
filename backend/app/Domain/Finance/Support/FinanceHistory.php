<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class FinanceHistory
{
    public static function record(string $type, string $entityId, string $status, ?string $note, ?User $actor): void
    {
        DB::table('fin_status_history')->insert([
            'entity_type' => $type,
            'entity_id' => $entityId,
            'status' => $status,
            'note' => $note,
            'user_id' => $actor?->getKey(),
            'created_by' => $actor?->getKey(),
            'created_at' => now(),
        ]);
    }
}
