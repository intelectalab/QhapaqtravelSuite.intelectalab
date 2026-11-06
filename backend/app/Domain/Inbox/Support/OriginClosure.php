<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OriginClosure
{
    public const MIRRORED = ['supplier_rate_requests'];

    public function close(string $subjectType, string $subjectCode, bool $approved, ?string $note, User $actor): void
    {
        $requests = DB::table('collab_approval_requests')->where('subject_type', $subjectType)->where('subject_code', $subjectCode)->whereIn('status', ['pendiente', 'info'])->get(['id']);
        $status = $approved ? 'aprobada' : 'rechazada';

        foreach ($requests as $request) {
            DB::table('collab_approval_requests')->where('id', $request->id)->update([
                'status' => $status,
                'closed_in_origin' => true,
                'decided_by' => $actor->getKey(),
                'decided_at' => now(),
                'decision_note' => $note,
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            DB::table('collab_approval_events')->insert([
                'id' => (string) Str::uuid7(),
                'request_id' => $request->id,
                'event' => $status,
                'actor_id' => $actor->getKey(),
                'note' => $note ?? 'Resuelta en el módulo de origen',
                'occurred_at' => now(),
            ]);
        }
    }
}
