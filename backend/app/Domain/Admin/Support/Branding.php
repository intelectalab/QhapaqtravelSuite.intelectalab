<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class Branding
{
    public const DEFAULTS = ['brand' => '#b3263e', 'accent' => '#26357a', 'menu' => '#141a33', 'tile_variant' => 'bento'];

    public const VARIANTS = [
        'bento' => 'Bento',
        'bento-split' => 'Bento dividido',
        'bento-stack' => 'Bento con cabecera',
        'stacked' => 'Apilada',
        'side' => 'Icono al lado',
        'inline' => 'Compacta',
        'watermark' => 'Marca de agua',
        'stripe' => 'Franja lateral',
    ];

    public const LABELS = ['brand' => 'Color principal', 'accent' => 'Color de acento', 'menu' => 'Color del menú', 'tile_variant' => 'Diseño de tarjeta'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly AuditLogger $audit,
        private readonly AuditDirectory $history,
    ) {}

    public function current(): array
    {
        $settings = $this->context->tenant()->settings ?? [];

        return [...self::DEFAULTS, ...array_intersect_key((array) ($settings['branding'] ?? []), self::DEFAULTS)];
    }

    public function overview(User $viewer): array
    {
        $tenant = $this->context->tenant();

        return [
            'branding' => $this->current(),
            'defaults' => self::DEFAULTS,
            'variants' => collect(self::VARIANTS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values(),
            'agency' => ['name' => $tenant->commercial_name, 'initials' => $tenant->logo_initials],
            'history' => $this->history->recent(['Personalización'], 8),
            'can_manage' => $viewer->can('admin.settings.manage'),
        ];
    }

    public function save(array $values): array
    {
        $before = $this->current();
        $after = [...$before, ...array_intersect_key($values, self::DEFAULTS)];
        $changed = TenantSettings::changes($before, $after);

        if ($changed === []) {
            throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
        }

        $this->persist($after);

        foreach ($changed as $key => [$old, $new]) {
            $this->audit->log('Personalización', $key, 'actualizar', self::describe($key, $old), self::describe($key, $new));
        }

        return array_keys($changed);
    }

    public function reset(string $reason): void
    {
        $before = $this->current();

        if (TenantSettings::changes($before, self::DEFAULTS) === []) {
            throw ApiException::unprocessable('CFG-BR-01', 'La apariencia ya es la predeterminada.');
        }

        $this->persist(self::DEFAULTS);
        $this->audit->log('Personalización', 'apariencia', 'restablecer', json_encode($before, JSON_UNESCAPED_UNICODE) ?: null, $reason);
    }

    private function persist(array $branding): void
    {
        $tenant = $this->context->tenant();
        $settings = [...($tenant->settings ?? []), 'branding' => $branding];
        DB::table('tenants')->where('id', $tenant->getKey())->update(['settings' => json_encode($settings, JSON_UNESCAPED_UNICODE), 'updated_at' => now()]);
        $tenant->refresh();
    }

    private static function describe(string $key, mixed $value): ?string
    {
        return $key === 'tile_variant' ? (self::VARIANTS[(string) $value] ?? (string) $value) : TenantSettings::text($value);
    }
}
