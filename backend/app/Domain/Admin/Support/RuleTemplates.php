<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use Illuminate\Support\Collection;

final class RuleTemplates
{
    public const PLAN_RANK = ['Starter' => 1, 'Professional' => 2, 'Enterprise' => 3];

    public const TEMPLATES = [
        'receptivo' => [
            'name' => 'Tour operador receptivo',
            'description' => 'Circuitos y excursiones para extranjeros: rangos de disponibilidad, alojamiento por ciudad, varias monedas, adelanto, recojo y mensajes previos al viaje.',
            'enabled' => ['R-AVAIL-RANGES', 'R-CUTOFF', 'R-WEEKDAYS', 'R-HOLD', 'R-MIN-ADULTS', 'R-CHILD-PER-ADULT', 'R-INFANT-FREE', 'R-MAX-PAX', 'R-COMPANIONS', 'R-ALTITUDE', 'R-LODGING', 'R-LODGING-CAPACITY', 'R-SINGLE-SUPP', 'R-ADDONS', 'R-PROMO', 'R-SEASON', 'R-MULTICURRENCY', 'R-DEPOSIT', 'R-PREVIEW-REMOVE', 'R-PICKUP', 'R-COMMENTS', 'R-NOMINATIVE', 'R-PAX-MESSAGES', 'R-PAX-FEEDBACK', 'R-REVIEW-INVITE'],
        ],
        'minorista' => [
            'name' => 'Agencia minorista',
            'description' => 'Venta al público local en soles: códigos promocionales, reserva anticipada y pagar después; sin recojo ni monedas extranjeras.',
            'enabled' => ['R-AVAIL-RANGES', 'R-CUTOFF', 'R-HOLD', 'R-MIN-ADULTS', 'R-CHILD-PER-ADULT', 'R-INFANT-FREE', 'R-MAX-PAX', 'R-COMPANIONS', 'R-LODGING', 'R-LODGING-CAPACITY', 'R-ADDONS', 'R-PROMO', 'R-EARLY-BIRD', 'R-SEASON', 'R-DEPOSIT', 'R-PAY-LATER', 'R-PREVIEW-REMOVE', 'R-COMMENTS', 'R-PAX-MESSAGES', 'R-PAX-FEEDBACK'],
        ],
        'aventura' => [
            'name' => 'Operador de aventura',
            'description' => 'Trekking y actividades de altura: grupo mínimo, días de operación, declaración de altura, recargo de última hora y recojo; sin alojamiento.',
            'enabled' => ['R-AVAIL-RANGES', 'R-CUTOFF', 'R-WEEKDAYS', 'R-HOLD', 'R-MIN-GROUP', 'R-MIN-ADULTS', 'R-CHILD-PER-ADULT', 'R-INFANT-FREE', 'R-MAX-PAX', 'R-COMPANIONS', 'R-ALTITUDE', 'R-ADDONS', 'R-SEASON', 'R-LAST-MINUTE', 'R-MULTICURRENCY', 'R-DEPOSIT', 'R-PREVIEW-REMOVE', 'R-PICKUP', 'R-COMMENTS', 'R-PAX-MESSAGES', 'R-PAX-FEEDBACK', 'R-REVIEW-INVITE'],
        ],
        'b2b' => [
            'name' => 'Solo B2B',
            'description' => 'Venta exclusiva a agencias: sin promociones ni mensajes de marketing; descuento por grupo, adelanto y pago diferido.',
            'enabled' => ['R-AVAIL-RANGES', 'R-CUTOFF', 'R-MIN-ADULTS', 'R-CHILD-PER-ADULT', 'R-INFANT-FREE', 'R-COMPANIONS', 'R-LODGING', 'R-LODGING-CAPACITY', 'R-SINGLE-SUPP', 'R-ADDONS', 'R-GROUP-DISC', 'R-SEASON', 'R-DEPOSIT', 'R-PAY-LATER', 'R-NOMINATIVE', 'R-PAX-MESSAGES'],
        ],
    ];

    public static function changes(array $template, Collection $rules, int $rank): array
    {
        $wanted = $rules->filter(fn (object $rule): bool => in_array($rule->code, $template['enabled'], true));
        $allowed = $wanted->filter(fn (object $rule): bool => $rank >= (self::PLAN_RANK[$rule->min_plan] ?? 1))->pluck('code')->all();
        $depends = $rules->pluck('depends_on', 'code');

        do {
            $count = count($allowed);
            $allowed = array_values(array_filter($allowed, fn (string $code): bool => ($depends[$code] ?? null) === null || in_array($depends[$code], $allowed, true)));
        } while (count($allowed) !== $count);

        return [
            'enable' => $rules->filter(fn (object $rule): bool => ! $rule->enabled && in_array($rule->code, $allowed, true))->pluck('code')->values()->all(),
            'disable' => $rules->filter(fn (object $rule): bool => (bool) $rule->enabled && ! in_array($rule->code, $allowed, true))->pluck('code')->values()->all(),
            'blocked' => array_values(array_diff($wanted->pluck('code')->all(), $allowed)),
            'active' => count($allowed),
        ];
    }
}
