<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Shared\Audit\AuditLogger;

final class PaymentWebhookEvents
{
    public const TYPES = ['payment.approved', 'payment.rejected', 'payment.chargeback'];

    public function __construct(private readonly SiteCheckout $checkout, private readonly AuditLogger $audit) {}

    public function apply(string $gateway, array $event): array
    {
        $data = $event['data'];
        $reference = (string) $data['reference'];
        $scope = (string) ($data['scope'] ?? 'order');

        if ($event['type'] === 'payment.chargeback') {
            $this->audit->log($scope === 'order' ? 'Pedido web' : 'Cuenta por cobrar', $reference, 'contracargo', null, "{$gateway} · ".($data['txn_id'] ?? 'sin referencia'));

            return ['result' => 'contracargo_registrado'];
        }

        if ($scope !== 'order') {
            $this->audit->log('Cuenta por cobrar', $reference, 'webhook_pago', null, "{$event['type']} · ".($data['txn_id'] ?? 'sin referencia'));

            return ['result' => 'sin_efecto'];
        }

        $approved = $event['type'] === 'payment.approved';

        return $this->checkout->settle($reference, [
            'approved' => $approved,
            'code' => (string) ($data['code'] ?? ($approved ? '00' : '14')),
            'masked' => $data['masked'] ?? null,
            'message' => $approved ? 'Aprobado' : (string) ($data['message'] ?? 'La tarjeta fue rechazada.'),
            'txn' => $approved ? ($data['txn_id'] ?? null) : null,
            'three_ds' => $data['three_ds'] ?? null,
        ]);
    }
}
