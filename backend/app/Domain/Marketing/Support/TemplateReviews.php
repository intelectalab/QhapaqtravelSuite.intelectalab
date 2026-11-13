<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Support;

use App\Domain\Growth\Whatsapp\WhatsappTemplates;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TemplateReviews
{
    public const EVENTS = ['APPROVED' => 'aprobada', 'REJECTED' => 'rechazada', 'DISABLED' => 'rechazada', 'PAUSED' => 'pausada'];

    public function __construct(private readonly WhatsappTemplates $whatsapp, private readonly AuditLogger $audit) {}

    public function apply(string $accountId, array $value): array
    {
        $status = self::EVENTS[Str::upper((string) ($value['event'] ?? ''))] ?? null;
        $providerId = filled($value['message_template_id'] ?? null) ? (string) $value['message_template_id'] : null;
        $name = filled($value['message_template_name'] ?? null) ? (string) $value['message_template_name'] : null;

        if ($status === null) {
            return ['result' => 'ignorado', 'template' => $name, 'status' => null];
        }

        $reason = filled($value['reason'] ?? null) && Str::upper((string) $value['reason']) !== 'NONE' ? (string) $value['reason'] : null;
        $whatsapp = $this->whatsapp->providerReview($accountId, $providerId, $name, $value['message_template_language'] ?? null, $status, $reason);
        $marketing = $providerId !== null && $status !== 'pausada' ? $this->marketing($providerId, $status) : null;
        $results = array_filter([$whatsapp['result'] ?? null, $marketing]);

        return [
            'result' => match (true) {
                in_array('actualizado', $results, true) => 'actualizado',
                $results !== [] => 'duplicado',
                default => 'ignorado',
            },
            'template' => $whatsapp['template'] ?? $name,
            'status' => $status,
        ];
    }

    private function marketing(string $providerId, string $status): ?string
    {
        $template = DB::table('mkt_templates')->where('channel', 'whatsapp')->where('provider_template_id', $providerId)->first(['id', 'code', 'status']);

        if ($template === null || $template->status === 'activa') {
            return null;
        }

        if ($template->status === $status) {
            return 'duplicado';
        }

        DB::table('mkt_templates')->where('id', $template->id)->update(['status' => $status, 'reviewed_at' => now(), 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);
        $this->audit->log('Plantilla', (string) $template->code, 'aprobacion_meta', (string) $template->status, $status);

        return 'actualizado';
    }
}
