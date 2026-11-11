<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\PlatformSequence;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Mail\QueuedMail;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SendInvoiceNotice
{
    private const CONNECTION = 'pgsql_platform';

    private const ENTITY = 'Factura plataforma';

    private const STATUS = ['open' => 'pendiente de pago', 'failed' => 'con cobro rechazado', 'paid' => 'pagada', 'void' => 'anulada', 'uncollectible' => 'incobrable', 'draft' => 'en borrador'];

    public function __construct(private readonly QueuedMail $mail, private readonly PlatformSession $session) {}

    public function paymentLink(string $id, PlatformUser $actor): string
    {
        [$invoice, $number, $recipient] = $this->load($id);

        if (! in_array($invoice->status, ['open', 'failed', 'uncollectible'], true)) {
            throw ApiException::conflict('INVOICE_NOT_COLLECTIBLE', 'Solo se envía el enlace de pago de una factura pendiente o en cobranza.');
        }

        $link = rtrim((string) config('app.frontend_url'), '/').'/admin/suscripcion/pago';
        $this->mail->send($recipient['email'], $recipient['name'], "Actualiza tu medio de pago · factura {$number}", "Hola, equipo de {$recipient['name']}:\n\nNo pudimos cobrar la factura {$number} por S/ {$this->money($invoice->total)} (incluye IGV), con vencimiento el {$this->date($invoice->due_date)}.\n\nRegistra o actualiza tu tarjeta en este enlace para que la cobremos y tu cuenta siga activa:\n{$link}\n\nSi ya pagaste por transferencia, responde este correo con el número de operación.\n\nKipuControl");
        $this->session->log(self::ENTITY, $number, 'enviar_enlace_pago', null, $recipient['email'], $actor);

        return $recipient['email'];
    }

    public function resend(string $id, PlatformUser $actor): string
    {
        [$invoice, $number, $recipient] = $this->load($id);
        $status = self::STATUS[$invoice->status] ?? $invoice->status;
        $this->mail->send($recipient['email'], $recipient['name'], "Factura {$number} de KipuControl", "Hola, equipo de {$recipient['name']}:\n\nTe reenviamos la factura {$number} de tu suscripción, emitida el {$this->date($invoice->issue_date)} por S/ {$this->money($invoice->total)} (incluye IGV). Estado: {$status}.\n\nPuedes verla y descargarla desde Administración, Suscripción y uso, Facturas.\n\nKipuControl");
        $this->session->log(self::ENTITY, $number, 'reenviar', null, $recipient['email'], $actor);

        return $recipient['email'];
    }

    private function load(string $id): array
    {
        $db = DB::connection(self::CONNECTION);
        $invoice = (Str::isUuid($id) ? $db->table('platform_invoices')->where('id', $id)->first() : null) ?? throw ApiException::notFound('La factura no existe.');
        $subscription = $db->table('subscriptions')->where('id', $invoice->subscription_id)->first(['billing_email', 'billing_name']);
        $tenant = $db->table('tenants')->where('id', $invoice->tenant_id)->first(['commercial_name', 'admin_email']);
        $email = (string) ($subscription->billing_email ?? '') ?: (string) ($tenant->admin_email ?? '');

        if ($email === '') {
            throw ApiException::unprocessable('BILLING_EMAIL', 'La agencia no tiene un correo para comprobantes. Pídele que lo registre en sus datos de facturación.');
        }

        return [$invoice, PlatformSequence::format(trim((string) $invoice->series), (int) $invoice->number), ['email' => $email, 'name' => (string) ($tenant->commercial_name ?? $subscription->billing_name ?? $email)]];
    }

    private function money(mixed $value): string
    {
        return number_format((float) $value, 2, '.', ' ');
    }

    private function date(mixed $value): string
    {
        return $value ? Carbon::parse((string) $value)->format('d/m/Y') : '—';
    }
}
