<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Support;

use App\Domain\Admin\Support\StaffNotices;
use Illuminate\Support\Facades\DB;

final class QuoteNotices
{
    public function __construct(private readonly StaffNotices $notices) {}

    public function approvalRequested(object $quote, string $actorId, string $note): void
    {
        $this->notices->toRoles(['manager', 'tenant_admin'], 'cotizacion.aprobacion_solicitada', "{$quote->code} · aprobación interna solicitada", $this->who($quote).": {$note}", 'quote', (string) $quote->id, null, [], $actorId);
    }

    public function approvalDecided(object $quote, bool $approved, ?string $note, string $actorId): void
    {
        $verb = $approved ? 'aprobada' : 'rechazada';
        $this->notices->toUser((string) $quote->owner_id, "cotizacion.aprobacion_{$verb}", "{$quote->code} · aprobación interna {$verb}", trim($this->who($quote).($note ? " · {$note}" : '')), 'quote', (string) $quote->id, null, $actorId);
    }

    public function viewed(object $quote, ?string $actorId = null): void
    {
        $this->notices->toUser((string) $quote->owner_id, 'cotizacion.vista', "{$quote->code} · el cliente abrió la cotización", $this->who($quote), 'quote', (string) $quote->id, null, $actorId);
    }

    public function approved(object $quote, string $by, ?string $actorId = null): void
    {
        $this->notices->toUser((string) $quote->owner_id, 'cotizacion.aprobada', "{$quote->code} · aprobada por el cliente", "{$by} aprobó la cotización de ".$this->who($quote).'.', 'quote', (string) $quote->id, null, $actorId);
    }

    public function rejected(object $quote, string $reason, ?string $actorId = null): void
    {
        $this->notices->toUser((string) $quote->owner_id, 'cotizacion.rechazada', "{$quote->code} · rechazada", $this->who($quote).": {$reason}", 'quote', (string) $quote->id, null, $actorId);
    }

    public function reassigned(object $quote, string $ownerId, string $actorId): void
    {
        $this->notices->toUser($ownerId, 'cotizacion.reasignada', "{$quote->code} · ahora está a tu cargo", $this->who($quote), 'quote', (string) $quote->id, null, $actorId);
    }

    private function who(object $quote): string
    {
        return (string) (DB::table('crm_clients')->where('id', $quote->client_id ?? null)->value('name') ?? $quote->title ?? $quote->code);
    }
}
