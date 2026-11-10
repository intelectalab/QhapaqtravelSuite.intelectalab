<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

final class TravelPolicies
{
    private const LABELS = [
        'cancellation' => 'Cancelación',
        'modification' => 'Cambios de fecha',
        'no_show' => 'No presentación',
        'refund' => 'Reembolsos',
    ];

    private const SETTINGS = [
        'cancellation' => 'cancel_text',
        'modification' => 'modify_text',
        'no_show' => 'noshow_text',
        'refund' => 'refund_text',
    ];

    public function __construct(private readonly AgencyLetterhead $agency) {}

    public function rows(mixed $snapshot): array
    {
        $frozen = $this->frozen(is_string($snapshot) ? json_decode($snapshot, true) : $snapshot);
        $settings = $this->agency->section('policies');

        return collect(self::LABELS)
            ->map(fn (string $label, string $key): array => ['label' => $label, 'text' => trim((string) ($frozen[$key] ?? $settings[self::SETTINGS[$key]] ?? ''))])
            ->filter(fn (array $row): bool => $row['text'] !== '')
            ->values()
            ->all();
    }

    public function paymentTerms(): ?string
    {
        $settings = $this->agency->section('policies');
        $advance = (int) ($settings['advance_pct'] ?? 0);
        $days = (int) ($settings['balance_days_before'] ?? 0);

        if ($advance <= 0) {
            return null;
        }

        return $advance >= 100
            ? 'El viaje se confirma con el pago total.'
            : "Para confirmar el viaje se abona el {$advance} % del total; el saldo vence ".($days > 0 ? "{$days} días antes de la salida." : 'el día de la salida.');
    }

    private function frozen(mixed $snapshot): array
    {
        if (! is_array($snapshot) || $snapshot === []) {
            return [];
        }

        if (array_intersect(array_keys($snapshot), array_keys(self::LABELS)) !== []) {
            return $snapshot;
        }

        $first = collect($snapshot)->first(fn (mixed $value): bool => is_array($value) && array_intersect(array_keys($value), array_keys(self::LABELS)) !== []);

        return is_array($first) ? $first : [];
    }
}
