<?php

declare(strict_types=1);

namespace App\Domain\Growth\Shared;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\Request;

final class GrowthRules
{
    public const LABELS = [
        'R-AI-ASSISTANT' => 'El asistente de ventas con IA',
        'R-AI-IMPORT' => 'El importador de productos con IA',
        'R-WHATSAPP-OFFICIAL' => 'WhatsApp Business oficial',
        'R-CART-RECOVERY' => 'La recuperación de carritos y cotizaciones',
        'R-OTA-CHANNEL' => 'La conexión con OTAs',
        'R-MARKETPLACE' => 'El marketplace entre agencias',
        'R-DYNAMIC-PRICING' => 'Los precios dinámicos',
    ];

    public function __construct(private readonly RuleResolver $rules) {}

    public function enabled(string $rule): bool
    {
        return $this->rules->on($rule);
    }

    public function param(string $rule, string $key): mixed
    {
        return $this->rules->param($rule, $key);
    }

    public function ensure(string $rule, string $permission): void
    {
        if (! $this->enabled($rule)) {
            throw ApiException::forbidden('RULE_NOT_IN_PLAN', (self::LABELS[$rule] ?? 'Esta función').' no está activo en el plan de la agencia. Actívalo en Reglas o mejora el plan.', [$permission]);
        }
    }

    public static function actor(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
