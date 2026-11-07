<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\PlatformAudit;
use App\Domain\Platform\Support\PlatformSettings;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class UpdatePlatformSettings
{
    public const ENTITY = 'Configuración de plataforma';

    public const LABELS = [
        'issuer.name' => 'Razón social del emisor',
        'issuer.ruc' => 'RUC del emisor',
        'issuer.address' => 'Domicilio fiscal del emisor',
        'issuer.email' => 'Correo de facturación',
        'issuer.web' => 'Sitio web',
        'igv_pct' => 'IGV',
        'notices.trial_days' => 'Avisos de fin de prueba',
        'notices.usage_warn_pct' => 'Aviso de uso del plan',
        'notices.api_key_days' => 'Aviso de llaves de API',
    ];

    public function __construct(private readonly PlatformSettings $settings, private readonly PlatformSession $session, private readonly PlatformAudit $audit) {}

    public function overview(): array
    {
        return [
            'sections' => [
                'issuer' => $this->settings->issuer(),
                'taxes' => ['igv_pct' => $this->settings->igv(), 'currency' => (string) $this->settings->all()['currency']],
                'notices' => $this->settings->notices(),
                'dunning' => $this->settings->dunning(),
            ],
            'lock_version' => $this->settings->version(),
            'updated_at' => $this->settings->updatedAt(),
            'history' => $this->audit->entries([self::ENTITY, 'Política de cobranza']),
        ];
    }

    public function update(string $section, array $data, PlatformUser $actor): array
    {
        return DB::connection('pgsql_platform')->transaction(function () use ($section, $data, $actor): array {
            DB::connection('pgsql_platform')->table('platform_settings')->where('key', PlatformSettings::KEY)->lockForUpdate()->first(['key']);
            [$key, $before, $after] = match ($section) {
                'issuer' => ['issuer', $this->settings->issuer(), [...$this->settings->issuer(), ...array_map(fn ($value) => trim((string) $value), $data)]],
                'taxes' => ['igv_pct', ['igv_pct' => $this->settings->igv()], ['igv_pct' => (float) $data['igv_pct']]],
                'notices' => ['notices', $this->settings->notices(), [
                    'trial_days' => collect($data['trial_days'])->map(fn ($day) => (int) $day)->unique()->sortDesc()->values()->all(),
                    'usage_warn_pct' => (int) $data['usage_warn_pct'],
                    'api_key_days' => (int) $data['api_key_days'],
                ]],
                default => throw ApiException::notFound('La sección no existe.'),
            };
            $changed = array_filter(array_keys($after), fn (string $field): bool => json_encode($before[$field] ?? null) !== json_encode($after[$field]));

            if ($changed === []) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            $this->settings->put($key, $key === 'igv_pct' ? $after['igv_pct'] : $after, (string) $actor->getKey());

            foreach ($changed as $field) {
                $name = $key === 'igv_pct' ? 'igv_pct' : "{$key}.{$field}";
                $this->session->log(self::ENTITY, self::LABELS[$name] ?? $name, 'actualizar', $this->text($before[$field] ?? null), $this->text($after[$field]), $actor);
            }

            return array_values($changed);
        });
    }

    private function text(mixed $value): ?string
    {
        return match (true) {
            $value === null || $value === '' => null,
            is_array($value) => implode(', ', $value),
            default => (string) $value,
        };
    }
}
