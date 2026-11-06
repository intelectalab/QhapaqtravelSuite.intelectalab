<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Channels\Support\ChannelKit;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class AnswerPaxFeedback
{
    public function __construct(private readonly AuditLogger $audit, private readonly ChannelKit $kit) {}

    public function reply(string $code, string $text, User $actor): void
    {
        $row = $this->kit->row('channel_pax_feedback', $code, ['id', 'status']);

        DB::table('channel_pax_feedback')->where('id', $row->id)->update([
            'reply' => $text,
            'status' => 'respondido',
            'replied_at' => now(),
            'replied_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->audit->log('Comentario del pasajero', $code, 'responder', $row->status, 'respondido');
    }

    public function mark(string $code, string $status, User $actor): void
    {
        $row = $this->kit->row('channel_pax_feedback', $code, ['id', 'status']);

        if ($row->status === 'respondido' || $row->status === $status) {
            throw ApiException::conflict('PAX-FB-01', $row->status === 'respondido' ? 'Este comentario ya fue respondido.' : 'El comentario ya está en ese estado.');
        }

        DB::table('channel_pax_feedback')->where('id', $row->id)->update(['status' => $status, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Comentario del pasajero', $code, $status === 'derivado' ? 'derivar' : 'marcar_leido', $row->status, $status);
    }
}
