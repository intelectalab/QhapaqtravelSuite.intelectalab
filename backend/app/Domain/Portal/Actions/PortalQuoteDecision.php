<?php

declare(strict_types=1);

namespace App\Domain\Portal\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Quotes\Actions\QuoteLifecycle;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PortalQuoteDecision
{
    public const REASONS = ['Precio', 'Cambio de fechas', 'Eligió otra agencia', 'Cambio de destino', 'Viaje cancelado', 'Otro'];

    public function __construct(private readonly QuoteLifecycle $lifecycle, private readonly AuditLogger $audit) {}

    public function markViewed(PortalAccount $account, string $code): void
    {
        $quote = $account->quote($code);

        if ($quote->status !== 'enviada') {
            return;
        }

        DB::table('quote_quotes')->where('id', $quote->id)->update(['status' => 'vista', 'viewed_at' => now(), 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);
        $this->audit->log('Cotización', $quote->code, 'ver_portal', 'enviada', 'vista');
    }

    public function requestUpdate(PortalAccount $account, string $code, string $message, PortalMessages $messages): array
    {
        $quote = $account->quote($code);

        if (! in_array($quote->status, ['enviada', 'vista', 'negociacion', 'vencida'], true)) {
            throw ApiException::conflict('PCL-BR-11', 'Solo se piden cambios sobre una propuesta que aún no aprobaste ni rechazaste.');
        }

        $expired = $quote->status === 'vencida' || ($quote->valid_until !== null && (string) $quote->valid_until < now('America/Lima')->toDateString());
        $ticket = $messages->send($account, ['subject' => ($expired ? 'Actualizar la propuesta ' : 'Cambios en la propuesta ').$quote->code, 'topic' => 'cambios', 'body' => $message]);
        $this->audit->log('Cotización', (string) $quote->code, $expired ? 'solicitar_actualizacion_portal' : 'solicitar_cambios_portal', $quote->status, "{$quote->status} · {$ticket}");

        return ['code' => $quote->code, 'status' => $quote->status, 'ticket' => $ticket];
    }

    public function approve(PortalAccount $account, string $code, array $data, ?string $ip): void
    {
        $quote = $account->quote($code);
        $recorder = $quote->owner_id ? User::query()->find($quote->owner_id) : null;

        if (! $recorder instanceof User || ! $recorder->isActive() || ! $recorder->can('reservations.create')) {
            throw ApiException::conflict('PCL-BR-04', 'Tu asesor debe registrar esta aprobación. Escríbele desde Mensajes.');
        }

        $reference = Str::limit(trim("Portal · {$account->user->email}".(! empty($data['comment']) ? " · {$data['comment']}" : '')), 200, '');

        try {
            $this->lifecycle->approve($code, ['approved_by_name' => $data['name'], 'channel' => 'Portal', 'ref' => $reference], $recorder);
        } catch (ApiException $exception) {
            throw $exception->ruleCode === 'QTE-BR-13'
                ? ApiException::conflict('QTE-BR-13', 'Tu asesor aún está revisando esta propuesta. Te avisaremos cuando puedas aprobarla.')
                : $exception;
        }

        if ($ip) {
            DB::table('quote_quotes')->where('id', $quote->id)->update(['approval_ip' => $ip]);
            DB::table('quote_approvals')->where('quote_id', $quote->id)->orderByDesc('created_at')->limit(1)->update(['ip' => $ip]);
        }
    }

    public function reject(PortalAccount $account, string $code, string $reason, string $comment): void
    {
        $quote = $account->quote($code);
        $this->lifecycle->reject($quote->code, "{$reason} · {$comment}", $account->user);
    }
}
