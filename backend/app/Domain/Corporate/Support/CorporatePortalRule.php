<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Support;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Shared\Errors\ApiException;

final class CorporatePortalRule
{
    public const CODE = 'R-CORP-PORTAL';

    public function __construct(private readonly RuleResolver $rules) {}

    public function enabled(): bool
    {
        return $this->rules->on(self::CODE);
    }

    public function assert(): void
    {
        if (! $this->enabled()) {
            throw ApiException::forbidden('RULE_NOT_IN_PLAN', 'El portal corporativo no está activo para la agencia. Se habilita desde el plan Professional en Reglas de la agencia.', [self::CODE]);
        }
    }
}
