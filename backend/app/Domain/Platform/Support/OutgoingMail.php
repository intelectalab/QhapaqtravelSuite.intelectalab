<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

final class OutgoingMail
{
    public const KEY = 'outgoing_mail';

    public const ENCRYPTIONS = ['ssl', 'tls', 'none'];

    public function raw(): array
    {
        return PlatformSettings::read(self::KEY);
    }

    public function password(): string
    {
        $encrypted = (string) ($this->raw()['password'] ?? '');

        if ($encrypted === '') {
            return '';
        }

        try {
            return Crypt::decryptString($encrypted);
        } catch (DecryptException) {
            return '';
        }
    }

    public function complete(array $values, string $password): bool
    {
        return trim((string) ($values['host'] ?? '')) !== ''
            && (int) ($values['port'] ?? 0) > 0
            && trim((string) ($values['username'] ?? '')) !== ''
            && trim((string) ($values['from_address'] ?? '')) !== ''
            && $password !== '';
    }

    public function active(): bool
    {
        $raw = $this->raw();

        return ($raw['enabled'] ?? false) === true && $this->complete($raw, $this->password());
    }

    public function connection(): ?array
    {
        if (! $this->active()) {
            return null;
        }

        return $this->connectionFrom($this->raw(), $this->password());
    }

    public function connectionFrom(array $values, string $password): array
    {
        return [
            'host' => trim((string) $values['host']),
            'port' => (int) $values['port'],
            'encryption' => in_array($values['encryption'] ?? null, self::ENCRYPTIONS, true) ? (string) $values['encryption'] : 'ssl',
            'username' => trim((string) $values['username']),
            'password' => $password,
            'from_address' => trim((string) $values['from_address']),
            'from_name' => trim((string) ($values['from_name'] ?? '')),
        ];
    }

    public function summary(): array
    {
        $raw = $this->raw();
        $enabled = ($raw['enabled'] ?? false) === true;

        return [
            'enabled' => $enabled,
            'host' => (string) ($raw['host'] ?? ''),
            'port' => isset($raw['port']) ? (int) $raw['port'] : null,
            'encryption' => in_array($raw['encryption'] ?? null, self::ENCRYPTIONS, true) ? (string) $raw['encryption'] : 'ssl',
            'username' => (string) ($raw['username'] ?? ''),
            'password_set' => $this->password() !== '',
            'from_address' => (string) ($raw['from_address'] ?? ''),
            'from_name' => (string) ($raw['from_name'] ?? ''),
            'verified_at' => $raw['verified_at'] ?? null,
            'last_test' => isset($raw['last_test']) ? (array) $raw['last_test'] : null,
            'status' => $this->active() ? 'activa' : ($enabled ? 'incompleta' : 'apagada'),
        ];
    }

    public function store(array $values, ?string $password, ?string $verifiedAt, string $actorId): void
    {
        $current = $this->raw();

        PlatformSettings::write(self::KEY, [
            ...$current,
            ...$values,
            'password' => $password === null ? ($current['password'] ?? '') : Crypt::encryptString($password),
            'verified_at' => $verifiedAt ?? ($current['verified_at'] ?? null),
        ], $actorId);
    }

    public function recordTest(string $to, bool $ok, string $actorId): void
    {
        PlatformSettings::write(self::KEY, [...$this->raw(), 'last_test' => ['to' => $to, 'ok' => $ok, 'at' => now()->toIso8601String()]], $actorId);
    }
}
