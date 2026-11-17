<?php

function prd011Selection(array $override = []): array
{
    return array_replace_recursive([
        'date' => '2026-10-12',
        'pax' => ['adt' => 2, 'chd' => 1, 'inf' => 1],
        'addons' => [['id' => 'ADD-1101', 'qty' => 3]],
        'lodging' => [
            ['leg_id' => 'LEG-1', 'hotel_id' => 'H-LIM-3', 'rooms' => [['type' => 'Doble', 'qty' => 1], ['type' => 'Simple', 'qty' => 1]]],
            ['leg_id' => 'LEG-2', 'hotel_id' => 'H-AQP-3', 'rooms' => [['type' => 'Doble', 'qty' => 1], ['type' => 'Simple', 'qty' => 1]]],
            ['leg_id' => 'LEG-3', 'hotel_id' => 'H-PUN-3', 'rooms' => [['type' => 'Doble', 'qty' => 1], ['type' => 'Simple', 'qty' => 1]]],
            ['leg_id' => 'LEG-4', 'hotel_id' => 'H-CUS-3', 'rooms' => [['type' => 'Doble', 'qty' => 1], ['type' => 'Simple', 'qty' => 1]]],
        ],
        'currency' => 'PEN',
        'payment_mode' => 'adelanto',
        'channel' => 'Directo',
        'removed' => [],
    ], $override);
}

const PRD011_EXPECTED_PEN = [
    'lines' => [
        'base-adt' => ['qty' => 2, 'unit' => '5684.05', 'amount' => '11368.10', 'removable' => false],
        'base-chd' => ['qty' => 1, 'unit' => '4158.13', 'amount' => '4158.13', 'removable' => false],
        'base-inf' => ['qty' => 1, 'unit' => '0.00', 'amount' => '0.00', 'removable' => false],
        'addon-ADD-1101' => ['qty' => 3, 'unit' => '50.00', 'amount' => '150.00', 'removable' => true],
        'lodge-LEG-1-Doble' => ['qty' => 1, 'unit' => '324.26', 'amount' => '324.26', 'removable' => true],
        'lodge-LEG-1-Simple' => ['qty' => 1, 'unit' => '267.04', 'amount' => '267.04', 'removable' => true],
        'lodge-LEG-2-Doble' => ['qty' => 2, 'unit' => '259.41', 'amount' => '518.81', 'removable' => true],
        'lodge-LEG-2-Simple' => ['qty' => 2, 'unit' => '209.81', 'amount' => '419.63', 'removable' => true],
        'lodge-LEG-3-Doble' => ['qty' => 2, 'unit' => '236.52', 'amount' => '473.04', 'removable' => true],
        'lodge-LEG-3-Simple' => ['qty' => 2, 'unit' => '190.74', 'amount' => '381.48', 'removable' => true],
        'lodge-LEG-4-Doble' => ['qty' => 4, 'unit' => '228.89', 'amount' => '915.55', 'removable' => true],
        'lodge-LEG-4-Simple' => ['qty' => 4, 'unit' => '183.11', 'amount' => '732.44', 'removable' => true],
    ],
    'adjustments' => [],
    'subtotal' => '19708.48',
    'total' => '19708.48',
    'payment_mode' => 'adelanto',
    'modes' => ['total', 'adelanto'],
    'deposit_pct' => 30,
    'deposit' => '5912.54',
    'balance' => '13795.94',
    'balance_due' => '2026-09-29',
    'warnings' => ['La salida es cercana: el saldo se cobra de inmediato.'],
    'rooms' => 8,
    'nights' => 9,
    'season' => 'Temporada media — primavera',
];

const PRD011_EXPECTED_USD = [
    'addon_line' => ['unit' => '13.64', 'amount' => '40.91'],
    'subtotal' => '5167.91', 'total' => '5167.91', 'deposit' => '1550.37', 'balance' => '3617.54',
];

const PRD011_VARIANTS = [
    'removed_addon' => ['removed' => ['addon-ADD-1101'], 'total' => '19558.48', 'deposit' => '5867.54', 'balance' => '13690.94', 'rooms' => 8, 'nights' => 9],
    'removed_lima_usd' => ['currency' => 'USD', 'removed' => ['lodge-LEG-1-Doble', 'lodge-LEG-1-Simple'], 'total' => '5012.91', 'deposit' => '1503.87', 'balance' => '3509.04', 'rooms' => 6, 'nights' => 8],
    'rule_off_lodging' => ['rule' => 'R-LODGING', 'total' => '15676.23', 'deposit' => '4702.87', 'balance' => '10973.36', 'rooms' => 0, 'nights' => 0],
    'rule_off_preview_remove' => ['rule' => 'R-PREVIEW-REMOVE', 'removed' => ['addon-ADD-1101'], 'total' => '19708.48', 'prototype_total' => '19558.48'],
    'rule_off_deposit' => ['rule' => 'R-DEPOSIT', 'total' => '19708.48', 'payment_mode' => 'total', 'modes' => ['total'], 'deposit_pct' => 100, 'deposit' => '19708.48', 'balance' => '0.00', 'balance_due' => null],
    'plan_starter' => ['plan' => 'Starter', 'total' => '15221.80', 'deposit' => '4566.54', 'balance' => '10655.26', 'rooms' => 0, 'nights' => 0],
];

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
