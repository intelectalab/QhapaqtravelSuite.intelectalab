<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Integrations\Fake\FakeFiscalGateway;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

final class FiscalWebhookSecret
{
    public const KEY = 'fiscal_provider';

    public function raw(): array
    {
        return PlatformSettings::read(self::KEY);
    }

    public function secret(): string
    {
        $encrypted = (string) ($this->raw()['webhook_secret'] ?? '');

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
        $driver = (string) config('integrations.drivers.fiscal', 'fake');
        $provider = $driver === 'fake' ? FakeFiscalGateway::NAME : $driver;

        return [
            'secret_set' => $this->secret() !== '',
            'callback_url' => rtrim((string) config('app.url'), '/').'/api/v1/integrations/fiscal/'.$provider.'/webhook',
            'signature_header' => FakeFiscalGateway::SIGNATURE_HEADER,
            'simulated' => $driver === 'fake',
            'changed_at' => $this->raw()['changed_at'] ?? null,
        ];
    }

    public function store(?string $secret, string $actorId): void
    {
        PlatformSettings::write(self::KEY, [
            ...$this->raw(),
            'webhook_secret' => $secret === null ? '' : Crypt::encryptString($secret),
            'changed_at' => now()->toIso8601String(),
        ], $actorId);
    }
}
