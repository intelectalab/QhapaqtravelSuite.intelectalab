<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Jobs\SendNotificationEmail;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ClaimNotices
{
    private const TYPES = ['reclamo' => 'Reclamo', 'queja' => 'Queja'];

    public function __construct(private readonly NotificationLog $log, private readonly TenantContext $context) {}

    public function acknowledge(string $caseId, ?string $actorId = null): ?string
    {
        $claim = $this->claim($caseId);
        $consumer = ClaimConsumer::read(json_decode((string) $claim->consumer, true) ?: []);
        $email = $consumer['email'] ?? null;

        if (! is_string($email) || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return null;
        }

        $good = json_decode((string) $claim->good, true) ?: [];
        $timezone = $this->context->timezone();
        $agency = $this->agency();
        $lines = [
            "Hola, {$consumer['name']}:",
            '',
            'Registramos tu hoja del Libro de Reclamaciones. Esta es tu constancia.',
            '',
            "Número de hoja: {$claim->book_number}",
            'Tipo: '.(self::TYPES[$claim->type_code] ?? $claim->type_code),
            'Fecha de registro: '.Carbon::parse($claim->received_at)->setTimezone($timezone)->format('d/m/Y H:i'),
            "Sede: {$claim->sede}",
            'Responderemos a más tardar el '.Carbon::parse($claim->due_date)->format('d/m/Y')." ({$claim->response_days} días hábiles).",
            '',
            'Datos del consumidor',
            "Nombre: {$consumer['name']}",
            'Documento: '.trim(strtoupper((string) ($consumer['doc_type'] ?? '')).' '.($consumer['doc_number'] ?? '')),
            'Domicilio: '.($consumer['address'] ?? '—'),
            'Teléfono: '.($consumer['phone'] ?? '—'),
            "Correo: {$email}",
            '',
            'Bien contratado',
            ucfirst((string) ($good['kind'] ?? 'servicio')).': '.($good['description'] ?? '—').(isset($good['amount']) && (float) $good['amount'] > 0 ? ' · '.($good['currency'] ?? 'PEN').' '.number_format((float) $good['amount'], 2) : ''),
            '',
            'Detalle',
            (string) $claim->detail,
            '',
            'Pedido',
            (string) $claim->request,
            '',
            $agency,
        ];

        return $this->send($claim, 'reclamacion.constancia', $email, "Constancia de tu hoja {$claim->book_number} · {$agency}", implode("\n", $lines), $actorId);
    }

    public function respond(string $caseId, string $decision, string $text, ?string $actions, ?string $actorId): ?string
    {
        $claim = $this->claim($caseId);
        $consumer = ClaimConsumer::read(json_decode((string) $claim->consumer, true) ?: []);
        $email = $consumer['email'] ?? null;

        if (! is_string($email) || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return null;
        }

        $agency = $this->agency();
        $guardian = $consumer['is_minor'] && ! empty($consumer['guardian']['name']) ? (string) $consumer['guardian']['name'] : null;
        $lines = [
            'Hola, '.($guardian ?? $consumer['name']).':',
            '',
            $guardian !== null
                ? "Esta es la respuesta a la hoja {$claim->book_number} del Libro de Reclamaciones, registrada a nombre de {$consumer['name']} (menor de edad). Te la enviamos como ".mb_strtolower((string) ($consumer['guardian']['relation'] ?? 'apoderado')).'.'
                : "Esta es la respuesta a tu hoja {$claim->book_number} del Libro de Reclamaciones.",
            '',
            'Decisión: '.$decision,
            '',
            $text,
        ];

        if ($actions !== null && trim($actions) !== '') {
            array_push($lines, '', 'Acciones adoptadas', $actions);
        }

        array_push($lines, '', $agency);

        return $this->send($claim, 'reclamacion.respuesta', $email, "Respuesta a tu hoja {$claim->book_number} · {$agency}", implode("\n", $lines), $actorId);
    }

    private function send(object $claim, string $event, string $email, string $subject, string $body, ?string $actorId): string
    {
        $message = $this->log->record([
            'event_code' => $event,
            'channel' => 'email',
            'recipient_address' => $email,
            'subject' => mb_substr($subject, 0, 200),
            'body_rendered' => $body,
            'source_type' => 'claim',
            'source_id' => $claim->id,
            'client_id' => $claim->client_id,
            'reservation_id' => $claim->reservation_id,
            'audience' => 'client',
            'status' => 'pendiente',
            'created_by' => $actorId,
        ]);

        dispatch((new SendNotificationEmail((string) $message->id))->forTenant($this->context->idOrFail()))->afterCommit();

        return (string) $message->id;
    }

    private function claim(string $caseId): object
    {
        return DB::table('crm_cases as c')->leftJoin('iam_sedes as s', 's.id', '=', 'c.sede_id')->where('c.id', $caseId)
            ->first(['c.id', 'c.client_id', 'c.reservation_id', 'c.book_number', 'c.type_code', 'c.received_at', 'c.due_date', 'c.response_days', 'c.consumer', 'c.good', 'c.detail', 'c.request', 's.name as sede']);
    }

    private function agency(): string
    {
        $tenant = $this->context->tenant();

        return (string) ($tenant->commercial_name ?? $tenant->legal_name ?? 'KipuControl');
    }
}
