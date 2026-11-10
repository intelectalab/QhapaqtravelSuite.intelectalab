<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class AgencyLetterhead
{
    public const BRAND = '#b3263e';

    public const ACCENT = '#26357a';

    public const INK = '#141a33';

    public function __construct(private readonly TenantContext $context) {}

    public function current(): array
    {
        $tenant = $this->context->tenant();
        $branding = (array) (((array) $tenant->settings)['branding'] ?? []);
        $general = $this->section('general');
        $ink = $this->color($branding['menu'] ?? null, self::INK);

        return [
            'name' => (string) $tenant->commercial_name,
            'legal_name' => (string) $tenant->legal_name,
            'ruc' => (string) $tenant->ruc,
            'fiscal_address' => (string) $tenant->fiscal_address,
            'address' => (string) ($general['address'] ?? $tenant->fiscal_address),
            'email' => (string) ($general['email'] ?? $tenant->admin_email),
            'phone' => isset($general['phone']) ? (string) $general['phone'] : null,
            'web' => isset($general['web']) ? (string) $general['web'] : null,
            'registry' => isset($general['mincetur_registry']) ? (string) $general['mincetur_registry'] : null,
            'initials' => (string) ($tenant->logo_initials ?: mb_substr((string) $tenant->commercial_name, 0, 2)),
            'timezone' => (string) ($tenant->timezone ?: 'America/Lima'),
            'brand' => $this->color($branding['brand'] ?? null, self::BRAND),
            'accent' => $this->color($branding['accent'] ?? null, self::ACCENT),
            'ink' => $ink,
        ];
    }

    public function section(string $section): array
    {
        return (array) json_decode((string) DB::table('sys_settings')->where('section', $section)->value('values'), true);
    }

    private function color(mixed $value, string $fallback): string
    {
        return is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/', $value) === 1 ? strtolower($value) : $fallback;
    }
}
