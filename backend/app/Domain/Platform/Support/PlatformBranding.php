<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Admin\Support\Branding;
use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;

final class PlatformBranding
{
    public const KEY = 'branding';

    public const ENTITY = 'Personalización de plataforma';

    public function __construct(private readonly PlatformSession $session, private readonly PlatformAudit $audit) {}

    public function current(): array
    {
        return [...Branding::DEFAULTS, ...array_intersect_key(PlatformSettings::read(self::KEY), Branding::DEFAULTS)];
    }

    public function overview(): array
    {
        return [
            'branding' => $this->current(),
            'defaults' => Branding::DEFAULTS,
            'variants' => collect(Branding::VARIANTS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values(),
            'agency' => ['name' => 'Consola de plataforma', 'initials' => 'QT'],
            'history' => $this->audit->entries([self::ENTITY]),
            'can_manage' => true,
        ];
    }

    public function save(array $values, PlatformUser $actor): array
    {
        $before = $this->current();
        $after = [...$before, ...array_intersect_key($values, Branding::DEFAULTS)];
        $changed = array_filter(array_keys(Branding::DEFAULTS), fn (string $key): bool => (string) $before[$key] !== (string) $after[$key]);

        if ($changed === []) {
            throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
        }

        PlatformSettings::write(self::KEY, $after, (string) $actor->getKey());

        foreach ($changed as $key) {
            $this->session->log(self::ENTITY, Branding::LABELS[$key], 'actualizar', $this->describe($key, $before[$key]), $this->describe($key, $after[$key]), $actor);
        }

        return array_values($changed);
    }

    public function reset(string $reason, PlatformUser $actor): void
    {
        if ($this->current() === Branding::DEFAULTS) {
            throw ApiException::unprocessable('CFG-BR-01', 'La apariencia ya es la predeterminada.');
        }

        PlatformSettings::write(self::KEY, Branding::DEFAULTS, (string) $actor->getKey());
        $this->session->log(self::ENTITY, 'Apariencia', 'restablecer', null, $reason, $actor);
    }

    private function describe(string $key, mixed $value): string
    {
        return $key === 'tile_variant' ? (Branding::VARIANTS[(string) $value] ?? (string) $value) : (string) $value;
    }
}
