<?php

/*
| Valores esperados del motor de reservas para PRD-011 «Perú Clásico 10D/9N».
| Calculados con el prototipo: window.BookingEngine.quote(p, sel) en proto/index.html
| (window.TODAY = 2026-09-29, semillas kit-ia/seeds/*.json, TC USD 3.74, temporada TMP-02 factor 1.00).
| Mismos números que e2e/support/expected.ts. Recalcular con el script del README si cambian las semillas.
*/

/** Selección canónica del brief: 2 ADT + 1 CHD + 1 INF, alojamiento, adicional, adelanto 30 %. */
function prd011Selection(array $override = []): array
{
    return array_replace_recursive([
        'date' => '2026-10-12',
        'pax' => ['adt' => 2, 'chd' => 1, 'inf' => 1],
        'addons' => [['id' => 'ADD-1101', 'qty' => 3]],               // Museo Larco S/ 50 × (2 ADT + 1 CHD)
        'lodging' => [
            ['leg_id' => 'LEG-1', 'hotel_id' => 'H-LIM-3', 'rooms' => [['type' => 'Doble', 'qty' => 1], ['type' => 'Simple', 'qty' => 1]]], // Lima 1 noche
            ['leg_id' => 'LEG-2', 'hotel_id' => 'H-AQP-3', 'rooms' => [['type' => 'Doble', 'qty' => 1], ['type' => 'Simple', 'qty' => 1]]], // Arequipa 2
            ['leg_id' => 'LEG-3', 'hotel_id' => 'H-PUN-3', 'rooms' => [['type' => 'Doble', 'qty' => 1], ['type' => 'Simple', 'qty' => 1]]], // Puno 2
            ['leg_id' => 'LEG-4', 'hotel_id' => 'H-CUS-3', 'rooms' => [['type' => 'Doble', 'qty' => 1], ['type' => 'Simple', 'qty' => 1]]], // Cusco 4
        ],
        'currency' => 'PEN',
        'payment_mode' => 'adelanto',
        'channel' => 'Directo',
        'removed' => [],
    ], $override);
}

/** Resultado esperado en PEN (moneda base). Montos string con 2 decimales. */
const PRD011_EXPECTED_PEN = [
    'lines' => [
        'base-adt' => ['qty' => 2, 'unit' => '5572.60', 'amount' => '11145.20', 'removable' => false], // 1490 USD × 3.74
        'base-chd' => ['qty' => 1, 'unit' => '4076.60', 'amount' => '4076.60', 'removable' => false],  // tarifa Niño TAR-112 1090 USD × 3.74
        'base-inf' => ['qty' => 1, 'unit' => '0.00', 'amount' => '0.00', 'removable' => false],        // infante no paga
        'addon-ADD-1101' => ['qty' => 3, 'unit' => '50.00', 'amount' => '150.00', 'removable' => true],
        'lodge-LEG-1-Doble' => ['qty' => 1, 'unit' => '317.90', 'amount' => '317.90', 'removable' => true],   // 85 USD × 1 hab × 1 noche
        'lodge-LEG-1-Simple' => ['qty' => 1, 'unit' => '261.80', 'amount' => '261.80', 'removable' => true],  // 70
        'lodge-LEG-2-Doble' => ['qty' => 2, 'unit' => '254.32', 'amount' => '508.64', 'removable' => true],   // 68 × 2 noches
        'lodge-LEG-2-Simple' => ['qty' => 2, 'unit' => '205.70', 'amount' => '411.40', 'removable' => true],  // 55
        'lodge-LEG-3-Doble' => ['qty' => 2, 'unit' => '231.88', 'amount' => '463.76', 'removable' => true],   // 62
        'lodge-LEG-3-Simple' => ['qty' => 2, 'unit' => '187.00', 'amount' => '374.00', 'removable' => true],  // 50
        'lodge-LEG-4-Doble' => ['qty' => 4, 'unit' => '224.40', 'amount' => '897.60', 'removable' => true],   // 60 × 4 noches
        'lodge-LEG-4-Simple' => ['qty' => 4, 'unit' => '179.52', 'amount' => '718.08', 'removable' => true],  // 48
    ],
    'adjustments' => [],            // R-GROUP-DISC, R-EARLY-BIRD, R-LAST-MINUTE, R-PAY-FEE inactivas en la semilla
    'subtotal' => '19324.98',
    'total' => '19324.98',
    'payment_mode' => 'adelanto',
    'modes' => ['total', 'adelanto'],
    'deposit_pct' => 30,            // payment.depositPct del producto
    'deposit' => '5797.49',
    'balance' => '13527.49',
    'balance_due' => '2026-09-29',  // 2026-10-12 − 30 días (balanceDueDays) < hoy → hoy
    'warnings' => ['La salida es cercana: el saldo se cobra de inmediato.'],
    'rooms' => 8,
    'nights' => 9,
    'season' => 'Temporada media — primavera',
];

