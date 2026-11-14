<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Channels\Support\EcommerceOrderRelease;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Actions\SiteCheckout;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use stdClass;

final class TransferDeadlines
{
    public const EVENT_PENDING = 'transferencia.datos';

    public const EVENT_WARNING = 'transferencia.por_cancelar';

    public const EVENT_CANCELLED = 'transferencia.cancelada';

    private const LINK_DAYS = 3;

    public function __construct(
        private readonly TransferSettings $settings,
        private readonly TransferProofs $proofs,
        private readonly StaffNotices $notices,
        private readonly EcommerceOrderRelease $release,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function informedAt(string $orderId): ?CarbonImmutable
    {
        $at = $this->proofs->pendingForOrder($orderId)->max('created_at');

        return $at === null ? null : CarbonImmutable::parse((string) $at);
    }

    public function cancelAt(stdClass $order): ?CarbonImmutable
    {
        $settings = $this->settings->read();

        if (! $settings['auto_cancel'] || $order->status !== 'pago_por_validar' || $this->proofs->orderHasProof((string) $order->id)) {
            return null;
        }

        return $this->informedAt((string) $order->id)?->addHours($settings['cancel_hours']);
    }

    public function link(stdClass $order): string
    {
        $tenant = $this->context->tenant();
        $until = CarbonImmutable::now($tenant->timezone ?: 'America/Lima')->addDays(self::LINK_DAYS)->toDateString();

        return rtrim((string) config('app.frontend_url'), '/').'/sitio/'.$tenant->subdomain.'/confirmacion/'.$order->code.'/acceso?token='.SiteCheckout::paymentLink($order, $until);
    }

    public function emailPending(stdClass $order, string $method, string $amount): void
    {
        $agency = $this->notices->agency();
        $accounts = collect(CheckoutTerms::bankAccounts())->map(fn (array $a): string => "- {$a['bank']} ({$a['currency']}): cuenta {$a['account_number']}".($a['cci'] ? " · CCI {$a['cci']}" : ''))->implode("\n");
        $cancel = $this->settings->read();
        $lines = [
            "Hola {$order->customer_name}:",
            "Recibimos el aviso de tu pago de {$order->currency} {$amount} por ".(CheckoutTerms::METHODS[$method] ?? $method)." para el pedido {$order->code}. Lo validamos en horario de atención.",
            $method === 'transferencia' && $accounts !== '' ? "Datos bancarios de {$agency}:\n{$accounts}" : null,
            "Sube aquí la foto o el PDF de tu constancia para validarla más rápido:\n{$this->link($order)}",
            $cancel['auto_cancel'] ? "Si no podemos validar el pago en {$cancel['cancel_hours']} horas, el pedido se cancela y los cupos se liberan. Con la constancia subida, el pedido no se cancela." : null,
            $agency,
        ];

        $this->notices->email((string) $order->customer_email, self::EVENT_PENDING, "Tu pago del pedido {$order->code} está en validación · {$agency}", implode("\n\n", array_filter($lines)), 'channel_ecom_order', (string) $order->id, 'client');
    }

    public function warnClient(stdClass $order, CarbonImmutable $cancelAt): void
    {
        $agency = $this->notices->agency();
        $local = $cancelAt->setTimezone($this->context->timezone());
        $body = "Hola {$order->customer_name}:\n\nAún no podemos validar el pago de tu pedido {$order->code}. Si no lo validamos antes del {$local->format('d/m/Y')} a las {$local->format('H:i')}, el pedido se cancela y los cupos se liberan.\n\nSube la foto o el PDF de tu constancia aquí y el pedido no se cancelará:\n{$this->link($order)}\n\n{$agency}";

        $this->notices->email((string) $order->customer_email, self::EVENT_WARNING, "Sube la constancia de tu pedido {$order->code} · {$agency}", $body, 'channel_ecom_order', (string) $order->id, 'client');
    }

    public function expire(stdClass $order, int $hours): void
    {
        $note = "Pago no validado en {$hours} h: pedido cancelado automáticamente";
        $payments = $this->proofs->pendingForOrder((string) $order->id);
        $this->release->releaseConsumed((string) $order->id, $note);
        $this->release->release((string) $order->id, 'liberada', $note, 'pago no validado a tiempo');

        foreach ($payments as $payment) {
            DB::table('fin_payments')->where('id', $payment->id)->update(['status' => 'rechazado', 'reject_reason' => $note, 'updated_at' => now()]);
            $this->audit->log('Pago', (string) $payment->code, 'rechazar', 'pendiente', "rechazado · {$note}");
        }

        DB::table('channel_ecom_orders')->where('id', $order->id)->update(['status' => 'cancelado', 'cancel_reason' => mb_substr($note, 0, 300), 'updated_at' => now()]);
        DB::table('channel_ecom_payment_attempts')->where('order_id', $order->id)->where('result', 'por_validar')->update(['result' => 'rechazado', 'message' => 'Pago no validado a tiempo: el pedido se canceló.']);
        $this->audit->log('Pedido web', (string) $order->code, 'cancelar', 'pago_por_validar', "cancelado · {$note}");

        $agency = $this->notices->agency();
        $this->notices->email((string) $order->customer_email, self::EVENT_CANCELLED, "Cancelamos tu pedido {$order->code} · {$agency}", "Hola {$order->customer_name}:\n\nNo pudimos validar el pago de tu pedido {$order->code} en {$hours} horas, así que lo cancelamos y liberamos los cupos.\n\nSi ya hiciste la transferencia, responde este correo con la constancia y revisamos tu caso.\n\n{$agency}", 'channel_ecom_order', (string) $order->id, 'client');
    }
}
