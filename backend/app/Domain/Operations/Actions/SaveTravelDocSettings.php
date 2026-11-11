<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\TravelDocRules;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

final class SaveTravelDocSettings
{
    public function __construct(private readonly TenantSettings $settings, private readonly TravelDocRules $rules, private readonly AuditLogger $audit) {}

    public function save(array $data, User $actor): array
    {
        $before = $this->rules->settings();
        $days = array_values(array_unique(array_map('intval', $data['reminder_days'])));
        rsort($days);
        $after = [
            'reminder_days' => $days,
            'channels' => array_key_exists('channels', $data) ? array_values(array_intersect(TravelDocRules::CHANNELS, $data['channels'])) : $before['channels'],
            'passport_months' => array_key_exists('passport_months', $data) ? (int) $data['passport_months'] : $before['passport_months'],
            'visa_nationalities' => array_key_exists('visa_nationalities', $data) ? array_values(array_unique(array_filter(array_map(fn ($value) => trim((string) $value), $data['visa_nationalities'])))) : $before['visa_nationalities'],
            'insurance_trekking' => array_key_exists('insurance_trekking', $data) ? (bool) $data['insurance_trekking'] : $before['insurance_trekking'],
        ];

        DB::transaction(function () use ($before, $after, $actor): void {
            $this->settings->save(TravelDocRules::SECTION, [...$this->settings->section(TravelDocRules::SECTION), ...$after], $actor);
            $this->audit->log('Documentos de viaje', 'reglas', 'editar_reglas', $this->summary($before), $this->summary($after));
        });

        return $this->rules->settings();
    }

    private function summary(array $values): string
    {
        return implode(' · ', [
            'avisos '.implode(', ', $values['reminder_days']),
            implode(' + ', $values['channels']),
            "pasaporte {$values['passport_months']} meses",
            'visa '.(implode(', ', $values['visa_nationalities']) ?: 'ninguna'),
            'seguro en trekking '.($values['insurance_trekking'] ? 'sí' : 'no'),
        ]);
    }
}
