<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Shared\Errors\ApiException;

final class GrowthFeatureGate
{
    public const LABELS = [
        'R-PAY-LINKS' => 'los links de pago',
        'R-GIFT-CARDS' => 'los vales de regalo',
        'R-QR-CHECKIN' => 'el check-in con QR',
        'R-ACCOUNTING-EXPORT' => 'la exportación contable',
        'R-GDS-OFFERS' => 'las ofertas de aéreo y hotel',
        'R-AI-INSIGHTS' => 'las alertas de rentabilidad',
        'R-OTA-CHANNEL' => 'la conexión con OTAs',
    ];

    public function __construct(private readonly RuleResolver $rules) {}

    public function require(string $rule): void
    {
        if (! $this->rules->on($rule)) {
            throw ApiException::forbidden('RULE_NOT_IN_PLAN', 'El plan de tu agencia no incluye '.(self::LABELS[$rule] ?? $rule).' o la función está apagada. La administración puede activarla desde Reglas o mejorar el plan.');
        }
    }

    public function param(string $rule, string $key): mixed
    {
        return $this->rules->param($rule, $key);
    }
}
