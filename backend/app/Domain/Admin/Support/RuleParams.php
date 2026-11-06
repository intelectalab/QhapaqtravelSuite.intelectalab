<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

final class RuleParams
{
    public const PARAMS = [
        'defaultHours' => ['label' => 'Anticipación mínima', 'unit' => 'h', 'min' => 0, 'max' => 720],
        'minutes' => ['label' => 'Duración del bloqueo', 'unit' => 'min', 'min' => 5, 'max' => 1440],
        'minPax' => ['label' => 'Pasajeros mínimos para salir', 'unit' => 'pax', 'min' => 1, 'max' => 50],
        'decisionDays' => ['label' => 'Días para confirmar la salida', 'unit' => 'días', 'min' => 1, 'max' => 30],
        'minAdults' => ['label' => 'Adultos mínimos por reserva', 'unit' => 'pax', 'min' => 1, 'max' => 10],
        'adultMinAge' => ['label' => 'Edad desde la que es adulto', 'unit' => 'años', 'min' => 10, 'max' => 21],
        'childMinAge' => ['label' => 'Edad mínima de niño', 'unit' => 'años', 'min' => 0, 'max' => 17],
        'childMaxAge' => ['label' => 'Edad máxima de niño', 'unit' => 'años', 'min' => 1, 'max' => 17],
        'maxChildrenPerAdult' => ['label' => 'Niños por adulto', 'unit' => '', 'min' => 0, 'max' => 10],
        'childPricePct' => ['label' => 'Precio del niño sobre el adulto', 'unit' => '%', 'min' => 0, 'max' => 100],
        'infantMaxAge' => ['label' => 'Edad máxima de infante', 'unit' => 'años', 'min' => 0, 'max' => 5],
        'maxInfantsPerAdult' => ['label' => 'Infantes por adulto', 'unit' => '', 'min' => 0, 'max' => 5],
        'max' => ['label' => 'Pasajeros máximos por reserva', 'unit' => 'pax', 'min' => 1, 'max' => 500],
        'when' => ['label' => 'Cuándo pedir los datos', 'options' => ['al_reservar' => 'Al reservar', 'antes_del_viaje' => 'Antes del viaje']],
        'daysBeforeIfLater' => ['label' => 'Si es después, días antes del viaje', 'unit' => 'días', 'min' => 1, 'max' => 60],
        'requireDocument' => ['label' => 'Exigir número de documento', 'bool' => true],
        'minAltitude' => ['label' => 'Avisar desde la altitud de', 'unit' => 'm s. n. m.', 'min' => 1000, 'max' => 6500],
        'pct' => ['label' => 'Porcentaje', 'unit' => '%', 'min' => 0, 'max' => 100],
        'fromPax' => ['label' => 'Desde cuántos pasajeros', 'unit' => 'pax', 'min' => 2, 'max' => 100],
        'days' => ['label' => 'Días', 'unit' => 'días', 'min' => 1, 'max' => 365],
        'fxMarginPct' => ['label' => 'Margen sobre el tipo de cambio', 'unit' => '%', 'min' => 0, 'max' => 10],
        'balanceDueDays' => ['label' => 'El saldo vence (días antes del viaje)', 'unit' => 'días', 'min' => 0, 'max' => 90],
        'holdHours' => ['label' => 'Horas para pagar después', 'unit' => 'h', 'min' => 1, 'max' => 168],
        'cardPct' => ['label' => 'Recargo por pago con tarjeta', 'unit' => '%', 'min' => 0, 'max' => 10],
        'askFlight' => ['label' => 'Pedir número de vuelo', 'bool' => true],
        'maxChars' => ['label' => 'Largo máximo del comentario', 'unit' => 'caracteres', 'min' => 100, 'max' => 5000],
        'daysAfter' => ['label' => 'Días después del viaje', 'unit' => 'días', 'min' => 0, 'max' => 30],
        'minStarsAutoPublish' => ['label' => 'Publicar sin revisión desde', 'unit' => 'estrellas', 'min' => 1, 'max' => 5],
        'moderation' => ['label' => 'Revisar antes de publicar', 'bool' => true],
    ];

    public const OVERRIDES = [
        'R-SINGLE-SUPP.pct' => ['label' => 'Suplemento por habitación individual'],
        'R-GROUP-DISC.pct' => ['label' => 'Descuento de grupo'],
        'R-EARLY-BIRD.days' => ['label' => 'Reservando con al menos'],
        'R-EARLY-BIRD.pct' => ['label' => 'Descuento por reserva anticipada'],
        'R-LAST-MINUTE.days' => ['label' => 'Faltando como máximo'],
        'R-LAST-MINUTE.pct' => ['label' => 'Descuento de último minuto'],
        'R-DEPOSIT.pct' => ['label' => 'Adelanto al reservar', 'min' => 1, 'max' => 99],
    ];

    public static function describe(string $rule, array $params): array
    {
        return collect($params)->map(function (mixed $value, string $key) use ($rule): array {
            $meta = [...(self::PARAMS[$key] ?? ['label' => $key]), ...(self::OVERRIDES["{$rule}.{$key}"] ?? [])];
            $type = match (true) {
                isset($meta['bool']) => 'bool',
                isset($meta['options']) => 'choice',
                default => 'number',
            };

            return [
                'key' => $key,
                'label' => $meta['label'],
                'type' => $type,
                'value' => $value,
                'unit' => $meta['unit'] ?? null,
                'min' => $meta['min'] ?? null,
                'max' => $meta['max'] ?? null,
                'options' => isset($meta['options']) ? collect($meta['options'])->map(fn (string $label, string $option): array => ['value' => $option, 'label' => $label])->values()->all() : null,
            ];
        })->values()->all();
    }

    public static function validate(string $rule, array $current, array $input): array
    {
        $errors = [];
        $clean = [];

        foreach (self::describe($rule, $current) as $param) {
            $key = $param['key'];
            $raw = $input[$key] ?? null;

            if ($param['type'] === 'bool') {
                $clean[$key] = filter_var($raw, FILTER_VALIDATE_BOOLEAN);

                continue;
            }

            if ($param['type'] === 'choice') {
                $allowed = array_column($param['options'] ?? [], 'value');
                $clean[$key] = in_array($raw, $allowed, true) ? $raw : $current[$key];

                continue;
            }

            if (! is_numeric($raw)) {
                $errors[$key] = "Indica {$param['label']}.";

                continue;
            }

            $number = str_contains((string) $raw, '.') ? (float) $raw : (int) $raw;

            if (($param['min'] !== null && $number < $param['min']) || ($param['max'] !== null && $number > $param['max'])) {
                $errors[$key] = "{$param['label']}: debe estar entre {$param['min']} y {$param['max']} (CR-01).";

                continue;
            }

            $clean[$key] = $number;
        }

        $cross = match (true) {
            isset($clean['childMinAge'], $clean['childMaxAge']) && $clean['childMinAge'] > $clean['childMaxAge'] => 'La edad mínima de niño no puede superar la máxima (CR-01).',
            default => null,
        };

        if ($cross !== null) {
            $errors['childMinAge'] = $cross;
        }

        return [$clean, $errors];
    }
}