/** Mismo caso en USD (moneda de cobro: sin margen de conversión). */
const PRD011_EXPECTED_USD = [
    'addon_line' => ['unit' => '13.37', 'amount' => '40.11'], // 50 PEN / 3.74 = 13.369 (el prototipo redondea solo el subtotal)
    'subtotal' => '5167.11', 'total' => '5167.11', 'deposit' => '1550.13', 'balance' => '3616.98',
];

/** Variantes (misma selección PEN salvo lo indicado). */
const PRD011_VARIANTS = [
    // Previsualización quitando el adicional (R-PREVIEW-REMOVE activa)
    'removed_addon' => ['removed' => ['addon-ADD-1101'], 'total' => '19174.98', 'deposit' => '5752.49', 'balance' => '13422.49', 'rooms' => 8, 'nights' => 9],
    // Quitar Lima (2 líneas de alojamiento) en USD: rooms 6 / nights 8
    'removed_lima_usd' => ['currency' => 'USD', 'removed' => ['lodge-LEG-1-Doble', 'lodge-LEG-1-Simple'], 'total' => '5012.11', 'deposit' => '1503.63', 'balance' => '3508.48', 'rooms' => 6, 'nights' => 8],
    // Regla apagada: R-LODGING enabled=false → se ignora el alojamiento
    'rule_off_lodging' => ['rule' => 'R-LODGING', 'total' => '15371.80', 'deposit' => '4611.54', 'balance' => '10760.26', 'rooms' => 0, 'nights' => 0],
    // Regla apagada: R-PREVIEW-REMOVE enabled=false → removed[] NO altera el total (esp. 17 §5 y §10.5).
    // ATENCIÓN (hallazgo del kit): el prototipo devuelve 19174.98 porque marca `removed` aunque la línea ya no sea
    // `removable` (booking-engine.js, función add). El backend sigue la especificación: 19324.98.
    'rule_off_preview_remove' => ['rule' => 'R-PREVIEW-REMOVE', 'removed' => ['addon-ADD-1101'], 'total' => '19324.98', 'prototype_total' => '19174.98'],
    // Regla apagada: R-DEPOSIT enabled=false → solo pago total
    'rule_off_deposit' => ['rule' => 'R-DEPOSIT', 'total' => '19324.98', 'payment_mode' => 'total', 'modes' => ['total'], 'deposit_pct' => 100, 'deposit' => '19324.98', 'balance' => '0.00', 'balance_due' => null],
    // Plan sin la regla: tenant en Starter → R-LODGING y R-ADDONS (plan mínimo Professional) no aplican aunque estén enabled
    'plan_starter' => ['plan' => 'Starter', 'total' => '15221.80', 'deposit' => '4566.54', 'balance' => '10655.26', 'rooms' => 0, 'nights' => 0],
];

/** Disponibilidad por rangos (dayStatus con 2 asientos) y reglas de pasajeros. */
const PRD011_DAYS_2_SEATS = [
    '2026-10-02' => ['disponible', 12], '2026-10-06' => ['disponible', 12],
    '2026-10-07' => ['cerrado', 0], '2026-10-08' => ['cerrado', 0], '2026-10-09' => ['cerrado', 0],
    '2026-10-10' => ['disponible', 3], '2026-10-12' => ['disponible', 9], '2026-10-14' => ['disponible', 9],
];

const PRD011_PAX_INVALID = [
    'más de 2 niños por adulto' => [['adt' => 2, 'chd' => 5, 'inf' => 0], 'Máximo 2 niño(s) de 4 a 10 años por cada adulto.'],
    'más de 1 infante por adulto' => [['adt' => 2, 'chd' => 0, 'inf' => 3], 'Máximo 1 infante(s) de 0 a 3 años por cada adulto.'],
    'sin adultos' => [['adt' => 0, 'chd' => 1, 'inf' => 0], 'Se requiere al menos 1 adulto(s) (11+ años).'],
    'más de 16 asientos' => [['adt' => 16, 'chd' => 1, 'inf' => 0], 'Máximo 16 pasajeros por reserva.'],
];
