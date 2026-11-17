<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;

final class PlatformLogo
{
    public const KEY = 'platform_logo';

    public const DEFAULT = 'tocapu';

    public const MARKS = [
        'tocapu' => ['label' => 'Tocapu', 'hint' => 'Cuatro bloques en cochinilla, azafrán, índigo y jade.'],
        'kit' => ['label' => 'Marca del kit 2.13', 'hint' => 'Cuadro azul marino con cuadrícula amarilla.'],
    ];

    public function __construct(private readonly PlatformSession $session) {}

    public function current(): string
    {
        $mark = (string) (PlatformSettings::read(self::KEY)['mark'] ?? self::DEFAULT);

        return array_key_exists($mark, self::MARKS) ? $mark : self::DEFAULT;
    }

    public function overview(): array
    {
        return [
            'current' => $this->current(),
            'options' => collect(self::MARKS)->map(fn (array $mark, string $value): array => ['value' => $value, ...$mark])->values()->all(),
        ];
    }

    public function choose(string $mark, PlatformUser $actor): void
    {
        $before = $this->current();

        if ($before === $mark) {
            throw ApiException::unprocessable('CFG-BR-01', 'Ese logo ya está activo.');
        }

        PlatformSettings::write(self::KEY, ['mark' => $mark], (string) $actor->getKey());
        $this->session->log(PlatformBranding::ENTITY, 'Logo de KipuControl', 'actualizar', self::MARKS[$before]['label'], self::MARKS[$mark]['label'], $actor);
    }
}
