<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Admin\Support\TenantSettings;

final class OperationsSettings
{
    public const DEFAULTS = [
        'supplier_response_hours' => 24,
        'noshow_notify_advisor' => true,
        'noshow_incident' => false,
        'noshow_charge' => false,
    ];

    public const SWITCHES = ['noshow_notify_advisor', 'noshow_incident', 'noshow_charge'];

    public const MAX_RESPONSE_HOURS = 240;

    private ?array $values = null;

    public function __construct(private readonly TenantSettings $settings) {}

    public static function withDefaults(array $stored): array
    {
        return [...self::DEFAULTS, ...$stored];
    }

    public function values(): array
    {
        return $this->values ??= self::withDefaults($this->settings->section('operations'));
    }

    public function supplierResponseHours(): int
    {
        $hours = $this->values()['supplier_response_hours'];

        return is_numeric($hours) ? max(1, min(self::MAX_RESPONSE_HOURS, (int) $hours)) : self::DEFAULTS['supplier_response_hours'];
    }

    public function responseHoursFor(mixed $providerHours): int
    {
        return is_numeric($providerHours) && (int) $providerHours > 0 ? (int) $providerHours : $this->supplierResponseHours();
    }

    public function noShowRules(): array
    {
        $values = $this->values();

        return [
            'notify_advisor' => (bool) $values['noshow_notify_advisor'],
            'incident' => (bool) $values['noshow_incident'],
            'charge' => (bool) $values['noshow_charge'],
        ];
    }
}
