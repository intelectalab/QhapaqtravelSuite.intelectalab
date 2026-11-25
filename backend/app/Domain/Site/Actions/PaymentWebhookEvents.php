<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Finance\Actions\PaymentLinks;
use App\Domain\Shared\Audit\AuditLogger;

final class PaymentWebhookEvents
{
    public const TYPES = ['payment.approved', 'payment.rejected', 'payment.chargeback', 'payment.refunded'];

    public const SCOPES = ['order', 'receivable', 'payment_link', 'gift_card'];

    private const ENTITIES = ['order' => 'Pedido web', 'payment_link' => 'Link de pago', 'gift_card' => 'Vale de regalo'];

    public function __construct(private readonly SiteCheckout $checkout, private readonly AuditLogger $audit, private readonly PaymentLinks $links) {}

    public function apply(string $gateway, array $event): array
    {
        $data = $event['data'];
        $reference = (string) $data['reference'];
        $scope = (string) ($data['scope'] ?? 'order');
        $entity = self::ENTITIES[$scope] ?? 'Cuenta por cobrar';
        $txn = (string) ($data['txn_id'] ?? 'sin referencia');

        if ($event['type'] === 'payment.chargeback') {
            $this->audit->log($entity, $reference, 'contracargo', null, "{$gateway} · {$txn}");

            return ['result' => 'contracargo_registrado'];
        }

        if ($event['type'] === 'payment.refunded') {
            $this->audit->log($entity, $reference, 'reembolso_en_pasarela', null, "{$gateway} · {$txn}");

            return ['result' => 'reembolso_registrado'];
        }

        if ($scope === 'payment_link') {
            if ($event['type'] !== 'payment.approved') {
                $this->audit->log('Link de pago', $reference, 'pago_rechazado', null, "{$gateway} · ".($data['message'] ?? 'Pago no aprobado'));

                return ['result' => 'rechazado'];
            }

            return $this->links->settle($reference, (string) ($data['method'] ?? 'card'), $data['txn_id'] ?? null, null);
        }

        if ($scope !== 'order') {
            $this->audit->log($entity, $reference, 'webhook_pago', null, "{$event['type']} · {$gateway} · {$txn}");

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
