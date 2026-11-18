<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Mail;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

class AgencyMailbox
{
    public const SECTION = 'notifications';

    public const KEY = 'outgoing_mail';

    public const PROVIDERS = [
        'gmail' => ['label' => 'Gmail o Google Workspace', 'host' => 'smtp.gmail.com', 'port' => 465, 'encryption' => 'ssl', 'help' => 'Activa la verificación en dos pasos y crea una contraseña de aplicación en tu cuenta de Google › Seguridad.'],
        'outlook' => ['label' => 'Outlook o Microsoft 365', 'host' => 'smtp.office365.com', 'port' => 587, 'encryption' => 'tls', 'help' => 'Crea una contraseña de aplicación en tu cuenta Microsoft › Seguridad. En Microsoft 365, el administrador del dominio debe tener activado el envío por SMTP.'],
        'zoho' => ['label' => 'Zoho Mail', 'host' => 'smtp.zoho.com', 'port' => 465, 'encryption' => 'ssl', 'help' => 'Genera una contraseña específica de la aplicación en Zoho › Seguridad.'],
        'otro' => ['label' => 'Otro servidor', 'host' => null, 'port' => null, 'encryption' => null, 'help' => 'Pide a tu proveedor de hosting el servidor SMTP, el puerto y el cifrado de tu correo.'],
    ];

    public function __construct(private readonly TenantSettings $settings) {}

    public function raw(): array
    {
        return (array) ($this->settings->section(self::SECTION)[self::KEY] ?? []);
    }

    public function password(?array $raw = null): string
    {
        $encrypted = (string) (($raw ?? $this->raw())['password'] ?? '');

        if ($encrypted === '') {
            return '';
        }

        try {
            return Crypt::decryptString($encrypted);
        } catch (DecryptException) {
            return '';
        }
    }

    public function active(?array $raw = null): bool
    {
        $raw ??= $this->raw();

        return ($raw['verified_at'] ?? null) !== null && $this->connectionFrom($raw, $this->password($raw)) !== null;
    }

    public function connection(): ?array
    {
        $raw = $this->raw();

        return $this->active($raw) ? $this->connectionFrom($raw, $this->password($raw)) : null;
    }

    public function connectionFrom(array $values, string $password): ?array
    {
        $provider = self::PROVIDERS[$values['provider'] ?? ''] ?? null;
        $address = mb_strtolower(trim((string) ($values['address'] ?? '')));

        if ($provider === null || $address === '' || $password === '') {
            return null;
        }

        $host = trim((string) ($provider['host'] ?? $values['host'] ?? ''));
        $port = (int) ($provider['port'] ?? $values['port'] ?? 0);

        if ($host === '' || $port <= 0) {
            return null;
        }

        return [
            'host' => $host,
            'port' => $port,
            'encryption' => (string) ($provider['encryption'] ?? (in_array($values['encryption'] ?? null, ['ssl', 'tls', 'none'], true) ? $values['encryption'] : 'ssl')),
            'username' => $address,
            'password' => $password,
            'from_address' => $address,
            'from_name' => trim((string) ($values['from_name'] ?? '')),
        ];
    }

    public function summary(): array
    {
        $raw = $this->raw();
        $provider = (string) ($raw['provider'] ?? '');

        return [
            'status' => $this->active($raw) ? 'conectado' : 'sin_configurar',
            'provider' => isset(self::PROVIDERS[$provider]) ? $provider : null,
            'address' => (string) ($raw['address'] ?? ''),
            'from_name' => (string) ($raw['from_name'] ?? ''),
            'host' => $provider === 'otro' ? (string) ($raw['host'] ?? '') : null,
            'port' => $provider === 'otro' && isset($raw['port']) ? (int) $raw['port'] : null,
            'encryption' => $provider === 'otro' ? (string) ($raw['encryption'] ?? 'ssl') : null,
            'password_set' => $this->password($raw) !== '',
            'verified_at' => $raw['verified_at'] ?? null,
            'providers' => array_map(fn (string $value, array $row): array => ['value' => $value, 'label' => $row['label'], 'help' => $row['help'], 'host' => $row['host'], 'port' => $row['port'], 'encryption' => $row['encryption']], array_keys(self::PROVIDERS), array_values(self::PROVIDERS)),
        ];
    }

    public function store(array $values, string $password, User $actor): void
    {
        $this->write([
            'provider' => $values['provider'],
            'address' => mb_strtolower(trim((string) $values['address'])),
            'from_name' => trim((string) ($values['from_name'] ?? '')),
            'host' => $values['provider'] === 'otro' ? trim((string) ($values['host'] ?? '')) : null,
            'port' => $values['provider'] === 'otro' ? (int) ($values['port'] ?? 0) : null,
            'encryption' => $values['provider'] === 'otro' ? (string) ($values['encryption'] ?? 'ssl') : null,
            'password' => Crypt::encryptString($password),
            'verified_at' => now()->toIso8601String(),
        ], $actor);
    }

    public function forget(User $actor): void
    {
        $this->write([], $actor);
    }

    private function write(array $values, User $actor): void
    {
        $section = $this->settings->section(self::SECTION);
        unset($section[self::KEY]);

        $this->settings->save(self::SECTION, $values === [] ? $section : [...$section, self::KEY => $values], $actor);
    }
}
