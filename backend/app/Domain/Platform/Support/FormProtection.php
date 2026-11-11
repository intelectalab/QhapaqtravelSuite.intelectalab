<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

final class FormProtection
{
    public const KEY = 'form_protection';

    public const PROVIDER = 'turnstile';

    public function raw(): array
    {
        return PlatformSettings::read(self::KEY);
    }

    public function active(): bool
    {
        $raw = $this->raw();

        return ($raw['enabled'] ?? false) === true && ($raw['site_key'] ?? '') !== '' && $this->secret() !== '';
    }

    public function siteKey(): ?string
    {
        return $this->active() ? (string) $this->raw()['site_key'] : null;
    }

    public function secret(): string
    {
        $encrypted = (string) ($this->raw()['secret'] ?? '');

        if ($encrypted === '') {
            return '';
        }

        try {
            return Crypt::decryptString($encrypted);
        } catch (DecryptException) {
            return '';
        }
    }

    public function summary(): array
    {
        $raw = $this->raw();
        $secret = $this->secret();

        return [
            'provider' => self::PROVIDER,
            'enabled' => ($raw['enabled'] ?? false) === true,
            'site_key' => (string) ($raw['site_key'] ?? ''),
            'secret_set' => $secret !== '',
            'secret_hint' => $secret === '' ? null : '••••'.mb_substr($secret, -4),
            'verified_at' => $raw['verified_at'] ?? null,
            'status' => $this->active() ? 'activa' : (($raw['enabled'] ?? false) === true ? 'incompleta' : 'apagada'),
        ];
    }

    public function store(bool $enabled, string $siteKey, ?string $secret, ?string $verifiedAt, string $actorId): void
    {
        $current = $this->raw();

        PlatformSettings::write(self::KEY, [
            'enabled' => $enabled,
            'site_key' => $siteKey,
            'secret' => $secret === null ? ($current['secret'] ?? '') : ($secret === '' ? '' : Crypt::encryptString($secret)),
            'verified_at' => $verifiedAt ?? ($current['verified_at'] ?? null),
        ], $actorId);
    }
}
